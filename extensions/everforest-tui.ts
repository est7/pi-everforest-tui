import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const STATUS_ID = "everforest-tui";
const STATE_CUSTOM_TYPE = "everforest-tui-state";

type Feature = "indicator" | "status" | "footer";
type Toggle = "on" | "off";
type StatusPhase = "ready" | "working";
type PersistedState = Record<Feature, boolean>;

const state: PersistedState = {
  indicator: false,
  status: false,
  footer: false,
};

let indicatorInstalled = false;
let footerInstalled = false;

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

function applyStatus(ctx: ExtensionContext, phase: StatusPhase = "ready"): void {
  if (!ctx.hasUI) return;

  if (!state.status) {
    ctx.ui.setStatus(STATUS_ID, undefined);
    return;
  }

  const theme = ctx.ui.theme;
  const working = phase === "working";
  const color = working ? "warning" : "success";
  const icon = theme.fg(color, working ? "⋯" : "◆");
  const label = theme.fg(color, working ? "working" : "ready");
  const model = theme.fg("accent", formatModelName(ctx.model?.id ?? "no model"));
  ctx.ui.setStatus(STATUS_ID, `${icon} ${label} ${theme.fg("dim", "·")} ${model}`);
}

function sanitizeSingleLine(value: string): string {
  return value.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

function statusValues(theme: Theme, statuses: ReadonlyMap<string, string>): string {
  return [...statuses.entries()]
    .filter(([id]) => id !== STATUS_ID)
    .map(([, value]) => sanitizeSingleLine(value))
    .filter(Boolean)
    .join(theme.fg("dim", " • "));
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
    const unsubscribe = footerData.onBranchChange(() => tui.requestRender());

    return {
      dispose: unsubscribe,
      invalidate() {},
      render(width: number): string[] {
        if (width <= 0) return [""];

        const usage = getUsage(ctx);
        const project = basename(ctx.cwd) || ctx.cwd;
        const branch = footerData.getGitBranch();
        const branchName = branch ?? "no git";
        const sessionName = sanitizeSingleLine(ctx.sessionManager.getSessionName() ?? "untitled");
        const model = formatModelName(ctx.model?.id ?? "no model");
        const context = ctx.getContextUsage();
        const contextWindow = context?.contextWindow ?? ctx.model?.contextWindow ?? 0;
        const contextPercent = context?.percent;
        const contextLabel = contextPercent === null || contextPercent === undefined
          ? "ctx ?"
          : `ctx ${contextPercent.toFixed(0)}%`;
        const contextColor = contextPercent !== null && contextPercent !== undefined && contextPercent > 90
          ? "error"
          : contextPercent !== null && contextPercent !== undefined && contextPercent > 70
            ? "warning"
            : "success";
        const separator = theme.fg("dim", " | ");
        const projectAndBranch = `${theme.fg("warning", project)} ${theme.fg("dim", "(")}${theme.fg("success", branchName)}${theme.fg("dim", ")")}`;
        const modelAndWindow = `${theme.fg("accent", model)} ${theme.fg("dim", `(${formatCount(contextWindow)} context)`)}`;
        const fullLeft = [projectAndBranch, modelAndWindow, theme.fg(contextColor, contextLabel)].join(separator);
        const fullRight = [
          theme.fg("accent", `↑${formatCount(usage.input)}`),
          theme.fg("success", `↓${formatCount(usage.output)}`),
          theme.fg("warning", `$${usage.cost.toFixed(3)}`),
        ].join(" ");
        const compactLeft = [projectAndBranch, theme.fg(contextColor, contextLabel)].join(separator);
        const firstLine = footerFits(width, fullLeft, fullRight)
          ? formatFooterLine(width, fullLeft, fullRight)
          : footerFits(width, compactLeft, fullRight)
            ? formatFooterLine(width, compactLeft, fullRight)
            : truncateToWidth(compactLeft, width, "");

        const session = `${theme.fg("dim", "session ")}${theme.fg("muted", sessionName)}`;
        const extras = statusValues(theme, footerData.getExtensionStatuses());
        const secondLine = extras && footerFits(width, session, extras)
          ? formatFooterLine(width, session, extras)
          : truncateToWidth(extras ? `${session}${separator}${extras}` : session, width, "");

        return [firstLine, secondLine];
      },
    };
  });
  footerInstalled = true;
}

