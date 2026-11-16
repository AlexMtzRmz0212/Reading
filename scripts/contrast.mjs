// WCAG contrast of every text pair in the palette, light and dark. Reads the tokens from globals.css.
//   node scripts/contrast.mjs        exits 1 when a pair is under AA (4.5:1 for text)
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const tokens = (block) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)")));
const dark = { ...light, ...tokens(css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf("@theme inline"))) };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

// [text, surface]: every combination the UI actually sets.
const PAIRS = [
  ["ink", "ground"], ["ink", "card"], ["ink", "manila"],
  ["soft", "ground"], ["soft", "card"],
  ["red", "card"], ["red", "ground"],
  ["stamp", "card"], ["stamp", "ground"], ["on-stamp", "stamp"],
  ["pencil", "card"],
  ["on-oak", "oak"],
];

let failed = 0;
for (const [name, theme] of [["light", light], ["dark", dark]]) {
  console.log(name);
  for (const [fg, bg] of PAIRS) {
    const r = ratio(theme[fg], theme[bg]);
    if (r < 4.5) failed++;
    console.log(`  ${r < 4.5 ? "FAIL" : " ok "}  ${r.toFixed(2).padStart(5)}  ${fg} on ${bg}`);
  }
}
process.exit(failed ? 1 : 0);
