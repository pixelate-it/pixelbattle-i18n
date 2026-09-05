# pixelbattle-i18n

PixelBattle locales, consumed by the frontend as a git submodule at `i18n/`.

## Structure

```
i18n/
  ru.json   # canonical - source of truth. Every key here must exist in every other locale.
  en.json
```

Each file is a nested object. Top-level keys are domains (feature/component), and each domain holds flat strings. A string's key is its dot path, e.g. `about.section_title`.

The top-level `$meta` block holds locale metadata (date format, etc.), not translations - the completeness check ignores it entirely when comparing locales.

`$meta.aliases` in `ru.json` - BCP-47 language tags whose speakers should default to `ru` instead of the `en` fallback (read by the frontend's `detectLocale()`, via a static/eager import, not the lazy per-locale load). Currently `be`, `uk`.

`$meta.language_name` in each file - the endonym, the language's own name in itself ("Русский", "English"), used by the language switcher in settings. Read like any other key via `t("$meta.language_name")` - `resolveKey` doesn't special-case `$meta`, only `flattenKeys`/the completeness check exclude it from being treated as a translation.

## Adding a translation

1. Add the key to `i18n/ru.json` inside the right domain (or start a new domain - a new top-level key).
2. Add the same dot path to the other `i18n/*.json` files.
3. `yarn test` - confirms every locale has the same set of paths.

## Completeness check

```bash
yarn install
yarn typecheck
yarn test
```

`yarn test` compares the dot paths of every locale against `ru.json` (canonical). It fails if a locale is missing a translation, or still carries a key that no longer exists in `ru.json` (stale/extra). Both run in CI on every push/PR (`.github/workflows/check.yml`), targeting the same Node version as the frontend (`.github/workflows/check.yml`'s `NODE_VERSION`, kept in sync with pixelbattle-frontend's `.nvmrc`).
