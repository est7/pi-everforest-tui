import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export interface FooterStatusSegment {
	id: string;
	text: string;
}

export interface FooterStatusPlacement {
	inline: string;
	overflow: string;
}

export function placeFooterStatuses(
	segments: readonly FooterStatusSegment[],
	inlineWidth: number,
	lineWidth: number,
	separator: string,
): FooterStatusPlacement {
	const full = segments.map((segment) => segment.text).filter(Boolean).join(separator);
	if (full && visibleWidth(full) <= inlineWidth) return { inline: full, overflow: "" };
	return { inline: "", overflow: layoutFooterStatuses(segments, lineWidth, separator) };
}

/** Keep extension statuses as whole semantic segments and drop low-priority tails before truncating text. */
export function layoutFooterStatuses(
	segments: readonly FooterStatusSegment[],
	width: number,
	separator: string,
): string {
	if (width <= 0 || segments.length === 0) return "";
	const texts = segments.map((segment) => segment.text).filter(Boolean);
	if (texts.length === 0) return "";

	const full = texts.join(separator);
	if (visibleWidth(full) <= width) return full;

	const kept: string[] = [];
	for (let index = 0; index < texts.length; index += 1) {
		const hidden = texts.length - index - 1;
		const hiddenLabel = hidden > 0 ? ` … +${hidden}` : "";
		const candidate = [...kept, texts[index]].join(separator) + hiddenLabel;
		if (visibleWidth(candidate) <= width) {
			kept.push(texts[index]);
			continue;
		}
		break;
	}

	if (kept.length === texts.length) return kept.join(separator);
	const hidden = texts.length - kept.length;
	const hiddenLabel = ` … +${hidden}`;
	const available = Math.max(0, width - visibleWidth(hiddenLabel));
	if (kept.length === 0) {
		return truncateToWidth(texts[0], width, "");
	}
	return `${truncateToWidth(kept.join(separator), available, "")}${hiddenLabel}`;
}
