import { truncateToWidth } from "@earendil-works/pi-tui";

// CSI sequences (colors, resets) and OSC sequences (hyperlinks, titles).
const ANSI_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

function stripAnsi(value: string): string {
	return value.replace(ANSI_PATTERN, "");
}

/**
 * Plain-text session name sized for the editor badge.
 *
 * The badge colors each character separately, so the label must contain no
 * escape sequences: `truncateToWidth` appends a `\x1b[0m` reset when it cuts,
 * and splitting that reset into characters leaks a visible `[0m`.
 */
export function sessionBadgeLabel(sessionName: string, maxWidth: number): string {
	return stripAnsi(truncateToWidth(stripAnsi(sessionName), maxWidth, ""));
}
