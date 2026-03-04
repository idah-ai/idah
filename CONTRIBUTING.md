# Contributing to [Project Name]

First off — thank you! External contributions are what make open source thrive, and we genuinely appreciate you taking the time to help improve this project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Ways to Contribute](#ways-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Improving Documentation](#improving-documentation)
  - [Submitting Code](#submitting-code)
- [Fork & Pull Request Workflow](#fork--pull-request-workflow)
- [Commit Message Convention](#commit-message-convention)
- [Development Setup](#development-setup)
- [Getting Help](#getting-help)

---

## Code of Conduct

We are committed to providing a welcoming and respectful environment for everyone. By participating, you agree to:

- Be respectful and professional toward all contributors
- Give constructive, actionable feedback focused on the work
- Be inclusive — discriminatory language or behaviour of any kind will not be tolerated. No politics is allowed. This is a tool, not a platform for activism
- Collaborate openly and help others when you can

Violations may result in removal from the project. To report an incident, contact us at [contact@idah.ai](mailto:contact@idah.ai).

---

## Getting Started

Before diving in:

1. **Search existing [issues](../../issues) and [pull requests](../../pulls)** to see if someone is already working on what you have in mind.
2. For significant changes, **open an issue first** to discuss your approach before writing code. This saves everyone time.
3. For small fixes (typos, broken links, minor bugs), feel free to open a PR directly.

---

## Ways to Contribute

### Reporting Bugs

Found something broken? [Open a bug report](../../issues/new?template=bug_report.md) and include:

- A clear, descriptive title
- Steps to reproduce the problem
- Expected vs. actual behaviour
- Your environment (OS, runtime version, relevant config)
- Relevant logs, error messages, or screenshots

### Suggesting Features

Have an idea that would benefit the community? [Open a feature request](../../issues/new?template=feature_request.md) and describe:

- The problem you're trying to solve
- Your proposed solution
- Alternatives you've considered
- Why this would be useful to other users

### Improving Documentation

Documentation improvements are always welcome:

- Fix typos, broken links, or unclear wording
- Add missing examples or clarify existing ones
- Improve the README, inline comments, or API docs

Small doc fixes don't need a prior issue — just open a PR.

### Submitting Code

All code contributions are submitted via pull request from your fork. See the workflow below.

---

## Fork & Pull Request Workflow

We follow **GitHub Flow**. Here's the step-by-step:

1. **Fork** the repository to your own GitHub account.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/PROJECT_NAME.git
   cd PROJECT_NAME
   ```
3. **Add the upstream remote** to stay in sync:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_ORG/PROJECT_NAME.git
   ```
4. **Create a branch** from `main` with a descriptive name:
   ```bash
   git checkout -b fix/annotation-export-crash
   git checkout -b feat/bulk-import-support
   git checkout -b docs/update-api-reference
   ```
   Use the prefixes `fix/`, `feat/`, `docs/`, `chore/` to keep things clear.
5. **Make your changes**, committing early and often (see commit conventions below).
6. **Sync with upstream** before opening your PR:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```
7. **Push** your branch to your fork:
   ```bash
   git push origin your-branch-name
   ```
8. **Open a Pull Request** against the `main` branch of this repository.

### Pull Request Checklist

Before submitting, make sure your PR:

- [ ] Has a clear title and description explaining *what* and *why*
- [ ] Is focused — one concern per PR
- [ ] Includes tests for new behaviour or bug fixes
- [ ] Passes all existing tests and CI checks
- [ ] References the related issue (e.g. `Closes #42`)

---

## Commit Message Convention

We use a simplified version of [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short summary>

[optional body — explain why, not what]
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`

Examples:
```
feat: add multi-label support to annotation export
fix: prevent crash when dataset is empty
docs: clarify authentication setup in README
chore: update dependencies
```

Keep the summary under 72 characters.

---

## Development Setup

> See [README.md](README.md) for full environment requirements and prerequisites.

---

## Getting Help

Stuck or unsure where to start? Here are some good entry points:

- Browse issues tagged [`good first issue`](../../issues?q=is%3Aopen+label%3A%22good+first+issue%22) or [`help wanted`](../../issues?q=is%3Aopen+label%3A%22help+wanted%22)
- Ask a question by opening a [Discussion](../../discussions)
- Reach out to the maintainers at [contact@idah.ai](mailto:contact@idah.ai)

We do our best to review contributions promptly. Thank you for being part of this. 🙏