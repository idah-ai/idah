# Releasing IDAH

How we version, cut, publish, deploy and patch the platform.

---

## TL;DR

```bash
bin/tag-release 0.2.0-rc.1   # candidate on the latest main: CD builds, smoke-tests, publishes a pre-release
# ...verify on staging...
bin/tag-release 0.2.0        # same commit as the candidate: CD publishes the stable release
```

Pushing a `v*.*.*` tag is what triggers a release. Nothing else does.

---

## 1. What a release is

- **One version for the whole platform.** A release is a commit, not a service. One git tag
  (`v0.4.0`) produces three images at the same version, which run the eight services:

  ```
  ghcr.io/idah-ai/idah-service:0.4.0    iam, audit, dataset, notification, setting, sync
  ghcr.io/idah-ai/idah-media:0.4.0      media: the service image plus ffmpeg and ImageMagick
  ghcr.io/idah-ai/idah-frontend:0.4.0   the SvelteKit app
  ```

  Each Ruby service runs `idah-service` from its own directory (`/app/<service>`). Every image
  gets every tag, even when it did not change.
- **Plugins version independently** (`plugins/*/manifest.json` → `version`), and declare the
  platform they target in `idahVersion`.
- **`common/` is never versioned on its own.** It ships inside every image.
- **Each running service reports its version.** `IDAH_VERSION` and `IDAH_GIT_SHA` are stamped
  into the image at build time and exposed on `/healthcheck` (see
  [`common/lib/idah_version.rb`](common/lib/idah_version.rb)). A local or source build reports
  `0.0.0-dev`.

### Semantic versioning while on 0.x

We are pre-1.0: no stability is promised. The digits shift left:

| Change in the batch | On 0.x          | On 1.x and later |
|---------------------|-----------------|------------------|
| Breaking change     | minor `0.4.2 → 0.5.0` | major |
| Feature             | patch `0.4.2 → 0.4.3` | minor |
| Fix                 | patch `0.4.2 → 0.4.3` | patch |

`1.0.0` is never produced by a commit type. It is cut deliberately, when we make the first
compatibility commitment to a customer.

### What counts as "breaking"

The public contract, in order of how quietly it breaks:

1. **Export formats** — what lands in a customer's training pipeline. Breaks with no error.
2. **Stored annotation data** — must stay readable by the new version.
3. **HTTP API** — request and response shapes.
4. **Plugin contract** — manifest structure, loading, calls.
5. **Required configuration** — a new setting with no default, or a renamed one.
6. **Database migrations that cannot be rolled back.**

Internal `common/` APIs and service-to-service calls are **not** in the contract.

---

## 2. Commit convention

