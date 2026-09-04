import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const I18N_DIR = join(import.meta.dir, "..", "i18n");
const CANONICAL_LOCALE = "ru";

type Dictionary = { [key: string]: string | Dictionary };

function flattenKeys(dict: Dictionary, prefix = ""): string[] {
    return Object.entries(dict).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;

        return typeof value === "string"
            ? [path]
            : flattenKeys(value, path);
    });
}

function loadLocale(file: string): Dictionary {
    const parsed = JSON.parse(readFileSync(join(I18N_DIR, file), "utf-8"));
    const { $meta, ...domains } = parsed;

    return domains;
}

const localeFiles = readdirSync(I18N_DIR).filter((file) => file.endsWith(".json"));
const canonicalFile = `${CANONICAL_LOCALE}.json`;

if (!localeFiles.includes(canonicalFile)) {
    console.error(`Canonical locale file ${canonicalFile} not found in ${I18N_DIR}`);
    process.exit(1);
}

const canonicalKeys = new Set(flattenKeys(loadLocale(canonicalFile)));
let hasMismatch = false;

for (const file of localeFiles) {
    if (file === canonicalFile) continue;

    const locale = file.replace(/\.json$/, "");
    const keys = new Set(flattenKeys(loadLocale(file)));

    const missing = [...canonicalKeys].filter((key) => !keys.has(key));
    const extra = [...keys].filter((key) => !canonicalKeys.has(key));

    if (missing.length === 0 && extra.length === 0) continue;

    hasMismatch = true;
    console.error(`\n${locale}:`);
    if (missing.length) {
        console.error(`  missing (present in ${CANONICAL_LOCALE}, absent here):`);
        for (const key of missing) console.error(`    - ${key}`);
    }
    if (extra.length) {
        console.error(`  extra (absent in ${CANONICAL_LOCALE}, stale here):`);
        for (const key of extra) console.error(`    - ${key}`);
    }
}

if (hasMismatch) {
    console.error("\nLocale check failed.");
    process.exit(1);
}

console.log(`Locale check passed (${localeFiles.length} locales, ${canonicalKeys.size} keys).`);
