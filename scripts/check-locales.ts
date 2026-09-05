import {
    CANONICAL_LOCALE,
    flattenKeys,
    loadLocale,
    localeFiles,
} from "./lib.ts";

const files = localeFiles();
const canonicalFile = `${CANONICAL_LOCALE}.json`;

if (!files.includes(canonicalFile)) {
    console.error(`Canonical locale file ${canonicalFile} not found`);
    process.exit(1);
}

const canonicalKeys = new Set(flattenKeys(loadLocale(canonicalFile)));
let hasMismatch = false;

for (const file of files) {
    if (file === canonicalFile) continue;

    const locale = file.replace(/\.json$/, "");
    const keys = new Set(flattenKeys(loadLocale(file)));

    const missing = [...canonicalKeys].filter((key) => !keys.has(key));
    const extra = [...keys].filter((key) => !canonicalKeys.has(key));

    if (missing.length === 0 && extra.length === 0) continue;

    hasMismatch = true;
    console.error(`\n${locale}:`);
    if (missing.length) {
        console.error(
            `  missing (present in ${CANONICAL_LOCALE}, absent here):`,
        );
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

console.log(
    `Locale check passed (${files.length} locales, ${canonicalKeys.size} keys).`,
);
