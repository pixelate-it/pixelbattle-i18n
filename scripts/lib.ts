import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const I18N_DIR = join(import.meta.dirname, "..", "i18n");
// The reference structure for translation tooling (check-locales.ts,
// update-readme.ts, notify-maintainers.ts) - not the frontend's SOURCE_LOCALE
// (src/utils/i18n.ts), which stays "ru": that's the language the app is
// actually authored and shipped in by default. The two are decoupled on
// purpose - English is the more broadly readable reference for an open
// translation project, but nothing about which language the product runs in
// by default follows from that.
export const CANONICAL_LOCALE = "en";

export type Dictionary = { [key: string]: string | Dictionary };

export function flattenKeys(dict: Dictionary, prefix = ""): string[] {
    return Object.entries(dict).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;

        return typeof value === "string" ? [path] : flattenKeys(value, path);
    });
}

export function loadLocale(file: string): Dictionary {
    const parsed = JSON.parse(readFileSync(join(I18N_DIR, file), "utf-8"));
    const { $meta, ...domains } = parsed;

    return domains;
}

export type Meta = {
    language_name?: string;
    bcp47?: string;
    aliases?: string[];
    // GitHub handles, pinged (via @mention) when their locale falls behind
    // CANONICAL_LOCALE - see scripts/notify-maintainers.ts. Decentralized on purpose,
    // same as the rest of $meta: a locale's own file is the one place that
    // says who speaks for it, no separate registry to keep in sync.
    //
    // Required, even empty: a locale with nobody listed still needs `[]` on
    // record rather than a missing key, so an unmaintained locale is a fact
    // check-locales.ts can see instead of something loadMeta silently papers
    // over with a default.
    maintainers: string[];
};

export function loadMeta(file: string): Meta {
    const parsed = JSON.parse(readFileSync(join(I18N_DIR, file), "utf-8"));

    return parsed.$meta ?? {};
}

export function localeFiles(): string[] {
    return readdirSync(I18N_DIR).filter((file) => file.endsWith(".json"));
}

// Dot paths present in CANONICAL_LOCALE's file but absent from `file` - what
// that locale's maintainers still owe it. Doesn't flag extra/stale keys
// (check-locales.ts's job): notify-maintainers.ts only ever files an issue
// for work left to do.
export function missingKeys(file: string): string[] {
    const canonicalKeys = flattenKeys(loadLocale(`${CANONICAL_LOCALE}.json`));
    const keys = new Set(flattenKeys(loadLocale(file)));

    return canonicalKeys.filter((key) => !keys.has(key));
}
