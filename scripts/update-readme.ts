import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
    CANONICAL_LOCALE,
    flattenKeys,
    loadLocale,
    localeFiles,
} from "./lib.ts";

const README_PATH = join(import.meta.dirname, "..", "README.md");
const START = "<!-- progress:start -->";
const END = "<!-- progress:end -->";
const BAR_WIDTH = 24;

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

const width = Math.max(...rows.map((r) => r.name.length));
const lines = rows.map(({ locale, name, translated, fraction }) => {
    const percent = Math.round(fraction * 100);

    return `${name.padEnd(width)}  ${textBar(fraction)}  ${String(percent).padStart(3)}%  (${translated}/${canonicalKeys.size})  [${locale}]`;
});

// Blank lines around the fence match prettier's markdown formatting, so
// regenerating doesn't leave a diff for `prettier --check` to complain about.
const section = [START, "", "```", ...lines, "```", "", END].join("\n");

const readme = readFileSync(README_PATH, "utf-8");
const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);

if (!pattern.test(readme)) {
    console.error(`Couldn't find ${START} / ${END} markers in README.md`);
    process.exit(1);
}

writeFileSync(README_PATH, readme.replace(pattern, section));
console.log(`README.md updated (${rows.length} locales).`);
