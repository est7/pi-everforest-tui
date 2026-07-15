import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "themes");
const schema = "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json";

const palettes = {
  dark: {
    base: "#323d43",
    mantle: "#2d353b",
    surface0: "#3a464c",
    surface1: "#434f55",
    surface2: "#4b565c",
    text: "#d3c6aa",
    subtext1: "#c3bea9",
    subtext0: "#b0b5a4",
    overlay: "#a7afa3",
    red: "#e67e80",
    orange: "#e69875",
    yellow: "#dbbc7f",
    green: "#a7c080",
    aqua: "#83c092",
    blue: "#7fbbb3",
    purple: "#d699b6",
    redBg: "#4b3f42",
    greenBg: "#3f4b43",
    blueBg: "#39464c"
  },
  light: {
    base: "#f8f0dc",
    mantle: "#f3ead3",
    surface0: "#eee7d2",
    surface1: "#e5dfc5",
    surface2: "#dfddc8",
    text: "#5c6a72",
    subtext1: "#5c6a72",
    subtext0: "#596a66",
    overlay: "#65756f",
    red: "#f85552",
    orange: "#f57d26",
    yellow: "#dfa000",
    green: "#8da101",
    aqua: "#35a77c",
    blue: "#3a94c5",
    purple: "#df69ba",
    redBg: "#f4e3df",
    greenBg: "#edf0df",
    blueBg: "#e7edf0"
  }
};

const colors = {
  accent: "aqua",
  border: "blue",
  borderAccent: "aqua",
  borderMuted: "surface2",
  success: "green",
  error: "red",
  warning: "yellow",
  muted: "subtext0",
  dim: "overlay",
  text: "text",
  thinkingText: "subtext1",
  selectedBg: "surface1",
  userMessageBg: "surface0",
  userMessageText: "text",
  customMessageBg: "mantle",
  customMessageText: "text",
  customMessageLabel: "purple",
  toolPendingBg: "blueBg",
  toolSuccessBg: "greenBg",
  toolErrorBg: "redBg",
  toolTitle: "blue",
  toolOutput: "subtext1",
  mdHeading: "yellow",
  mdLink: "blue",
  mdLinkUrl: "subtext0",
  mdCode: "aqua",
  mdCodeBlock: "green",
  mdCodeBlockBorder: "surface2",
  mdQuote: "subtext0",
  mdQuoteBorder: "surface2",
  mdHr: "surface2",
  mdListBullet: "aqua",
  toolDiffAdded: "green",
  toolDiffRemoved: "red",
  toolDiffContext: "subtext0",
  syntaxComment: "subtext0",
  syntaxKeyword: "red",
  syntaxFunction: "green",
  syntaxVariable: "blue",
  syntaxString: "aqua",
  syntaxNumber: "purple",
  syntaxType: "yellow",
  syntaxOperator: "orange",
  syntaxPunctuation: "text",
  thinkingOff: "surface2",
  thinkingMinimal: "overlay",
  thinkingLow: "blue",
  thinkingMedium: "aqua",
  thinkingHigh: "purple",
  thinkingXhigh: "red",
  thinkingMax: "orange",
  bashMode: "green"
};

await mkdir(outDir, { recursive: true });

for (const [flavor, vars] of Object.entries(palettes)) {
  const theme = {
    $schema: schema,
    name: `everforest-tui-${flavor}`,
    vars,
    colors,
    export: {
      pageBg: vars.base,
      cardBg: vars.mantle,
      infoBg: vars.surface0
    }
  };

  await writeFile(join(outDir, `${theme.name}.json`), `${JSON.stringify(theme, null, 2)}\n`);
}

console.log(`Generated ${Object.keys(palettes).length} Everforest Pi themes.`);
