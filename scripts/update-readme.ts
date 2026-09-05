import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
    CANONICAL_LOCALE,
    flattenKeys,
    loadLocale,
    localeFiles,
} from "./lib.ts";

const README_PATH = join(import.meta.dirname, "..", "README.md");
const BADGES_DIR = join(import.meta.dirname, "..", "badges");
const START = "<!-- progress:start -->";
const END = "<!-- progress:end -->";
const BAR_WIDTH = 24;
const REPO = "pixelate-it/pixelbattle-i18n";
const BRANCH = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: import.meta.dirname,
    encoding: "utf-8",
}).trim();

// English name only, on purpose - $meta.language_name is the endonym (for
// the in-app language switcher), a different thing from labelling a language
// in a document written in English. Add an entry here alongside a new locale.
const LANGUAGE_NAMES: Record<string, string> = {
    ru: "Russian",
    en: "English",
};

function textBar(fraction: number): string {
    const filled = Math.round(fraction * BAR_WIDTH);

    return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

function barColor(fraction: number): string {
    if (fraction >= 1) return "#3fb950";
    if (fraction >= 0.5) return "#d29922";

    return "#f85149";
}

function shieldColor(fraction: number): string {
    if (fraction >= 1) return "brightgreen";
    if (fraction >= 0.5) return "yellow";

    return "red";
}

function svgBadge(name: string, percent: number, fraction: number): string {
    const width = 320;
    const trackX = 130;
    const trackWidth = width - trackX - 50;
    const filledWidth = Math.round(trackWidth * fraction);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="24" role="img" aria-label="${name}: ${percent}%">
    <rect width="${width}" height="24" rx="4" fill="#161b22"/>
    <text x="10" y="16" font-family="-apple-system,Segoe UI,sans-serif" font-size="12" fill="#c9d1d9">${name}</text>
    <rect x="${trackX}" y="6" width="${trackWidth}" height="12" rx="6" fill="#30363d"/>
    <rect x="${trackX}" y="6" width="${filledWidth}" height="12" rx="6" fill="${barColor(fraction)}"/>
    <text x="${width - 10}" y="16" font-family="-apple-system,Segoe UI,sans-serif" font-size="12" fill="#c9d1d9" text-anchor="end">${percent}%</text>
</svg>
`;
}

const files = localeFiles();
const canonicalFile = `${CANONICAL_LOCALE}.json`;
const canonicalKeys = new Set(flattenKeys(loadLocale(canonicalFile)));

const rows = files
    .map((file) => {
        const locale = file.replace(/\.json$/, "");
        const keys = new Set(flattenKeys(loadLocale(file)));
        // Capped at the canonical set: a stale/extra key (caught separately
        // by check-locales.ts) shouldn't be able to push a locale past 100%.
        const translated = [...canonicalKeys].filter((key) =>
            keys.has(key),
        ).length;
        const fraction =
            canonicalKeys.size === 0 ? 1 : translated / canonicalKeys.size;
        const name = LANGUAGE_NAMES[locale] ?? locale;

        return { locale, name, translated, fraction };
    })
    .sort((a, b) =>
        a.locale === CANONICAL_LOCALE ? -1 : b.fraction - a.fraction,
    );

mkdirSync(BADGES_DIR, { recursive: true });

const width = Math.max(...rows.map((r) => r.name.length));
const textLines = rows.map(({ locale, name, translated, fraction }) => {
    const percent = Math.round(fraction * 100);

    return `${name.padEnd(width)}  ${textBar(fraction)}  ${String(percent).padStart(3)}%  (${translated}/${canonicalKeys.size})  [${locale}]`;
});

const imageLines = rows.map(({ locale, name, fraction }) => {
    const percent = Math.round(fraction * 100);

    writeFileSync(
        join(BADGES_DIR, `${locale}.svg`),
        svgBadge(name, percent, fraction),
    );

    return `![${name}](badges/${locale}.svg)`;
});

// shields.io's "endpoint" badge: shields.io renders the actual pixels, from
// this tiny JSON (its documented schema) rather than an image this script
// drew itself. Fetched fresh (briefly cached) from the raw file on whatever
// branch this ran on - repoints itself once this branch merges to main.
const shieldLines = rows.map(({ locale, name, fraction }) => {
    const percent = Math.round(fraction * 100);

    writeFileSync(
        join(BADGES_DIR, `${locale}.shield.json`),
        JSON.stringify(
            {
                schemaVersion: 1,
                label: name,
                message: `${percent}%`,
                color: shieldColor(fraction),
            },
            null,
            4,
        ) + "\n",
    );

    const rawUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/badges/${locale}.shield.json`;

    return `![${name}](https://img.shields.io/endpoint?url=${encodeURIComponent(rawUrl)})`;
});

// Blank lines around the fence/images match prettier's markdown formatting,
// so regenerating doesn't leave a diff for `prettier --check` to complain
// about.
const section = [
    START,
    "",
    "```",
    ...textLines,
    "```",
    "",
    imageLines.join(" "),
    "",
    shieldLines.join(" "),
    "",
    END,
].join("\n");

const readme = readFileSync(README_PATH, "utf-8");
const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);

if (!pattern.test(readme)) {
    console.error(`Couldn't find ${START} / ${END} markers in README.md`);
    process.exit(1);
}

writeFileSync(README_PATH, readme.replace(pattern, section));
console.log(`README.md and ${rows.length} badge(s) updated.`);
