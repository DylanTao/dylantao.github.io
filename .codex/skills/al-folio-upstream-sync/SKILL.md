---
name: al-folio-upstream-sync
description: Inspect and selectively sync safe changes from alshedivat/al-folio into this customized DylanTao site while preserving local contracts. Use when asked to pull or compare upstream al-folio, take the latest safe bits, update the theme, merge upstream/main, review upgrade drift, or resolve conflicts involving this site's content, analytics, SEO, layouts, posts, projects, publications, and Sirui-specific pages.
---

# al-folio Upstream Sync

## Overview

Use this skill to curate upstream `alshedivat/al-folio` improvements into this customized site while preserving Dylan's content, identity, analytics, SEO, and custom interactions.

Default policy: fast-forward this fork's `origin/main`, fetch upstream, inspect the diff and override state, then apply only a reviewed bounded batch. Do not wholesale-merge `upstream/main` unless the user explicitly requests a full merge. Validate before committing, and never push unless the user explicitly asks.

## Before Syncing

1. Read `.github/copilot-instructions.md`, `docs/BOUNDARIES.md`, `al-folio-upgrade-report.md` when present, and `.al-folio-overrides.yml`.
2. Require a clean worktree:

   ```powershell
   git status --short --branch
   ```

   If there are uncommitted changes, stop and ask the user how to handle them. Do not stash, discard, or commit unrelated work without explicit permission.

3. Confirm remotes:

   ```powershell
   git remote -v
   ```

   Expected:
   - `origin` points to `https://github.com/DylanTao/dylantao.github.io.git`
   - `upstream` points to `https://github.com/alshedivat/al-folio.git`
   - Ignore `merge-upstream` for the default workflow; it points to the same fork as `origin`.

4. Start from the customized fork's current `main`:

   ```powershell
   git switch main
   git pull --ff-only origin main
   ```

   If the fast-forward pull fails, stop. Do not rebase, force-push, or rewrite history unless explicitly asked.

## Inspect Before Selecting

Fetch without merging, then inspect the candidate surface:

```powershell
git fetch upstream --tags --prune
git log --oneline --decorate --left-right main...upstream/main
git diff --stat main..upstream/main
git diff --name-status main..upstream/main
bundle exec al-folio upgrade audit
bundle exec al-folio upgrade overrides audit
bundle exec al-folio upgrade report
```

Classify each candidate as starter wiring/docs/tests, a site-specific local override, or shared plugin runtime behavior. Route shared runtime fixes to the owning plugin; keep site-specific behavior here.

## Selection Rules

- Do not prefer upstream solely because a file lives in `_layouts`, `_includes`, `_sass`, `_plugins`, `_scripts`, `.github/workflows`, or a build path. Those paths can carry intentional customized-site contracts.
- Preserve personal identity and content in `_config.yml`, `_data`, `_pages`, `_posts`, `_projects`, `_news`, `_bibliography`, media, papers, projects, workers, and Sirui-specific pages.
- Preserve local analytics, SEO, search/modal behavior, read counters, visitor workers, secret-page access, publication/project presentation, desk scene, theme behavior, and publish gates unless a reviewed replacement retains the same contract.
- Use `.al-folio-overrides.yml` and `bundle exec al-folio upgrade overrides diff <path>` to understand shadowed plugin files. Accept an override only after reviewing its upstream change.
- Apply one coherent, bounded batch at a time. Prefer a reviewed self-contained cherry-pick or manual hunk integration over a broad file replacement.
- Never use repo-wide `ours` or `theirs`, broad checkout-from-upstream commands, or scripted replacement.

## Explicit Full-Merge Path

Only when the user explicitly requests a full `upstream/main` merge, run:

```powershell
git merge --no-ff upstream/main
```

Resolve every conflict hunk-by-hunk. Use these commands to inspect conflicts:

```powershell
git diff --name-only --diff-filter=U
git diff --cc <file>
git show :2:<file>  # ours: this customized site
git show :3:<file>  # theirs: upstream al-folio
```

After resolving each conflicted file, run:

```powershell
git add <file>
```

Then continue until:

```powershell
git diff --name-only --diff-filter=U
```

prints nothing.

## Validation And Commit

Run checks proportional to the selected batch, including:

```powershell
npm run lint:prettier
npm run lint:style-contract
python -m unittest discover -s test -p "test_*.py"
$env:JEKYLL_ENV = "production"
bundle exec jekyll build
bundle exec al-folio upgrade audit
bundle exec al-folio upgrade overrides audit
bundle exec al-folio upgrade report
```

Use Docker when local Ruby/Jekyll behavior is unreliable. Verify the customized root site at `http://localhost:8080/`, including `/`, `/publications/`, `/cv/`, `/projects/`, `/blog/`, and a representative custom post. Check navigation, search, mobile layout, light/dark themes, publication UI, images, custom analytics/visitor/read-counter behavior, and console errors.

If the selected batch retains or changes local plugin-owned overrides, review the audit output and update `.al-folio-overrides.yml` only for overrides actually inspected.

Inspect the final diff before committing:

```powershell
git status --short
git diff --stat
git diff --check
```

Commit only after validation passes. Use a concise project-style message such as:

```text
chore: sync al-folio upstream
```

Do not push unless the user explicitly asks. After a requested push, verify the exact deployed commit and its customized-site contracts rather than treating HTTP 200 as completion.
