# 08 — Frontend (SvelteKit + TypeScript) Security & Quality Audit

## Executive summary

The IDAH frontend is a SvelteKit 5 + TypeScript application using a custom JSON:API data layer, a cookie-based auth flow (no tokens in `localStorage`), and a plugin system that dynamically loads annotation tooling. The codebase is generally well-typed and follows consistent patterns, but the audit surfaced **two critical security issues** that should be fixed before any production hardening: (1) the markdown preview renders `marked` output via `{@html}` with no sanitization, allowing stored XSS through any user-authored note or comment, and (2) the plugin loader interpolates a URL-derived `pluginId` directly into `<script src>` / `<link href>` tags, allowing an attacker to load arbitrary JavaScript in an authenticated victim's session. Beyond those, the audit found a handful of medium-severity issues around the auth/permission model (the `<Can>` and `PageProvider` components let a `roles` prop silently override the resource-level `can()` check; the data-source cache is not scoped to the authenticated account), several correctness bugs (`filtersToHash` crashes on duplicate keys, audit-logs enrichment is partially dead due to a typo'd switch key, `Object.assign` on a `Record` instance breaks reactivity), and a long tail of code-smell items (verbose `console.debug` in production paths, dead code, an unbounded recursive `list({ all: true })`). None of the medium/low findings are exploitable on their own, but several compound (e.g., the cache leak + the open redirect + the plugin loader form a credible session-takeover chain if combined with social engineering). Recommendations are scoped and prioritized in the per-finding sections below.

## Findings table

| ID | Severity | Category | File:Line | Title |
|----|----------|----------|-----------|-------|
| FE-001 | Low | Performance / CodeSmell | `src/lib/data/Cache.ts:53-60` | `runExpireCache()` setInterval never cleared |
| FE-002 | Low | Security | `src/lib/data/Cache.ts:25-37` | `clearCache` builds `RegExp` from cache key (ReDoS / regex injection) |
| FE-003 | Medium | CodeSmell / Robustness | `src/lib/data/BackendDataSource.ts:65-267` | `BackendDataSource` does not check `response.ok` for non-JSON error bodies |
| FE-004 | Medium | Performance | `src/lib/security/AuthContext.ts:137-180` | `AuthContext.can()` issues a network call per check (N+1) |
| FE-005 | Medium | CodeSmell / Architecture | `src/lib/security/can.svelte:24-37` | `<Can>` evaluates permissions only once on mount |
| FE-006 | Info | Architecture | `src/lib/security/AuthContext.ts:19-28` | Auth state stored in module-level singletons |
| FE-007 | High | Security | `src/routes/(auth)/login/+page.svelte:29,54-58` | Open redirect via unvalidated `redirectTo` query parameter |
| FE-008 | Critical | Security | `src/lib/components/app/markdown/markdown-preview.svelte:32-35` | XSS: `{@html}` renders `marked` output without sanitization |
| FE-009 | Medium | Security | `src/lib/plugin/layout/header/annotation-header-bar-tools.svelte:72-73` | `{@html icon}` renders plugin-supplied markup without sanitization |
| FE-010 | Medium | CodeSmell / Correctness | `src/lib/utils/uri.ts:43-63` | `filtersToHash` mutates a string as if it were an array (runtime crash) |
| FE-011 | Medium | Performance | `src/routes/(protected)/(app)/projects/[projectId]/datasets/[datasetId]/entries/+page.svelte:375-420` | Bulk delete / unassign are sequential N+1 HTTP requests |
| FE-012 | Low | CodeSmell / Robustness | `src/lib/data/model/json_api.ts:27-28,46-47` | `parseSingleElementReturn` throws the string `"TODO: Handle error output"` |
| FE-013 | Low | CodeSmell | `src/lib/utils/ast_resolution.ts` (multiple) | Verbose `console.log` / `console.debug` left in production code paths |
| FE-014 | Low | CodeSmell / Correctness | `src/lib/utils/delayed.ts:1-4` | `delayed()` ignores the inner promise's resolution window |
| FE-015 | Critical | Security | `src/routes/(protected)/entries/[entryId]/plugin/[pluginId]/+layout.svelte:13-24` | Plugin loader injects user-controlled `pluginId` into `<script src>` / `<link href>` |
| FE-016 | Medium | CodeSmell / TS quality | `src/lib/data/model/Record.ts:80-83` | `Record` base class uses `[key: string]: any` index signature |
| FE-017 | Low | Security | `src/routes/(public)/accept-invitation/+page.svelte:11-17` | Invitation / password-reset tokens passed via URL query string |
| FE-018 | Medium | CodeSmell / Correctness | `src/routes/(protected)/(app)/audit-logs/+page.svelte:41,50,75,125` | `audit-logs` page fetches `pciture_url` (typo) and uses mismatched switch key |
| FE-019 | Info | CodeSmell | `src/lib/data/model/iam/accounts/auth/records.ts:27` | `AuthService` interface parameter typo `passowrd` |
| FE-020 | Low | Architecture / CodeSmell | `src/routes/(protected)/(app)/projects/[projectId]/+layout.svelte:61-70` | `Object.assign(project, projectRes.data)` mutates a Record instance |
| FE-021 | Medium | Security / CodeSmell | `src/lib/components/app/page/page-provider.svelte:30-34` and `src/lib/security/can.svelte:32-37` | `roles` prop silently overrides `can()` result in `<Can>` / `PageProvider` |
| FE-022 | Medium | Performance / Robustness | `src/lib/data/BackendDataSource.ts:185-197` | `list({ all: true })` recurses without a safety bound |
| FE-023 | Medium | Security / Performance | `src/lib/data/BackendDataSource.ts:101-131,158-170` | Cache key ignores auth context (cross-user cache leak risk) |

