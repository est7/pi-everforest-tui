import assert from "node:assert/strict";
import test from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import { layoutFooterStatuses, placeFooterStatuses } from "../extensions/everforest-tui/status-layout.ts";

const segments = [
	{ id: "everforest", text: "◆ ready" },
	{ id: "goal", text: "goal active 3m" },
	{ id: "workflow", text: "workflow phase 2" },
];

test("renders every semantic status when the line fits", () => {
	assert.equal(
		layoutFooterStatuses(segments, 80, " • "),
		"◆ ready • goal active 3m • workflow phase 2",
	);
});

test("drops whole tail statuses and reports the hidden count", () => {
	const rendered = layoutFooterStatuses(segments, 25, " • ");
	assert.equal(rendered, "◆ ready … +2");
	assert.ok(visibleWidth(rendered) <= 25);
});

test("never exceeds a very narrow width", () => {
	const rendered = layoutFooterStatuses(segments, 5, " • ");
	assert.ok(visibleWidth(rendered) <= 5);
});

test("places statuses inline only when every segment fits the center budget", () => {
	assert.deepEqual(placeFooterStatuses(segments.slice(0, 1), 20, 80, " • "), {
		inline: "◆ ready",
		overflow: "",
	});
	assert.deepEqual(placeFooterStatuses(segments, 10, 25, " • "), {
		inline: "",
		overflow: "◆ ready … +2",
	});
});
