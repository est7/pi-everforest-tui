import type { ExtensionCommandContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const PALETTE: readonly ThemeColor[] = [
	"accent", "success", "warning", "error", "muted", "dim", "mdHeading", "mdLink",
];

function labLines(theme: Theme): string[] {
	const swatches = PALETTE.map((color) => theme.fg(color, `● ${color}`));
	return [
		theme.fg("accent", theme.bold(` EVERFOREST THEME LAB · ${theme.name ?? "active theme"} `)),
		"",
		theme.fg("mdHeading", theme.bold("Palette")),
		...swatches.reduce<string[]>((rows, item, index) => {
			if (index % 4 === 0) rows.push(item);
			else rows[rows.length - 1] += `   ${item}`;
			return rows;
		}, []),
		"",
		theme.fg("mdHeading", theme.bold("Typography & Markdown")),
		`${theme.fg("text", "Primary text")}  ${theme.fg("muted", "Secondary text")}  ${theme.fg("dim", "Tertiary text")}`,
		`${theme.fg("mdListBullet", "•")} list item  ${theme.fg("mdLink", "Everforest link")} ${theme.fg("mdLinkUrl", "https://pi.dev")}`,
		`${theme.fg("mdQuoteBorder", "│")} ${theme.fg("mdQuote", "A restrained interface stays quiet until it matters.")}`,
		`  ${theme.fg("mdCode", "const forest = await grow();")}`,
		"",
		theme.fg("mdHeading", theme.bold("Tool & Diff States")),
		theme.bg("toolPendingBg", theme.fg("toolTitle", " pending ")) + "  " +
			theme.bg("toolSuccessBg", theme.fg("success", " success ")) + "  " +
			theme.bg("toolErrorBg", theme.fg("error", " error ")),
		theme.fg("toolDiffAdded", "+ added line"),
		theme.fg("toolDiffRemoved", "- removed line"),
		theme.fg("toolDiffContext", "  context line"),
		"",
		theme.fg("mdHeading", theme.bold("Syntax & Thinking")),
		`${theme.fg("syntaxKeyword", "function")} ${theme.fg("syntaxFunction", "render")}(${theme.fg("syntaxVariable", "width")}: ${theme.fg("syntaxType", "number")}) ${theme.fg("syntaxOperator", "=>")} ${theme.fg("syntaxString", '"forest"')}`,
		[
			["off", "thinkingOff"], ["low", "thinkingLow"], ["medium", "thinkingMedium"],
			["high", "thinkingHigh"], ["xhigh", "thinkingXhigh"], ["max", "thinkingMax"],
		].map(([label, color]) => theme.fg(color as ThemeColor, `● ${label}`)).join("  "),
		"",
		theme.fg("dim", `color mode: ${theme.getColorMode()} · esc/q close`),
	];
}

export async function showThemeLab(ctx: ExtensionCommandContext): Promise<void> {
	await ctx.ui.custom<void>(
		(_tui, theme, _keybindings, done) => ({
			render(width: number) {
				const border = theme.fg("borderAccent", "─".repeat(width));
				return [border, ...labLines(theme), border].map((line) => {
					const clipped = truncateToWidth(line, width, "");
					return `${clipped}${" ".repeat(Math.max(0, width - visibleWidth(clipped)))}`;
				});
			},
			invalidate() {},
			handleInput(data: string) {
				if (matchesKey(data, Key.escape) || data === "q") done(undefined);
			},
		}),
		{
			overlay: true,
			overlayOptions: { anchor: "center", width: "78%", minWidth: 58, maxHeight: "86%" },
		},
	);
}
