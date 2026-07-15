import {
	getSettingsListTheme,
	type ExtensionCommandContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@earendil-works/pi-tui";

export type TuiFeature = "indicator" | "status" | "footer" | "rainbow";
export type TuiFeatureState = Record<TuiFeature, boolean>;

const FEATURES: readonly TuiFeature[] = ["indicator", "status", "footer", "rainbow"];

function buildItems(state: TuiFeatureState): SettingItem[] {
	return FEATURES.map((feature) => ({
		id: feature,
		label: feature[0].toUpperCase() + feature.slice(1),
		description: {
			indicator: "Everforest animation shown while Pi is working.",
			status: "Working, thinking, and active-tool phases; idle remains quiet.",
			footer: "Responsive project, model, context, usage, and extension status cockpit.",
			rainbow: "Continuous editor border and named-session badge.",
		}[feature],
		currentValue: state[feature] ? "on" : "off",
		values: ["on", "off"],
	}));
}

export async function showSettingsOverlay(
	ctx: ExtensionCommandContext,
	state: TuiFeatureState,
	onChange: (feature: TuiFeature, enabled: boolean) => void,
): Promise<void> {
	await ctx.ui.custom<void>(
		(tui, theme: Theme, _keybindings, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((text) => theme.fg("borderAccent", text)));
			container.addChild(new Text(theme.fg("accent", theme.bold(" Everforest TUI Settings "))));
			const list = new SettingsList(
				buildItems(state),
				8,
				getSettingsListTheme(),
				(id, value) => {
					if (!FEATURES.includes(id as TuiFeature)) return;
					const feature = id as TuiFeature;
					list.updateValue(feature, value);
					if (feature === "rainbow") {
						done(undefined);
						setTimeout(() => onChange(feature, value === "on"), 0);
						return;
					}
					onChange(feature, value === "on");
					tui.requestRender();
				},
				() => done(undefined),
				{ enableSearch: false },
			);
			container.addChild(list);
			container.addChild(new DynamicBorder((text) => theme.fg("borderAccent", text)));
			return {
				render: (width: number) => container.render(width),
				invalidate: () => container.invalidate(),
				handleInput: (data: string) => list.handleInput(data),
			};
		},
		{
			overlay: true,
			overlayOptions: { anchor: "center", width: 72, minWidth: 46, maxHeight: 18 },
		},
	);
}
