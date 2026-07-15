import {
	DynamicBorder,
	type ExtensionAPI,
	type ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";

export interface CommandDescriptor {
	name: string;
	description?: string;
	source: "extension" | "prompt" | "skill";
}

export function buildCommandItems(commands: readonly CommandDescriptor[]): SelectItem[] {
	return commands
		.filter((command) => command.name !== "everforest")
		.map((command) => ({
			value: command.name,
			label: `/${command.name}`,
			description: [command.source, command.description].filter(Boolean).join(" · "),
		}))
		.sort((left, right) => left.label.localeCompare(right.label));
}

export async function showCommandCenter(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
	const items = buildCommandItems(pi.getCommands());
	if (items.length === 0) {
		ctx.ui.notify("No extension, prompt, or skill commands are loaded", "warning");
		return;
	}

	const selected = await ctx.ui.custom<string | undefined>(
		(_tui, theme, _keybindings, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((text) => theme.fg("borderAccent", text)));
			container.addChild(new Text(theme.fg("accent", theme.bold(" Everforest Command Center "))));
			const list = new SelectList(items, Math.min(12, items.length), {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});
			list.onSelect = (item) => done(item.value);
			list.onCancel = () => done(undefined);
			container.addChild(list);
			container.addChild(new Text(theme.fg("dim", " type to filter · enter insert · esc close ")));
			container.addChild(new DynamicBorder((text) => theme.fg("borderAccent", text)));
			return {
				render: (width: number) => container.render(width),
				invalidate: () => container.invalidate(),
				handleInput: (data: string) => list.handleInput(data),
			};
		},
		{
			overlay: true,
			overlayOptions: { anchor: "center", width: "72%", minWidth: 48, maxHeight: "78%" },
		},
	);
	if (!selected) return;

	const commandText = `/${selected} `;
	const existing = ctx.ui.getEditorText();
	if (existing.trim()) {
		const replace = await ctx.ui.confirm(
			"Replace editor contents?",
			`Insert ${commandText.trim()} and replace the current draft?`,
		);
		if (!replace) return;
	}
	ctx.ui.setEditorText(commandText);
}
