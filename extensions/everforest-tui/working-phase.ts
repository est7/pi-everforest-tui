/**
 * Phase tracking adapted from the toolCallId-based coordinator in
 * @aphotic/pi-flow-ux@0.10.0 (MIT). This implementation retains only the
 * lifecycle state model; presentation remains owned by pi-everforest-tui.
 */

export type WorkingPhase = "idle" | "active" | "thinking" | "toolUse";

export interface WorkingSnapshot {
	phase: WorkingPhase;
	toolName?: string;
}

export interface WorkingStatusPresentation {
	color: "accent" | "warning";
	icon: string;
	label: string;
}

/** Idle is intentionally silent: the footer already communicates model/session readiness. */
export function statusForWorkingSnapshot(snapshot: WorkingSnapshot): WorkingStatusPresentation | undefined {
	if (snapshot.phase === "idle") return undefined;
	if (snapshot.phase === "thinking") return { color: "warning", icon: "◌", label: "thinking" };
	if (snapshot.phase === "toolUse") return { color: "accent", icon: "◆", label: snapshot.toolName ?? "tool" };
	return { color: "warning", icon: "⋯", label: "working" };
}

export class WorkingPhaseTracker {
	private activeTurn = false;
	private thinking = false;
	private readonly tools = new Map<string, string>();
	private readonly listeners = new Set<(snapshot: WorkingSnapshot) => void>();

	getSnapshot(): WorkingSnapshot {
		if (!this.activeTurn) return { phase: "idle" };
		if (this.thinking) return { phase: "thinking" };
		const toolName = [...this.tools.values()].at(-1);
		return toolName ? { phase: "toolUse", toolName } : { phase: "active" };
	}

	subscribe(listener: (snapshot: WorkingSnapshot) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	startTurn(): void {
		this.activeTurn = true;
		this.thinking = false;
		this.tools.clear();
		this.emit();
	}

	setThinking(thinking: boolean): void {
		if (!this.activeTurn || this.thinking === thinking) return;
		this.thinking = thinking;
		this.emit();
	}

	openTool(toolCallId: string | undefined, toolName: string | undefined): void {
		if (!this.activeTurn || !toolCallId || this.tools.has(toolCallId)) return;
		this.tools.set(toolCallId, toolName?.trim() || "tool");
		this.emit();
	}

	closeTool(toolCallId: string | undefined): void {
		if (!toolCallId || !this.tools.delete(toolCallId)) return;
		this.emit();
	}

	endTurn(): void {
		this.activeTurn = false;
		this.thinking = false;
		this.tools.clear();
		this.emit();
	}

	private emit(): void {
		const snapshot = this.getSnapshot();
		for (const listener of [...this.listeners]) {
			try {
				listener(snapshot);
			} catch {
				// UI listeners are isolated so presentation failure cannot interrupt agent events.
			}
		}
	}
}
