import { createHash } from "node:crypto";
import { CANONICAL_LOCALE, loadMeta, localeFiles, missingKeys } from "./lib.ts";

const TRANSLATION_LABEL = {
    name: "translation",
    color: "0e8a16",
    description: "Auto-filed: a locale has fallen behind ru.json",
};

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!repo || !token) {
    console.error("GITHUB_REPOSITORY and GITHUB_TOKEN are required.");
    process.exit(1);
}

async function api(path: string, init: RequestInit = {}) {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            ...init.headers,
        },
    });

    if (!res.ok && res.status !== 404) {
        throw new Error(
            `${init.method ?? "GET"} ${path} -> ${res.status}: ${await res.text()}`,
        );
    }

    return res;
}

async function ensureLabel(label: {
    name: string;
    color: string;
    description: string;
}) {
    const existing = await api(`/labels/${encodeURIComponent(label.name)}`);
    if (existing.ok) return;

    await api("/labels", { method: "POST", body: JSON.stringify(label) });
}

function localeLabel(locale: string) {
    return {
        name: `lang:${locale}`,
        color: "5319e7",
        description: `${locale} locale`,
    };
}

function hashOf(keys: string[]) {
    return createHash("sha1")
        .update([...keys].sort().join("\n"))
        .digest("hex")
        .slice(0, 12);
}

function hashFromBody(body: string | null): string | null {
    return (
        body?.match(/<!-- pixelbattle-i18n:hash:([0-9a-f]+) -->/)?.[1] ?? null
    );
}

type Issue = {
    number: number;
    state: string;
    body: string | null;
    pull_request?: unknown;
};

async function findTrackingIssue(locale: string): Promise<Issue | null> {
    const res = await api(
        `/issues?labels=${TRANSLATION_LABEL.name},lang:${locale}&state=all&per_page=1&sort=created&direction=desc`,
    );
    const issues = (await res.json()) as Issue[];

    return issues.find((issue) => !issue.pull_request) ?? null;
}

async function run() {
    for (const file of localeFiles()) {
        const locale = file.replace(/\.json$/, "");
        if (locale === CANONICAL_LOCALE) continue;

        const missing = missingKeys(file);
        const meta = loadMeta(file);
        const label = localeLabel(locale);

        await ensureLabel(TRANSLATION_LABEL);
        await ensureLabel(label);

        const issue = await findTrackingIssue(locale);

        if (missing.length === 0) {
            if (issue && issue.state === "open") {
                await api(`/issues/${issue.number}/comments`, {
                    method: "POST",
                    body: JSON.stringify({
                        body: "All caught up with `ru.json` ✅",
                    }),
                });
                await api(`/issues/${issue.number}`, {
                    method: "PATCH",
                    body: JSON.stringify({ state: "closed" }),
                });
                console.log(`${locale}: caught up, closed #${issue.number}`);
            } else {
                console.log(`${locale}: caught up, nothing to do`);
            }
            continue;
        }

        const hash = hashOf(missing);
        const mentions = meta.maintainers.length
            ? meta.maintainers.map((handle) => `@${handle}`).join(" ")
            : null;
        const checklist = [...missing]
            .sort()
            .map((key) => `- [ ] \`${key}\``)
            .join("\n");
        const body = [
            `Locale **${locale}** is missing ${missing.length} translation${missing.length === 1 ? "" : "s"} present in \`${CANONICAL_LOCALE}.json\`:`,
            "",
            checklist,
            "",
            mentions
                ? `cc ${mentions}`
                : "_No maintainers listed in \`$meta.maintainers\` for this locale._",
            "",
            `<!-- pixelbattle-i18n:hash:${hash} -->`,
        ].join("\n");
        const title = `${locale}: ${missing.length} translation${missing.length === 1 ? "" : "s"} behind ${CANONICAL_LOCALE}.json`;

        if (!issue) {
            const created = await api("/issues", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    body,
                    labels: [TRANSLATION_LABEL.name, label.name],
                    assignees: meta.maintainers,
                }),
            });
            const { number } = (await created.json()) as { number: number };
            console.log(
                `${locale}: opened #${number} (${missing.length} missing)`,
            );
            continue;
        }

        if (hashFromBody(issue.body) === hash && issue.state === "open") {
            console.log(`${locale}: #${issue.number} already up to date`);
            continue;
        }

        await api(`/issues/${issue.number}`, {
            method: "PATCH",
            body: JSON.stringify({
                title,
                body,
                state: "open",
                assignees: meta.maintainers,
            }),
        });
        await api(`/issues/${issue.number}/comments`, {
            method: "POST",
            body: JSON.stringify({
                body: `\`ru.json\` changed - now ${missing.length} key${missing.length === 1 ? "" : "s"} missing.${mentions ? ` cc ${mentions}` : ""}`,
            }),
        });
        console.log(
            `${locale}: updated #${issue.number} (${missing.length} missing)`,
        );
    }
}

await run();
