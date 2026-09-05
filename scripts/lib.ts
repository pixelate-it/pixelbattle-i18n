import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const I18N_DIR = join(import.meta.dirname, "..", "i18n");
export const CANONICAL_LOCALE = "ru";

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

export function loadMeta(file: string): { language_name?: string } {
    const parsed = JSON.parse(readFileSync(join(I18N_DIR, file), "utf-8"));

    return parsed.$meta ?? {};
}

export function localeFiles(): string[] {
    return readdirSync(I18N_DIR).filter((file) => file.endsWith(".json"));
}