---

## Per-finding details

### FE-001 — `runExpireCache()` setInterval never cleared (memory leak / global timer)
- **Category:** Performance / CodeSmell
- **Severity:** Low
- **File:** `idah/app/frontend/src/lib/data/Cache.ts:53-60`

**Description:** `runExpireCache()` is invoked at module load and starts a `setInterval` with a 10-second period that is never cleared. Because the module is a singleton in the browser, this is mostly benign in production, but in tests/SSR contexts the timer keeps the event loop alive and can cause memory leaks across HMR/module reloads in dev.

**Evidence:**
```ts
function runExpireCache() {
  setInterval(() => { clearExpireCache(); }, 10000);
}
runExpireCache();
```

**Recommendation:** Export start/stop functions, or guard with `import.meta.env.DEV` checks. At minimum, store the handle so it can be cleared in tests.

**Effort:** S

---

### FE-002 — `clearCache` uses `RegExp` built from user-controlled cacheKey (ReDoS / regex injection)
- **Category:** Security
- **Severity:** Low
- **File:** `idah/app/frontend/src/lib/data/Cache.ts:25-37`

**Description:** `clearCache` constructs `new RegExp(\`^${cacheKey}-\`)` from `cacheKey`. `cacheKey` ultimately derives from `basePath` (e.g. `/iam/accounts/...`). While currently controlled, any future caller passing user-derived IDs could inject regex metacharacters and either match unintended cache entries (clearing other users' caches) or trigger ReDoS.

**Evidence:**
```ts
const pattern = new RegExp(`^${cacheKey}-`);
for (const key in cacheList) {
  if (key.match(pattern)) { delete cacheList[key]; }
}
```

**Recommendation:** Use `String.prototype.startsWith(cacheKey + "-")` instead of regex.

**Effort:** S

---

### FE-003 — `BackendDataSource` does not check `response.ok` for non-error JSON bodies
- **Category:** CodeSmell / Robustness
- **Severity:** Medium
- **File:** `idah/app/frontend/src/lib/data/BackendDataSource.ts:65-267`

**Description:** `create`, `get`, `list`, `update` rely on `body.errors` to detect failures but never check `out.ok` / `out.status`. If the server returns a non-JSON body (e.g., 500 HTML error page, 502 from a proxy), `out.json()` throws an unhandled exception that bubbles up as an unstructured error. `delete` does check `response.ok` but the others don't.

**Evidence:**
```ts
const out = await fetch(this.basePath, { method: "POST", ... });
const body = await out.json();           // throws if body is HTML
if (body && body.errors) { ... }
```

**Recommendation:** Wrap with a helper that checks `!out.ok` first and parses JSON defensively (try/catch), producing a normalized error.

**Effort:** M

---

### FE-004 — `AuthContext.can()` performs a network call per check (N+1 / perf)
- **Category:** Performance
- **Severity:** Medium
- **File:** `idah/app/frontend/src/lib/security/AuthContext.ts:137-180`

**Description:** Every call to `can()` with an `as_user` scope fires `projectMembersBackendDataSource.list(...)`. The `<Can>` component calls `can()` inside `onMount` with no memoization, so each render of a list of permissioned UI elements can issue one HTTP request per item.

**Evidence:**
```ts
const projectMemberRes = await projectMembersBackendDataSource.list({
  filters: { project_id: projectId, account_id: this.id },
});
```

**Recommendation:** Cache the project-member lookup per `(projectId, accountId)` in the `AuthContext` (or in `ActionMap`), or pre-load role memberships at sign-in.

**Effort:** M

---

### FE-005 — `<Can>` component evaluates permissions only once on mount
- **Category:** CodeSmell / Architecture
- **Severity:** Medium
- **File:** `idah/app/frontend/src/lib/security/can.svelte:24-37`

**Description:** `onMount` runs once. If `authStatus` changes (login, role switch, project change) or `scopes`/`resource` props change, `hasAccess` is never recomputed. The component will keep showing/hiding content based on stale state.

Also, when `roles` is provided, the result of `await can(...)` is overwritten by a plain role-name check, ignoring the `action`/`resource`/`scopes` props entirely — likely a bug.

**Evidence:**
```ts
onMount(async () => {
  ...
  hasAccess = (await currentAccount?.can(action, resource, scopes)) || false;
  if (roles?.length) {
    hasAccess = roles.includes(currentAccount.roleName);  // overrides can()
  }
});
```

**Recommendation:** Use `$derived`/`$effect` keyed on `authStatus`, `action`, `resource`, `scopes`, and `roles`. Decide whether `roles` should AND/OR with the `can()` result.

**Effort:** M

---

### FE-006 — `AuthContext` stored in module-level state; no token visible but auth status is global mutable
- **Category:** Architecture
- **Severity:** Info
- **File:** `idah/app/frontend/src/lib/security/AuthContext.ts:19-28`

**Description:** `authStatus` writable and `currentAuthContext` are module-level singletons. This works but bypasses SvelteKit's `locals`/session model, making SSR-safe auth harder and tightly coupling the auth store to whatever module first imports it.

**Recommendation (info only):** Consider moving auth state into SvelteKit `locals`/`$page.data` so it integrates with SSR and `form` actions.

**Effort:** L

---

### FE-007 — Open redirect via unvalidated `redirectTo` query parameter
- **Category:** Security
- **Severity:** High
- **File:** `idah/app/frontend/src/routes/(auth)/login/+page.svelte:29,54-58`

**Description:** After successful login, the user is redirected to whatever value is in the `redirectTo` query parameter, defaulting to `/projects`. The value is taken straight from the URL with no validation and passed to `goto()`. An attacker can craft a phishing link like `/login?redirectTo=https://evil.example.com` (or `//evil.example.com`) that, depending on SvelteKit's `goto` behavior, may navigate the victim to an attacker-controlled site immediately after they authenticate.

**Evidence:**
```ts
let redirectTo = page.url.searchParams.get("redirectTo") || "/projects";
...
await AuthContext.signInWithEmailAndPassword(email, password)
  .then(() => {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(redirectTo);
  })
```

**Recommendation:** Validate that `redirectTo` is a same-origin relative path before navigating. Reject anything that starts with `//`, `http:`, `https:`, or contains a scheme. Example allow-list: `/^\/(?!\/|https?:).*/`.

**Effort:** S

---

### FE-008 — XSS: `{@html}` renders `marked` output without sanitization
- **Category:** Security
- **Severity:** Critical
- **File:** `idah/app/frontend/src/lib/components/app/markdown/markdown-preview.svelte:32-35`

**Description:** `marked.parse(text)` is rendered via `{@html}`. `marked` does **not** sanitize HTML by default — any HTML in the markdown input is emitted verbatim. If `value` originates from any user-controllable field (comments, descriptions, audit notes, etc.), an attacker can inject `<script>`, `<img onerror=...>`, or `<a href="javascript:...">` payloads that execute in the session of anyone viewing the markdown.

`marked` removed its built-in `sanitize` option in v4+; the maintainers explicitly recommend running output through **DOMPurify**.

**Evidence:**
```svelte
{@html parseMarkdown(value ?? "")}
```
```ts
function parseMarkdown(text: string): string {
  marked.setOptions({ renderer: new marked.Renderer(), gfm: true, breaks: true });
  return marked.parse(text).toString(); // no sanitization
}
```

**Recommendation:** Add `dompurify` and wrap output: `DOMPurify.sanitize(marked.parse(text).toString(), { USE_PROFILES: { html: true } })`. Alternatively, switch to a markdown parser that emits sanitized HTML by default.

**Effort:** S

---

### FE-009 — `{@html icon}` renders plugin-supplied markup without sanitization
- **Category:** Security
- **Severity:** Medium
- **File:** `idah/app/frontend/src/lib/plugin/layout/header/annotation-header-bar-tools.svelte:72-73`

**Description:** Toolbar items expose an `icon` field that is rendered via `{@html icon}`. The icon string comes from `driver.toolbar.mgr.getItemsForMode(...)` and ultimately from registered plugins. If plugins are loaded from untrusted sources (third-party plugin install, dynamic plugin loading), a malicious plugin can inject arbitrary HTML/JS into the annotation UI.

**Evidence:**
```svelte
{#each toolbarItems as { icon, label, name, onClick, visibleWhen, whenToggled }, toolIndex (toolIndex)}
  ...
  {@html icon}
```

**Recommendation:** Constrain `IToolbarItem.icon` to a structured type (e.g., `{ kind: 'lucide', name: string }` or an SVG-with-strict-allowlist) instead of a raw HTML string. If raw HTML must be supported, sanitize with DOMPurify before render and document the trust model for plugins.

**Effort:** M

---

### FE-010 — `filtersToHash` mutates a string as if it were an array (runtime crash)
- **Category:** CodeSmell / Correctness
- **Severity:** Medium
- **File:** `idah/app/frontend/src/lib/utils/uri.ts:43-63`

**Description:** When two filters map to the same key, the code branches on `out[key] instanceof Array`. If `out[key]` is a string (the first-inserted shape), it falls into the `if (out[key])` branch and calls `out[key].push(...)` on a string — which throws `TypeError: out[key].push is not a function`. The intended behavior was likely to convert the existing string into an array first.

**Evidence:**
```ts
if (out[key]) {
  if (!(out[key] instanceof Array)) {
    out[key].push(value.value);   // BUG: out[key] is a string here
  } else {
    out[key] = [out[key], value.value];
  }
}
```

**Recommendation:** Swap the branches — convert the existing scalar into an array, then push:
```ts
if (out[key] == null) out[key] = value.value;
else if (Array.isArray(out[key])) out[key].push(value.value);
else out[key] = [out[key], value.value];
```

**Effort:** S

---

### FE-011 — Bulk delete / unassign are sequential N+1 HTTP requests
- **Category:** Performance
- **Severity:** Medium
- **File:** `idah/app/frontend/src/routes/(protected)/(app)/projects/[projectId]/datasets/[datasetId]/entries/+page.svelte:375-420`

**Description:** `unAssignEntries()` and `deleteEntries()` loop over `selectedEntryIds` and issue one `PATCH`/`DELETE` per entry. For a 50-entry selection this is 50 sequential round-trips; the UI blocks until all complete and any partial failure leaves the dataset in an inconsistent UI state (only successful rows are removed).

**Evidence:**
```ts
for (const entryId of unAssignableEntryIds) {
  const entryRes = await entriesBackendDataSource.update(entryId, {
    attributes: { assigned_to_id: null },
  });
  ...
}
```

**Recommendation:** Add a batch endpoint (e.g., `POST /entries/bulk` accepting `{ action: 'unassign', ids: [...] }`) or use `Promise.all` for parallelism with proper error aggregation. At minimum, surface partial-failure state to the user.

**Effort:** M

---

### FE-012 — `parseSingleElementReturn` throws the string `"TODO: Handle error output"` on error responses
- **Category:** CodeSmell / Robustness
- **Severity:** Low
- **File:** `idah/app/frontend/src/lib/data/model/json_api.ts:27-28,46-47`

**Description:** Both parsers `throw "TODO: Handle error output"` (a bare string, not an `Error`) when `dataRaw.errors` is present. This is unreachable in the current `BackendDataSource` flow (errors are checked first), but any caller that forgets to pre-check will get an uncatchable string-throw with no stack trace.

**Evidence:**
```ts
if (dataRaw.errors) throw "TODO: Handle error output";
```

**Recommendation:** Throw a typed `JsonApiError` instance. Remove the TODO or implement the branch.

**Effort:** S

---

### FE-013 — Verbose `console.log` / `console.debug` left in production code paths
- **Category:** CodeSmell
- **Severity:** Low
- **File:** `idah/app/frontend/src/lib/utils/ast_resolution.ts:78,94,98,109,132,155,171,187,202,217,232,245,282,292` and `idah/app/frontend/src/lib/data/model/json_api.ts:88-90`

**Description:** The AST processor logs every operator evaluation at `debug`/`log` level, including potentially sensitive variable values. `json_api.ts` also logs relationship lookups. These will appear in the browser console for end users (and any extension that scrapes `console`).

**Evidence:**
```ts
console.debug({ op: "match", val1, val2, result: ... });
console.log({ k, v, type: typeof v });
```

**Recommendation:** Gate behind `import.meta.env.DEV`, or use a logger that respects a runtime level. Strip from production build via a Vite drop replacement.

**Effort:** S

---

### FE-014 — `delayed()` ignores the inner promise's resolution window
- **Category:** CodeSmell / Correctness
- **Severity:** Low
- **File:** `idah/app/frontend/src/lib/utils/delayed.ts:1-4`

**Description:** `delayed()` awaits a `setTimeout(() => {}, ms)` and *then* calls `realPromise()`. This guarantees a minimum delay but does not race the real promise against the timer — the total time is `ms + realPromise`. The unused inner `timeout` function is also dead code.

**Evidence:**
```ts
export const delayed = async <T>(ms: number, realPromise: () => Promise<T>) => {
  await setTimeout(() => {}, ms);   // returns a Timeout, not a Promise (TS accepts it via ambient)
  return realPromise();
};
```

**Recommendation:** Use `Promise.all([sleep(ms), realPromise()])` for a true minimum-delay semantic, or `Promise.race` for a maximum-delay semantic. Remove the dead `timeout` helper.

**Effort:** S

---

### FE-015 — Plugin loader injects user-controlled `pluginId` into `<script src>` and `<link href>`
- **Category:** Security
- **Severity:** Critical
- **File:** `idah/app/frontend/src/routes/(protected)/entries/[entryId]/plugin/[pluginId]/+layout.svelte:13-24`

**Description:** The `[pluginId]` URL parameter is interpolated directly into both a `<script src="...">` and a `<link href="...">` tag inside `<svelte:head>`. A user can navigate to `/entries/<entryId>/plugin/https:%2f%2fevil.example.com%2fexfil.js` (or any value SvelteKit's router accepts) and the browser will load and execute that script in the authenticated origin. Combined with the fact that the script is loaded with the user's cookies, this is a one-shot account-takeover primitive: send a victim a link, their browser loads attacker JS, the JS calls `/api/v1/iam/auth/...` with their cookies.

Even with a benign `pluginId`, the loaded `plugin.js` runs with full page origin privileges and is then trusted via `window.idah_plugin` (see `IdahPlugin.svelte:24-30`).

**Evidence:**
```svelte
<svelte:head>
  <link rel="stylesheet" type="text/css"
    href="{import.meta.env.VITE_IDAH_HOST}/api/v1/setting/plugins/{pluginId}/files/plugin.css"
    onload={() => (cssloaded = true)} />
  <script
    src="{import.meta.env.VITE_IDAH_HOST}/api/v1/setting/plugins/{pluginId}/files/plugin.js"
    onload={() => (jsloaded = true)}></script>
</svelte:head>
```

**Recommendation:**
1. Validate `pluginId` against an allow-list regex (e.g., `/^[a-z0-9-_]+$/`) before interpolation.
2. Use Svelte's `<svelte:element>` only after sanitization, or build the URL via `new URL(...)` and assert it is same-origin and under the expected path.
3. Load plugins with Subresource Integrity (SRI) hashes stored server-side.
4. Consider sandboxing plugins in an `<iframe sandbox="allow-scripts">` with `postMessage`-based RPC instead of running them in the main origin.

**Effort:** M

---

### FE-016 — `Record` base class uses `[key: string]: any` index signature (defeats TypeScript safety)
- **Category:** CodeSmell / TypeScript quality
- **Severity:** Medium
- **File:** `idah/app/frontend/src/lib/data/model/Record.ts:80-83`

**Description:** The base `Record` class declares `[key: string]: any;` to allow dynamic field access. This effectively disables type-checking on every record instance: typos like `account.emial` compile fine, and any record can be indexed with arbitrary strings without error.

**Evidence:**
```ts
export class Record {
  // Helper for accessing the fields of the record.
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  [key: string]: any;
  ...
}
```

**Recommendation:** Remove the index signature and rely on `@field` decorators to declare typed properties. If dynamic access is required, expose a typed `get<K extends keyof this>(key: K): this[K]` helper.

**Effort:** L

---

### FE-017 — `accept-invitation` page passes `token` from URL and surfaces `password_reset_token` in URL
- **Category:** Security
- **Severity:** Low
- **File:** `idah/app/frontend/src/routes/(public)/accept-invitation/+page.svelte:11-17`

**Description:** The invitation token is read from the query string and the resulting password-reset token is placed back into the URL via `goto(\`/reset-password?token=${passwordResetToken}\`)`. Tokens in URLs leak via Referer headers, browser history, and any analytics running on the page. The invitation token is also visible in the address bar while the page is open.

**Evidence:**
```ts
const accountResponse = await accountsBackendDataSource.join({
  token: page.url.searchParams.get("token") as string,
});
const passwordResetToken = accountResponse.meta?.password_reset_token || "";
goto(`/reset-password?token=${passwordResetToken}`);
```

**Recommendation:** Prefer delivering tokens via short-lived cookies or fragment (`#token=...`) which is not sent in Referer. If URL tokens are unavoidable, document the threat model and rotate tokens server-side after first use.

**Effort:** M

---

### FE-018 — `audit-logs` page fetches `pciture_url` (typo) and uses mismatched switch key
- **Category:** CodeSmell / Correctness
- **Severity:** Medium
- **File:** `idah/app/frontend/src/routes/(protected)/(app)/audit-logs/+page.svelte:41,50,75,125`

**Description:** Two related bugs:
1. Line 41: the field projection asks for `pciture_url` (typo for `picture_url`). The server will silently ignore the unknown field, so account pictures never load in audit rows.
2. Lines 50/75: the code populates `ids["account_ids"]` (key `account_ids`) but the switch at line 125 matches against `"accounts_ids"` (plural). The branch is unreachable, so actor-account names are never enriched via this path — only the initial `actor_account_id__in` query (which itself uses a non-existent filter key) populates `accounts`.

**Evidence:**
```ts
fields: { [AccountRecord.type]: ["name", "email", "pciture_url"] },  // typo
...
ids["account_ids"].push(log.resource_id);                              // key used
...
case "accounts_ids": {                                                // key checked — never matches
```

**Recommendation:** Fix the typo to `picture_url` and align the switch key (`account_ids` ↔ `account_ids`). Add a unit test for `onLoadSetContexts` to prevent regressions.

**Effort:** S

---

### FE-019 — `AuthService.signInWithEmailAndPassword` interface has typo `passowrd`
- **Category:** CodeSmell
- **Severity:** Info
- **File:** `idah/app/frontend/src/lib/data/model/iam/accounts/auth/records.ts:27`

**Description:** The interface parameter is named `passowrd` (transposed letters). The implementation uses the correct `password`, so the typo only affects the type signature, but it leaks into any consumer that destructures the typed arg.

**Evidence:**
```ts
export interface AuthService {
  signInWithEmailAndPassword: (email: string, passowrd: string) => Promise<RecordResponse<AccountAuthRecord>>;
```

**Recommendation:** Rename to `password`.

**Effort:** S

---

### FE-020 — `Object.assign(project, projectRes.data)` mutates a Record instance, bypassing the JSON:API data layer
- **Category:** Architecture / CodeSmell
- **Severity:** Low
- **File:** `idah/app/frontend/src/routes/(protected)/(app)/projects/[projectId]/+layout.svelte:61-70`

**Description:** `fetchProject()` does `Object.assign(project, projectRes.data)`. `projectRes.data` is a `ProjectRecord` whose `@field` properties are getters/setters that read/write `_jsonapiData.attributes`. Copying own enumerable properties with `Object.assign` copies the *getter results* as plain data properties onto the target, breaking reactivity and the round-trip serialization in `encodeModel`.

**Evidence:**
```ts
const projectRes = await projectsBackendDataSource.get(projectId, { ... });
Object.assign(project, projectRes.data);
return project;
```

**Recommendation:** Replace the target instance directly: `project = projectRes.data;` (with `$state` reassignment), or copy `_jsonapiData`/`_includeList` rather than enumerable props.

**Effort:** S

---

### FE-021 — `PageProvider` and `<Can>` allow `roles` to silently override `can()` result
- **Category:** Security / CodeSmell
- **Severity:** Medium
- **File:** `idah/app/frontend/src/lib/components/app/page/page-provider.svelte:30-34` and `idah/app/frontend/src/lib/security/can.svelte:32-37`

**Description:** Both components compute `result = await can(...)` and then unconditionally overwrite `result` with `roles.includes(roleName)` when `roles` is supplied. This means a user with the right role but no resource-level rights is granted access, and a user with the right `can()` result but the wrong role is denied. The two checks are not ANDed or ORed — the role check wins silently.

This is used by `audit-logs` (`roles={["admin"]}`) and the project layout (`roles={["admin", "org_owner", "user"]}`), so the role check is the *only* effective gate for those pages.

**Evidence:**
```ts
result = await currentAccount.can(action, resource, scopes);
if (roles) {
  result = roles.includes(currentAccount.roleName);  // overwrites, ignores can()
}
```

**Recommendation:** Decide on a clear semantic (typically `can() AND roleMatch`, or `can() OR roleMatch`) and document it. The server is authoritative, but the client should not silently widen access.

**Effort:** S

---

### FE-022 — `BackendDataSource.list({ all: true })` recurses without a safety bound
- **Category:** Performance / Robustness
- **Severity:** Medium
- **File:** `idah/app/frontend/src/lib/data/BackendDataSource.ts:185-197`

**Description:** When `options.all` is set, `list()` follows `body.links?.next` recursively until the server stops returning a `next` link. There is no maximum-page or maximum-item cap. A misconfigured server (or an attacker who can influence pagination metadata) can cause unbounded recursion, memory growth, and an effectively hung UI.

**Evidence:**
```ts
if (options.all) {
  const nextPage = body.links?.next;
  if (nextPage && options.pagination) {
    return await this.list({ ...options, pagination: { page: page + 1, itemsPerPage } });
  }
}
```

**Recommendation:** Add a hard cap (e.g., `maxPages = 100` or `maxItems = 10_000`) and throw a typed error when exceeded. Also surface progress to the caller.

**Effort:** S

---

### FE-023 — `BackendDataSource` cache key ignores auth context (cross-user cache leak risk)
- **Category:** Security / Performance
- **Severity:** Medium
- **File:** `idah/app/frontend/src/lib/data/BackendDataSource.ts:101-131,158-170`

**Description:** The cache key is `resourcePath(basePath, id)` + a hash of the *query params*. It does not include any account/role identifier. Because the cache lives in a module-level singleton (`Cache.ts`), if a user signs out and another signs in on the same browser tab without a full reload, `clearAllCache()` is only called from `AuthContext.logout()` — not from `refresh()` failures or session expiry. Stale entries from the previous user can be served to the next user.

The risk is amplified by the fact that the cache stores raw JSON:API bodies, which may include scoped data (e.g., entries the previous user could see but the new one cannot).

**Evidence:**
```ts
cacheIdKey = resourcePath(this.basePath, id, undefined);   // no account id
setCache(cacheIdKey, cacheSignature, body);
```

**Recommendation:** Include the current account id (or a session-scoped nonce) in the cache key, or call `clearAllCache()` on every auth-state transition (not just explicit logout).

**Effort:** M
