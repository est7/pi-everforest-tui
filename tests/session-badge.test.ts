import assert from "node:assert/strict";
import test from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import { sessionBadgeLabel } from "../extensions/everforest-tui/session-badge.ts";

const ESC = "\x1b";

test("keeps a short session name unchanged", () => {
	assert.equal(sessionBadgeLabel("short", 24), "short");
});

test("truncates a long name without leaking ANSI escapes", () => {
	const label = sessionBadgeLabel("排查 pi 启动时 herdr-amq-adapter 冲突", 22);
	assert.equal(label.includes(ESC), false);
	assert.equal(label.includes("[0m"), false);
	assert.ok(visibleWidth(label) <= 22);
	assert.ok(label.startsWith("排查 pi 启动时 herdr-a"));
});

test("strips escapes already present in the session name", () => {
	assert.equal(sessionBadgeLabel(`${ESC}[31mred${ESC}[0m`, 24), "red");
});
