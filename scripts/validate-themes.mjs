import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const themesDir = join(root, "themes");
const requiredTokens = [
  "accent", "border", "borderAccent", "borderMuted", "success", "error", "warning", "muted", "dim", "text",
  "thinkingText", "selectedBg", "userMessageBg", "userMessageText", "customMessageBg", "customMessageText",
  "customMessageLabel", "toolPendingBg", "toolSuccessBg", "toolErrorBg", "toolTitle", "toolOutput", "mdHeading",
  "mdLink", "mdLinkUrl", "mdCode", "mdCodeBlock", "mdCodeBlockBorder", "mdQuote", "mdQuoteBorder", "mdHr",
  "mdListBullet", "toolDiffAdded", "toolDiffRemoved", "toolDiffContext", "syntaxComment", "syntaxKeyword",
  "syntaxFunction", "syntaxVariable", "syntaxString", "syntaxNumber", "syntaxType", "syntaxOperator", "syntaxPunctuation",
  "thinkingOff", "thinkingMinimal", "thinkingLow", "thinkingMedium", "thinkingHigh", "thinkingXhigh", "bashMode"
];
const optionalTokens = ["thinkingMax"];
const requiredNames = new Set(["everforest-tui-dark", "everforest-tui-light"]);
const allowedTokens = new Set([...requiredTokens, ...optionalTokens]);
const hexPattern = /^#[0-9a-fA-F]{6}$/;
const minimumContrast = {
  text: 4.5,
  subtext1: 4.5,
  subtext0: 4.5,
  overlay: 4.0,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function validateColor(value, vars, location) {
  if (value === "") return;
  if (typeof value === "number") {
    assert(Number.isInteger(value) && value >= 0 && value <= 255, `${location} must be a 256-color integer`);
    return;
  }
  assert(typeof value === "string", `${location} must be a string or integer`);
  if (hexPattern.test(value)) return;
  assert(Object.hasOwn(vars, value), `${location} references unknown variable "${value}"`);
}

const files = (await readdir(themesDir)).filter((file) => file.endsWith(".json")).sort();
assert(files.length === requiredNames.size, `Expected ${requiredNames.size} theme files, found ${files.length}`);
const seenNames = new Set();

for (const file of files) {
  const theme = JSON.parse(await readFile(join(themesDir, file), "utf8"));
  assert(typeof theme.name === "string" && requiredNames.has(theme.name), `${file} has unexpected theme name`);
  assert(!seenNames.has(theme.name), `${file} duplicates theme name ${theme.name}`);
  seenNames.add(theme.name);
  assert(theme.vars && typeof theme.vars === "object", `${file} is missing vars`);
  for (const [name, value] of Object.entries(theme.vars)) {
    assert(typeof value === "string" && hexPattern.test(value), `${file} var ${name} must be a 6-digit hex color`);
  }
  for (const [name, minimum] of Object.entries(minimumContrast)) {
    assert(Object.hasOwn(theme.vars, name), `${file} is missing contrast-checked var ${name}`);
    const ratio = contrastRatio(theme.vars.base, theme.vars[name]);
    assert(ratio >= minimum, `${file} var ${name} contrast ${ratio.toFixed(2)} is below ${minimum}`);
  }
  assert(theme.colors && typeof theme.colors === "object", `${file} is missing colors`);
  const keys = Object.keys(theme.colors);
  const missing = requiredTokens.filter((token) => !Object.hasOwn(theme.colors, token));
  const extra = keys.filter((token) => !allowedTokens.has(token));
  assert(missing.length === 0, `${file} missing tokens: ${missing.join(", ")}`);
  assert(extra.length === 0, `${file} has unknown tokens: ${extra.join(", ")}`);
  for (const token of keys) validateColor(theme.colors[token], theme.vars, `${file} colors.${token}`);
  if (theme.export !== undefined) {
    for (const key of ["pageBg", "cardBg", "infoBg"]) {
      if (theme.export[key] !== undefined) validateColor(theme.export[key], theme.vars, `${file} export.${key}`);
    }
  }
}

for (const name of requiredNames) assert(seenNames.has(name), `Missing theme ${name}`);
console.log(`Validated ${files.length} themes with all required Pi color tokens.`);