function applyAll(ctx: ExtensionContext): void {
  applyIndicator(ctx);
  applyStatus(ctx);
  applyFooter(ctx);
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
    };
  }
  return saved;
}

function persistState(pi: ExtensionAPI): void {
  pi.appendEntry<PersistedState>(STATE_CUSTOM_TYPE, { ...state });
}

function restoreState(ctx: ExtensionContext): void {
  const saved = readPersistedState(ctx);
  state.indicator = saved?.indicator ?? false;
  state.status = saved?.status ?? false;
  state.footer = saved?.footer ?? false;
  applyAll(ctx);
}

function setFeature(pi: ExtensionAPI, ctx: ExtensionContext, feature: Feature, toggle: Toggle, persist = true): void {
  state[feature] = toggle === "on";
  if (feature === "indicator") applyIndicator(ctx);
  if (feature === "status") applyStatus(ctx);
  if (feature === "footer") applyFooter(ctx);
  if (persist) persistState(pi);
}

function reset(pi: ExtensionAPI, ctx: ExtensionContext): void {
  state.indicator = false;
  state.status = false;
  state.footer = false;
  applyAll(ctx);
  persistState(pi);
}

function statusLine(): string {
  return `indicator=${state.indicator ? "on" : "off"}, status=${state.status ? "on" : "off"}, footer=${state.footer ? "on" : "off"}`;
}

export default function everforestTui(pi: ExtensionAPI) {
  pi.registerCommand("everforest-tui", {
    description: "Toggle optional Everforest TUI polish: indicator, status, and compact footer.",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      const [feature, toggle] = args.trim().toLowerCase().split(/\s+/).filter(Boolean);

      if (!feature) {
        ctx.ui.notify(`Everforest TUI: ${statusLine()}. Usage: /everforest-tui [indicator|status|footer|all] [on|off], or /everforest-tui reset`, "info");
        return;
      }
      if (feature === "reset") {
        reset(pi, ctx);
        ctx.ui.notify("Everforest TUI enhancements reset", "info");
        return;
      }
      if (toggle !== "on" && toggle !== "off") {
        ctx.ui.notify("Usage: /everforest-tui [indicator|status|footer|all] [on|off]", "error");
        return;
      }
      if (feature === "all") {
        setFeature(pi, ctx, "indicator", toggle, false);
        setFeature(pi, ctx, "status", toggle, false);
        setFeature(pi, ctx, "footer", toggle, false);
        persistState(pi);
        ctx.ui.notify(`Everforest TUI enhancements ${toggle}`, "info");
        return;
      }
      if (feature !== "indicator" && feature !== "status" && feature !== "footer") {
        ctx.ui.notify("Unknown Everforest TUI feature. Use indicator, status, footer, all, or reset.", "error");
        return;
      }
      setFeature(pi, ctx, feature, toggle);
      ctx.ui.notify(`Everforest TUI ${feature} ${toggle}`, "info");
    },
  });

  pi.on("session_start", async (_event, ctx) => restoreState(ctx));
  pi.on("session_tree", async (_event, ctx) => restoreState(ctx));
  pi.on("turn_start", async (_event, ctx) => applyStatus(ctx, "working"));
  pi.on("turn_end", async (_event, ctx) => applyStatus(ctx, "ready"));
  pi.on("model_select", async (_event, ctx) => applyStatus(ctx));
  pi.on("thinking_level_select", async (_event, ctx) => applyStatus(ctx));
  pi.on("session_shutdown", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setStatus(STATUS_ID, undefined);
    if (indicatorInstalled) ctx.ui.setWorkingIndicator();
    if (footerInstalled) ctx.ui.setFooter(undefined);
    indicatorInstalled = false;
    footerInstalled = false;
  });
}
