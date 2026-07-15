import assert from "node:assert/strict";
import test from "node:test";
import { statusForWorkingSnapshot, WorkingPhaseTracker } from "../extensions/everforest-tui/working-phase.ts";

test("tracks thinking and concurrent tools without double-counting tool ids", () => {
	const tracker = new WorkingPhaseTracker();
	tracker.startTurn();
	assert.deepEqual(tracker.getSnapshot(), { phase: "active" });

	tracker.setThinking(true);
	assert.deepEqual(tracker.getSnapshot(), { phase: "thinking" });
	tracker.setThinking(false);

	tracker.openTool("call-1", "read");
	tracker.openTool("call-1", "read duplicate");
	tracker.openTool("call-2", "bash");
	assert.deepEqual(tracker.getSnapshot(), { phase: "toolUse", toolName: "bash" });

	tracker.closeTool("call-2");
	assert.deepEqual(tracker.getSnapshot(), { phase: "toolUse", toolName: "read" });
	tracker.closeTool("call-1");
	assert.deepEqual(tracker.getSnapshot(), { phase: "active" });
});

test("keeps idle status silent and active status free of duplicate model metadata", () => {
	assert.equal(statusForWorkingSnapshot({ phase: "idle" }), undefined);
	assert.deepEqual(statusForWorkingSnapshot({ phase: "active" }), {
		color: "warning",
		icon: "⋯",
		label: "working",
	});
	assert.deepEqual(statusForWorkingSnapshot({ phase: "toolUse", toolName: "bash" }), {
		color: "accent",
		icon: "◆",
		label: "bash",
	});
});

test("ignores late tool and thinking events after the turn ends", () => {
	const tracker = new WorkingPhaseTracker();
	tracker.startTurn();
	tracker.openTool("call-1", "edit");
	tracker.endTurn();
	tracker.openTool("late", "bash");
	tracker.setThinking(true);
	assert.deepEqual(tracker.getSnapshot(), { phase: "idle" });
});