We use [Conventional Commits](https://www.conventionalcommits.org/), enforced on the **PR title**,
with **squash merge only**. The PR title becomes the commit on `main`, and the commit on `main`
becomes the changelog line — so the title is the only thing that has to be right.

```
<type>(<scope>)<!>: <summary in imperative mood, lower case, no period>

[body — why, not what]

[footers]
Refs: CU-869f1cbzt
BREAKING CHANGE: <what the consumer must do>
```

### Types

| Type       | Use for                                                   | In changelog | Bumps |
|------------|-----------------------------------------------------------|:------------:|:-----:|
| `feat`     | A new capability a user or API consumer can see           | ✅ Features  | ✅    |
| `fix`      | Wrong behaviour made right                                | ✅ Fixes     | ✅    |
| `perf`     | Faster / lighter, same behaviour                          | ✅ Performance | ✅  |
| `revert`   | Reverting an earlier commit                               | ✅           | ✅    |
| `refactor` | Internal change, no behaviour change                      | —            | —     |
| `docs`     | Documentation only                                        | —            | —     |
| `test`     | Specs only                                                | —            | —     |
| `build`    | Dockerfiles, Gemfiles, package.json, dependency bumps     | —            | —     |
| `ci`       | `.github/` workflows and scripts                          | —            | —     |
| `chore`    | Anything else that ships nothing                          | —            | —     |

A `!` after the type/scope, or a `BREAKING CHANGE:` footer, marks a breaking change on any type.

### Scopes

Optional but encouraged. Use the part of the system a reader of the changelog would recognise:

`iam`, `dataset`, `media`, `sync`, `audit`, `notification`, `setting`, `frontend`, `common`,
`idah-image`, `idah-video`, `plugin-cli`, `deploy`, `installer`

Omit the scope when a change genuinely spans the platform.

### Examples

```
feat(dataset): stream zip entries during media upload
fix(frontend): correct tooltip text for category targeting
perf(media): avoid re-reading video headers on thumbnail generation
feat(sync)!: rename `bbox` to `box` in COCO export
fix(installer): refuse upgrade when the database holds no IDAH data
build(iam): bump verse-sentry to 1.4.0
```

### Rules of thumb

- **`feat` vs `fix`** — if the user could not do it before, `feat`. If they could but it was
  wrong, `fix`. "Enhance", "improve" and "update" are not a type — pick one of the two, or
  `refactor` if nobody outside the team would notice.
- **Tickets go in the footer**, not the title: `Refs: CU-869f1cbzt`. Titles are public
  changelog text.
- **Export-format changes need a `BREAKING CHANGE:` footer or upgrade notes** even when they look
  additive — see §1.
- **Migrations that drop or rewrite data** are breaking unless they follow expand/contract
  (add in this release, remove in a later one).

### Repository settings that make this work

- *Settings → General → Pull Requests*: allow **squash merging only**; default commit message
  **"Pull request title and description"**.
- A required PR-title check (e.g. [`amannn/action-semantic-pull-request`](https://github.com/amannn/action-semantic-pull-request))
  so a malformed title cannot be merged.
- Branch protection on `main` and `release/*`; tag protection (ruleset) on `v*`.

---

## 3. Release gate

A version is cut only when **all** of these hold. A hotfix passes the same gate.

- [ ] CI green on the release commit (`ci-app`, `ci-common`, `ci-plugins`).
- [ ] Every migration in the batch is either reversible or listed under **Upgrade notes**.
- [ ] Plugin `idahVersion` fields are compatible with the version being cut.
- [ ] The release candidate ran on staging and was exercised.
- [ ] Release notes written, including whether the release **can be rolled back** (§6).

---

## 4. Cutting a release

### 4.1 Decide the version

Look at everything merged since the last tag:

```bash
git log --oneline "$(git describe --tags --abbrev=0 --match 'v*' --exclude '*-rc*')"..origin/main
```

Apply §1: largest bump wins. Ten PRs make one release — merging a PR does not cut a version.

### 4.2 Tag a release candidate

```bash
bin/tag-release 0.2.0-rc.1
```

[`bin/tag-release`](bin/tag-release) tags the latest `main` on GitHub with an **annotated** tag: it
records who tagged and when — the date matters legally, see §8 — and lists the pull requests merged
since the previous stable version. It opens the message in your editor first, then asks before
pushing, because the push starts the release. `--dry-run` shows the commit and the message without
creating anything. It refuses a version that is already tagged, and a commit whose CI has not passed
on `main` (the four "CI passed" checks, read with the GitHub CLI, `gh`). Pull requests are tested
against `main` as it was when their checks ran, so the run on `main` is the one that tests what ships.

[`cd-app.yml`](.github/workflows/cd-app.yml) then:

1. Refuses to run if any image at that version already exists (tags are immutable).
2. Builds the three images for `linux/amd64` and `linux/arm64`.
3. Publishes each multi-arch image only when both architectures built.
4. Smoke-tests every image with no source tree mounted, and checks it reports the expected
   version ([`.github/scripts/smoke-image.sh`](.github/scripts/smoke-image.sh)).
5. Builds the installer bundle from [`deploy/compose/`](deploy/compose/)
   ([`.github/scripts/build-bundle.sh`](.github/scripts/build-bundle.sh)).
6. Tests the installer as a customer runs it, with the images just published: a fresh install, and
   an install of the previous stable release upgraded to this one with `--upgrade`
   ([`.github/scripts/test-installer.sh`](.github/scripts/test-installer.sh)). Every service must
   answer through nginx and report the new version.
7. Attaches `idah-<version>.tar.gz`, `install.sh` and `SHA256SUMS` to a GitHub Release. A version
   with a suffix (`-rc.1`) is published as a **pre-release**, so `releases/latest` — which the
   one-line installer uses — never points at a candidate.

Pull requests that change `deploy/compose/` or these scripts run the fresh install too, with images
built from the pull request (*CI - Scripts*).

If any step fails, fix on `main` and tag `-rc.2`. Never delete and re-push a tag.

### 4.3 Verify the candidate

- Install or upgrade a staging host with `IDAH_VERSION=0.2.0-rc.1` via
  [`deploy/compose/install.sh`](deploy/compose/README.md#upgrading).
- `curl …/healthcheck` on each service reports `0.2.0-rc.1` and the expected revision.
- Exercise the areas the release touched, plus an export in each format.

### 4.4 Promote to stable

Tag **the same commit** as the verified candidate:

```bash
bin/tag-release 0.2.0
```

The script finds the latest `v0.2.0-rc.N` and tags its commit; it refuses if there is no candidate.

### 4.5 Write the release notes

CD creates the GitHub Release with generated notes: the title of every pull request merged since
the previous stable version (candidates are skipped, so `v0.2.0-rc.1` and `v0.2.0` both list the
changes since `v0.1.x`). PR titles are checked Conventional Commits, so the list reads as a
changelog. Edit the release to add what a list of titles cannot say, and arrange it as:

```markdown
## Highlights
<two or three lines a customer cares about>

## Upgrade notes
<breaking changes, new required config, irreversible migrations — or "None">

**Rollback:** reversible | not reversible (migrations in this release cannot be undone)

## Features
## Fixes
## Performance

**Plugins:** idah-image 0.1.x, idah-video 0.1.x
**Full changelog:** v0.1.0...v0.2.0
```

### 4.6 Cut the release branch (minor releases only)

```bash
git switch -c release/0.2 v0.2.0
git push -u origin release/0.2
```

This is where patches for 0.2.x are made (§5).

### 4.7 Deploy

Staging first, then production, each by setting `IDAH_VERSION` and running
`./install.sh --upgrade`. Production never runs an unnamed or `latest` image.

---

## 5. Hotfixes

Production runs a released version; `main` has moved past it. Fix on the release branch so a
hotfix ships only the fix.

```bash
git switch release/0.2 && git pull
git switch -c fix/CU-xxxx/short-description
# ...fix, commit, open a PR targeting release/0.2, squash merge...
git switch release/0.2 && git pull
git tag -a v0.2.1-rc.1 -m "v0.2.1-rc.1" && git push origin v0.2.1-rc.1
# ...verify, then tag v0.2.1 on the same commit as in §4.4
```

Then, **the same day**, carry it forward:

```bash
git switch main && git pull
git switch -c fix/CU-xxxx/forward-port
git cherry-pick -x <squashed-commit-on-release/0.2>
# open a PR to main
```

- Release branches take fixes only: no features, refactors or unrelated dependency bumps.
- Forward-porting is part of the fix, not follow-up work.
- A fix that exists only on `main` and is needed in production is cherry-picked *back* onto the
  release branch the same way.

---

## 6. Rolling back

| Release was…  | Do this |
|---------------|---------|
| **Reversible** (no migrations, or expand-only) | Set `IDAH_VERSION` to the previous version and restart. |
| **Not reversible** | Roll forward: fix on the release branch and ship the next patch. Restore from backup only as a last resort. |

The installer runs migrations before the new images start. Once a contracting migration has run,
the old images meet a schema they were not written for — so reversibility is decided **when the
migration is written**, and recorded in the release notes.

Back up before every production upgrade (see [`deploy/compose/README.md`](deploy/compose/README.md)).

---

## 7. Plugins

- Bump `version` in `plugins/<name>/manifest.json` in the PR that changes the plugin, using the
  same rules as §1 against the annotation data the plugin reads and writes.
- Bump `idahVersion` when the plugin starts depending on a newer platform.
- Bundled plugins ship inside the platform images, so their current versions are listed in the
  platform release notes.

---

## 8. Rules that never bend

1. **Tags are immutable.** A bad release is fixed by the next patch, never by re-pushing a tag.
   CD refuses to overwrite a published image.
2. **Tags are only pushed from `main` or `release/*`**, on a commit that passed CI.
3. **Nothing is tagged `latest`.** Every environment names its version.
4. **A hotfix is still a release** — same gate, same notes, same staging pass.
5. **Tag dates are legal dates.** IDAH ships under FSL-1.1-ALv2: each version converts to
   Apache 2.0 two years after it was released. Annotated, immutable, accurately dated tags are
   what establish that date.

---

## 9. Next step: release automation

Today the release owner picks the version and pushes the tag. Once the commit convention has been
followed for a few releases, adopt
[release-please](https://github.com/googleapis/release-please-action) so the version and
changelog are computed from commits:

- It keeps a **release PR** open with the next version and the accumulated `CHANGELOG.md`.
  Merging that PR is the decision to ship; it creates the tag and the GitHub Release.
- Configure it for 0.x semantics (§1):

  ```json
  {
    "release-type": "simple",
    "bump-minor-pre-major": true,
    "bump-patch-for-minor-pre-major": true,
    "include-component-in-tag": false,
    "packages": { ".": {} }
  }
  ```

- **Caveat:** a tag created with the default `GITHUB_TOKEN` does **not** trigger other workflows,
  so `cd-app.yml` would not run. Either give release-please a GitHub App token, or have the
  release workflow call `cd-app.yml` via `workflow_call`.
- Have it also cut `release/X.Y` on every new minor, which removes §4.6.
