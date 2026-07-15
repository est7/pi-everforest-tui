import { basename } from "node:path";
import { CustomEditor, type ExtensionAPI, type ExtensionContext, type Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { showCommandCenter } from "./everforest-tui/command-center.ts";
import { shouldInstallEditorChrome } from "./everforest-tui/editor-composition.ts";
import { showSettingsOverlay, type TuiFeature } from "./everforest-tui/settings-overlay.ts";
import { placeFooterStatuses, type FooterStatusSegment } from "./everforest-tui/status-layout.ts";
import { showThemeLab } from "./everforest-tui/theme-lab.ts";
import { statusForWorkingSnapshot, WorkingPhaseTracker, type WorkingSnapshot } from "./everforest-tui/working-phase.ts";

const STATUS_ID = "everforest-tui";
const STATE_CUSTOM_TYPE = "everforest-tui-state";

type Feature = TuiFeature;
type Toggle = "on" | "off";
type PersistedState = Record<Feature, boolean>;

const state: PersistedState = {
  indicator: false,
  status: false,
  footer: false,
  rainbow: false,
};

const defaults: PersistedState = {
  indicator: false,
  status: false,
  footer: false,
  rainbow: false,
};

type Rgb = readonly [number, number, number];

const DARK_RAINBOW: readonly Rgb[] = [
  [230, 126, 128],
  [230, 152, 117],
  [219, 188, 127],
  [167, 192, 128],
  [131, 192, 146],
  [127, 187, 179],
  [214, 153, 182],
];

const LIGHT_RAINBOW: readonly Rgb[] = [
  [248, 85, 82],
  [245, 125, 38],
  [223, 160, 0],
  [141, 161, 1],
  [53, 167, 124],
  [58, 148, 197],
  [223, 105, 186],
];

// Factory ownership/composition is adapted from pi-zentui@0.8.0 (MIT).
// See THIRD_PARTY_NOTICES.md. The tag prevents cleanup from replacing an editor
// that another extension installed after Everforest.
const EVERFOREST_EDITOR_FACTORY = Symbol.for("pi-everforest-tui.editor-factory");
const EVERFOREST_EDITOR_BASE = Symbol.for("pi-everforest-tui.editor-base-factory");

type EditorFactory = NonNullable<ReturnType<ExtensionContext["ui"]["getEditorComponent"]>>;
type TaggedEditorFactory = EditorFactory & {
  [EVERFOREST_EDITOR_FACTORY]?: true;
  [EVERFOREST_EDITOR_BASE]?: EditorFactory;
};

let indicatorInstalled = false;
let footerInstalled = false;
let rainbowInstalled = false;
let installedEditorFactory: EditorFactory | undefined;
let wrappedEditorFactory: EditorFactory | undefined;
let requestFooterRender: (() => void) | undefined;
let currentThinkingLevel = "off";
let gitDirty = false;
const workingPhases = new WorkingPhaseTracker();

function formatCount(value: number): string {
  if (value < 1000) return `${value}`;
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(1)}m`;
}

function formatModelName(model: string): string {
  return (model.split("/").pop() ?? model).replace(/-\d{8}$/, "");
}

function footerFits(width: number, left: string, right: string): boolean {
  return visibleWidth(left) + 1 + visibleWidth(right) <= width;
}

function formatFooterLine(width: number, left: string, right: string): string {
  const padding = Math.max(1, width - visibleWidth(left) - visibleWidth(right));
  return truncateToWidth(`${left}${" ".repeat(padding)}${right}`, width, "");
}

function formatFooterLineWithCenter(width: number, left: string, center: string, right: string): string {
  const spacing = width - visibleWidth(left) - visibleWidth(center) - visibleWidth(right);
  if (!center || spacing < 4) return formatFooterLine(width, left, right);
  const leftGap = Math.floor(spacing / 2);
  return `${left}${" ".repeat(leftGap)}${center}${" ".repeat(spacing - leftGap)}${right}`;
}

function getUsage(ctx: ExtensionContext): { input: number; output: number; cost: number } {
  let input = 0;
  let output = 0;
  let cost = 0;

  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "message") continue;
    const message = entry.message as {
      role?: string;
      usage?: { input?: number; output?: number; cost?: { total?: number } };
    };
    if (message.role !== "assistant" || !message.usage) continue;
    input += message.usage.input ?? 0;
    output += message.usage.output ?? 0;
    cost += message.usage.cost?.total ?? 0;
  }

  return { input, output, cost };
}

async function refreshGitDirty(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  try {
    const result = await pi.exec("git", ["status", "--porcelain", "--untracked-files=normal"], {
      cwd: ctx.cwd,
      timeout: 2000,
    });
    gitDirty = result.code === 0 && result.stdout.trim().length > 0;
  } catch {
    gitDirty = false;
  }
}

function applyIndicator(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;

  if (!state.indicator) {
    if (indicatorInstalled) {
      ctx.ui.setWorkingIndicator();
      indicatorInstalled = false;
    }
    return;
  }

  const theme = ctx.ui.theme;
  ctx.ui.setWorkingIndicator({
    frames: [
      theme.fg("dim", "·"),
      theme.fg("muted", "•"),
      theme.fg("accent", "●"),
      theme.fg("success", "●"),
      theme.fg("warning", "•"),
      theme.fg("muted", "·"),
    ],
    intervalMs: 120,
  });
  indicatorInstalled = true;
}

function applyStatus(ctx: ExtensionContext, snapshot: WorkingSnapshot = workingPhases.getSnapshot()): void {
  if (!ctx.hasUI) return;

  const presentation = state.status ? statusForWorkingSnapshot(snapshot) : undefined;
  if (!presentation) {
    ctx.ui.setStatus(STATUS_ID, undefined);
    return;
  }

  const theme = ctx.ui.theme;
  const icon = theme.fg(presentation.color, presentation.icon);
  const label = theme.fg(presentation.color, presentation.label);
  ctx.ui.setStatus(STATUS_ID, `${icon} ${label}`);
}

function applyWorkingPresentation(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  const snapshot = workingPhases.getSnapshot();
  applyStatus(ctx, snapshot);
  if (!state.indicator || snapshot.phase === "idle") {
    ctx.ui.setWorkingMessage();
  } else if (snapshot.phase === "thinking") {
    ctx.ui.setWorkingMessage("Thinking…");
  } else if (snapshot.phase === "toolUse") {
    ctx.ui.setWorkingMessage(`Running ${snapshot.toolName ?? "tool"}…`);
  } else {
    ctx.ui.setWorkingMessage("Working…");
  }
  requestFooterRender?.();
}

function sanitizeSingleLine(value: string): string {
  return value.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

function statusSegments(statuses: ReadonlyMap<string, string>): FooterStatusSegment[] {
  return [...statuses.entries()]
    .map(([id, value]) => ({ id, text: sanitizeSingleLine(value) }))
    .filter((segment) => Boolean(segment.text));
}

function applyFooter(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;

  if (!state.footer) {
    if (footerInstalled) {
      ctx.ui.setFooter(undefined);
      footerInstalled = false;
    }
    return;
  }

  ctx.ui.setFooter((tui, theme, footerData) => {
    requestFooterRender = () => tui.requestRender();
    const unsubscribe = footerData.onBranchChange(() => tui.requestRender());

    return {
      dispose() {
        unsubscribe();
        requestFooterRender = undefined;
      },
      invalidate() {},
      render(width: number): string[] {
        if (width <= 0) return [""];

        const usage = getUsage(ctx);
        const project = basename(ctx.cwd) || ctx.cwd;
        const branch = footerData.getGitBranch();
        const branchName = branch ?? "no git";
        const model = formatModelName(ctx.model?.id ?? "no model");
        const context = ctx.getContextUsage();
        const contextWindow = context?.contextWindow ?? ctx.model?.contextWindow ?? 0;
        const contextPercent = context?.percent;
        const contextLabel = contextPercent === null || contextPercent === undefined
          ? "ctx ?"
          : `ctx ${contextPercent.toFixed(0)}%`;
        const contextColor = contextPercent !== null && contextPercent !== undefined && contextPercent >= 85
          ? "error"
          : contextPercent !== null && contextPercent !== undefined && contextPercent >= 70
            ? "warning"
            : "success";
        const effortColor = currentThinkingLevel === "max"
          ? "error"
          : currentThinkingLevel === "xhigh"
            ? "customMessageLabel"
            : currentThinkingLevel === "high"
              ? "warning"
              : currentThinkingLevel === "medium"
                ? "success"
                : "dim";
        const separator = theme.fg("muted", " | ");
        const branchStatus = branch
          ? `${theme.fg("success", `(${branchName}`)}${gitDirty ? theme.fg("syntaxOperator", "*") : ""}${theme.fg("success", ")")}`
          : "";
        const projectAndBranch = branchStatus
          ? `${theme.fg("accent", project)} ${branchStatus}`
          : theme.fg("accent", project);
        const modelAndWindow = theme.fg("mdLink", `${model} (${formatCount(contextWindow)} context)`);
        const effort = `${theme.fg("muted", "eff ")}${theme.fg(effortColor, currentThinkingLevel)}`;
        const contextStatus = `${theme.fg("muted", "ctx ")}${theme.fg(contextColor, contextLabel.slice(4))}`;
        const fullLeft = [projectAndBranch, modelAndWindow, effort, contextStatus].join(separator);
        const fullRight = [
          `${theme.fg("muted", "in ")}${theme.fg("mdLink", formatCount(usage.input))}`,
          `${theme.fg("muted", "out ")}${theme.fg("success", formatCount(usage.output))}`,
          `${theme.fg("muted", "cost ")}${theme.fg("warning", `$${usage.cost.toFixed(3)}`)}`,
        ].join(" ");
        const compactLeft = [projectAndBranch, effort, contextStatus].join(separator);
        const left = footerFits(width, fullLeft, fullRight) ? fullLeft : compactLeft;
        const right = footerFits(width, left, fullRight) ? fullRight : "";
        const statusSeparator = theme.fg("dim", " • ");
        const placement = placeFooterStatuses(
          statusSegments(footerData.getExtensionStatuses()),
          Math.max(0, width - visibleWidth(left) - visibleWidth(right) - 4),
          width,
          statusSeparator,
        );
        const firstLine = placement.inline
          ? formatFooterLineWithCenter(width, left, placement.inline, right)
          : right
            ? formatFooterLine(width, left, right)
            : truncateToWidth(left, width, "");
        return placement.overflow ? [firstLine, placement.overflow] : [firstLine];
      },
    };
  });
  footerInstalled = true;
}

function interpolateColor(stops: readonly Rgb[], position: number): Rgb {
  const scaled = Math.max(0, Math.min(1, position)) * (stops.length - 1);
  const startIndex = Math.floor(scaled);
  const endIndex = Math.min(stops.length - 1, startIndex + 1);
  const amount = scaled - startIndex;
  const start = stops[startIndex];
  const end = stops[endIndex];
  return [
    Math.round(start[0] + (end[0] - start[0]) * amount),
    Math.round(start[1] + (end[1] - start[1]) * amount),
    Math.round(start[2] + (end[2] - start[2]) * amount),
  ];
}

function colorizeBorder(theme: Theme, line: string): string {
  const borderLength = [...line].filter((character) => character === "─").length;
  if (borderLength === 0) return line;

  const palette = theme.name?.includes("light") ? LIGHT_RAINBOW : DARK_RAINBOW;
  let index = 0;
  return line.replace(/─/g, (character) => {
    const [red, green, blue] = interpolateColor(palette, index++ / Math.max(1, borderLength - 1));
    return `\x1b[38;2;${red};${green};${blue}m${character}\x1b[39m`;
  });
}

function sessionBadge(theme: Theme, sessionName: string, width: number): string {
  if (!sessionName || width < 12) return "";

  const maxNameWidth = Math.max(1, Math.min(24, Math.floor(width / 3) - 2));
  const name = truncateToWidth(sessionName, maxNameWidth, "");
  const characters = [...` ${name} `];
  const palette = theme.name?.includes("light") ? LIGHT_RAINBOW : DARK_RAINBOW;

  return characters
    .map((character, index) => {
      const [red, green, blue] = interpolateColor(palette, index / Math.max(1, characters.length - 1));
      return `\x1b[48;2;${red};${green};${blue}m\x1b[30m${character}`;
    })
    .join("") + "\x1b[39m\x1b[49m";
}

function isEverforestEditorFactory(factory: EditorFactory | undefined): factory is TaggedEditorFactory {
  return Boolean((factory as TaggedEditorFactory | undefined)?.[EVERFOREST_EDITOR_FACTORY]);
}

function getEverforestEditorBase(factory: EditorFactory | undefined): EditorFactory | undefined {
  return (factory as TaggedEditorFactory | undefined)?.[EVERFOREST_EDITOR_BASE];
}

function createEverforestEditorFactory(ctx: ExtensionContext, baseFactory: EditorFactory | undefined): TaggedEditorFactory {
  const factory = ((tui, editorTheme, keybindings) => {
    const editor = baseFactory?.(tui, editorTheme, keybindings) ?? new CustomEditor(tui, editorTheme, keybindings);
    const render = editor.render.bind(editor);
    editor.render = (width: number) => {
      const lines = render(width);
      if (lines.length === 0) return lines;
      const activeTheme = ctx.ui.theme;
      const topBorder = colorizeBorder(activeTheme, lines[0]);
      const name = sanitizeSingleLine(ctx.sessionManager.getSessionName() ?? "");
      const badge = sessionBadge(activeTheme, name, width);
      lines[0] = badge
        ? `${truncateToWidth(topBorder, Math.max(0, width - visibleWidth(badge)), "")}${badge}`
        : topBorder;
      if (lines.length > 1) lines[lines.length - 1] = colorizeBorder(activeTheme, lines[lines.length - 1]);
      return lines;
    };
    return editor;
  }) as TaggedEditorFactory;
  factory[EVERFOREST_EDITOR_FACTORY] = true;
  if (baseFactory) factory[EVERFOREST_EDITOR_BASE] = baseFactory;
  return factory;
}

function applyRainbow(ctx: ExtensionContext): void {
  if (ctx.mode !== "tui") return;

  const currentFactory = ctx.ui.getEditorComponent();
  if (!state.rainbow) {
    if (isEverforestEditorFactory(currentFactory)) {
      ctx.ui.setEditorComponent(getEverforestEditorBase(currentFactory));
    }
    rainbowInstalled = false;
    installedEditorFactory = undefined;
    wrappedEditorFactory = undefined;
    return;
  }

  if (!shouldInstallEditorChrome(currentFactory, installedEditorFactory, isEverforestEditorFactory)) {
    rainbowInstalled = true;
    return;
  }

  wrappedEditorFactory = currentFactory;
  const factory = createEverforestEditorFactory(ctx, currentFactory);
  ctx.ui.setEditorComponent(factory);
  installedEditorFactory = factory;
  rainbowInstalled = true;
}

function applyAll(ctx: ExtensionContext): void {
  applyIndicator(ctx);
  applyFooter(ctx);
  applyRainbow(ctx);
  applyWorkingPresentation(ctx);
}

function readPersistedState(ctx: ExtensionContext): PersistedState | undefined {
  let saved: PersistedState | undefined;
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "custom" || entry.customType !== STATE_CUSTOM_TYPE) continue;
    const data = entry.data as Partial<PersistedState> | undefined;
    if (!data) continue;
    saved = {
      indicator: data.indicator === true,
      status: data.status === true,
      footer: data.footer === true,
      rainbow: data.rainbow === true,
    };
  }
  return saved;
}

function persistState(pi: ExtensionAPI): void {
  pi.appendEntry<PersistedState>(STATE_CUSTOM_TYPE, { ...state });
}

function restoreState(ctx: ExtensionContext): void {
  const saved = readPersistedState(ctx);
  state.indicator = saved?.indicator ?? defaults.indicator;
  state.status = saved?.status ?? defaults.status;
  state.footer = saved?.footer ?? defaults.footer;
  state.rainbow = saved?.rainbow ?? defaults.rainbow;
  applyAll(ctx);
}

function setFeature(pi: ExtensionAPI, ctx: ExtensionContext, feature: Feature, toggle: Toggle, persist = true): void {
  state[feature] = toggle === "on";
  if (feature === "indicator") applyIndicator(ctx);
  if (feature === "footer") applyFooter(ctx);
  if (feature === "rainbow") applyRainbow(ctx);
  if (feature === "indicator" || feature === "status") applyWorkingPresentation(ctx);
  if (persist) persistState(pi);
}

function reset(pi: ExtensionAPI, ctx: ExtensionContext): void {
  state.indicator = false;
  state.status = false;
  state.footer = false;
  state.rainbow = false;
  applyAll(ctx);
  persistState(pi);
}

export default function everforestTui(pi: ExtensionAPI) {
  pi.events.on("everforest-tui:defaults", (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const configured = value as Partial<PersistedState>;
    for (const feature of ["indicator", "status", "footer", "rainbow"] as const) {
      if (typeof configured[feature] === "boolean") defaults[feature] = configured[feature];
    }
  });

  pi.registerCommand("everforest", {
    description: "Open the Everforest command center for loaded extensions, prompts, and skills.",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await showCommandCenter(pi, ctx);
    },
  });

  pi.registerCommand("everforest-theme-lab", {
    description: "Preview the active theme's palette, Markdown, tools, diffs, syntax, and thinking states.",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await showThemeLab(ctx);
    },
  });

  pi.registerCommand("everforest-tui", {
    description: "Configure optional Everforest indicator, status, footer, and rainbow editor chrome.",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      const [feature, toggle] = args.trim().toLowerCase().split(/\s+/).filter(Boolean);

      if (!feature) {
        await showSettingsOverlay(ctx, state, (selectedFeature, enabled) => {
          setFeature(pi, ctx, selectedFeature, enabled ? "on" : "off");
        });
        return;
      }
      if (feature === "reset") {
        reset(pi, ctx);
        ctx.ui.notify("Everforest TUI enhancements reset", "info");
        return;
      }
      if (toggle !== "on" && toggle !== "off") {
        ctx.ui.notify("Usage: /everforest-tui [indicator|status|footer|rainbow|all] [on|off]", "error");
        return;
      }
      if (feature === "all") {
        setFeature(pi, ctx, "indicator", toggle, false);
        setFeature(pi, ctx, "status", toggle, false);
        setFeature(pi, ctx, "footer", toggle, false);
        setFeature(pi, ctx, "rainbow", toggle, false);
        persistState(pi);
        ctx.ui.notify(`Everforest TUI enhancements ${toggle}`, "info");
        return;
      }
      if (feature !== "indicator" && feature !== "status" && feature !== "footer" && feature !== "rainbow") {
        ctx.ui.notify("Unknown Everforest TUI feature. Use indicator, status, footer, rainbow, all, or reset.", "error");
        return;
      }
      setFeature(pi, ctx, feature, toggle);
      ctx.ui.notify(`Everforest TUI ${feature} ${toggle}`, "info");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    currentThinkingLevel = pi.getThinkingLevel();
    workingPhases.endTurn();
    await refreshGitDirty(pi, ctx);
    restoreState(ctx);
    setTimeout(() => {
      if (state.rainbow) applyRainbow(ctx);
    }, 0);
  });
  pi.on("session_tree", async (_event, ctx) => {
    workingPhases.endTurn();
    restoreState(ctx);
    await refreshGitDirty(pi, ctx);
    requestFooterRender?.();
  });
  pi.on("turn_start", async (_event, ctx) => {
    workingPhases.startTurn();
    applyWorkingPresentation(ctx);
  });
  pi.on("message_update", async (event, ctx) => {
    const type = event.assistantMessageEvent.type;
    if (type === "thinking_start") {
      workingPhases.setThinking(true);
      applyWorkingPresentation(ctx);
    } else if (type === "thinking_end") {
      workingPhases.setThinking(false);
      applyWorkingPresentation(ctx);
    }
  });
  pi.on("tool_execution_start", async (event, ctx) => {
    workingPhases.openTool(event.toolCallId, event.toolName);
    applyWorkingPresentation(ctx);
  });
  pi.on("tool_execution_end", async (event, ctx) => {
    workingPhases.closeTool(event.toolCallId);
    applyWorkingPresentation(ctx);
  });
  pi.on("turn_end", async (_event, ctx) => {
    workingPhases.endTurn();
    applyWorkingPresentation(ctx);
    await refreshGitDirty(pi, ctx);
    requestFooterRender?.();
  });
  pi.on("model_select", async (_event, ctx) => applyWorkingPresentation(ctx));
  pi.on("thinking_level_select", async (event, ctx) => {
    currentThinkingLevel = event.level;
    applyWorkingPresentation(ctx);
  });
  pi.on("session_shutdown", async (_event, ctx) => {
    workingPhases.endTurn();
    if (!ctx.hasUI) return;
    ctx.ui.setStatus(STATUS_ID, undefined);
    ctx.ui.setWorkingMessage();
    if (indicatorInstalled) ctx.ui.setWorkingIndicator();
    if (footerInstalled) ctx.ui.setFooter(undefined);
    const currentFactory = ctx.ui.getEditorComponent();
    if (isEverforestEditorFactory(currentFactory)) {
      ctx.ui.setEditorComponent(getEverforestEditorBase(currentFactory) ?? wrappedEditorFactory);
    }
    indicatorInstalled = false;
    footerInstalled = false;
    rainbowInstalled = false;
    installedEditorFactory = undefined;
    wrappedEditorFactory = undefined;
    requestFooterRender = undefined;
  });
}
