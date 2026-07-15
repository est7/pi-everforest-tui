import assert from "node:assert/strict";
import test from "node:test";
import { buildCommandItems } from "../extensions/everforest-tui/command-center.ts";

test("builds a stable searchable command catalog and excludes recursive self-launch", () => {
	const items = buildCommandItems([
		{ name: "tasks", source: "extension", description: "Manage tasks" },
		{ name: "everforest", source: "extension", description: "Open center" },
		{ name: "review", source: "prompt", description: "Review changes" },
	]);
	assert.deepEqual(items, [
		{ value: "review", label: "/review", description: "prompt · Review changes" },
		{ value: "tasks", label: "/tasks", description: "extension · Manage tasks" },
	]);
});
