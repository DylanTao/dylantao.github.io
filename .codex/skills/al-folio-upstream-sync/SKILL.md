---
name: al-folio-upstream-sync
description: Sync this customized DylanTao al-folio site with the upstream alshedivat/al-folio repository. Use when asked to pull latest al-folio code, sync upstream, merge upstream/main, update the theme from root al-folio, or resolve conflicts between upstream al-folio changes and this site's customized content, analytics, SEO, layouts, posts, projects, publications, and Sirui-specific pages.
---

# al-folio Upstream Sync

## Overview

Use this skill to merge upstream `alshedivat/al-folio` updates into this customized site while preserving Dylan's content, identity, analytics, SEO, and custom interactions.

Default policy: sync directly on local `main`, validate before committing, and never push unless the user explicitly asks.

## Before Merging

1. Read `.github/copilot-instructions.md` first.
2. Confirm remotes:

   ```powershell
   git remote -v
   ```

   Expected:
   - `origin` points to `https://github.com/DylanTao/dylantao.github.io.git`
   - `upstream` points to `https://github.com/alshedivat/al-folio.git`
   - Ignore `merge-upstream` for the default workflow; it points to the same fork as `origin`.

3. Require a clean worktree before starting:

   ```powershell
   git status --short --branch
   ```

   If there are uncommitted changes, stop and ask the user how to handle them. Do not stash, discard, or commit unrelated work without explicit permission.

## Sync Workflow

Run the sync on `main` unless the user explicitly chooses another branch.

```powershell
git switch main
git pull --ff-only origin main
git fetch upstream --tags --prune
git merge --no-ff upstream/main
```

If `git pull --ff-only origin main` fails because local `main` and `origin/main` diverged, stop and ask the user. Do not rebase, force-push, or rewrite history unless explicitly asked.

## Conflict Resolution Rules

Resolve conflicts hunk-by-hunk. Never use repo-wide `ours` or `theirs` commands such as `git checkout --ours .`, `git checkout --theirs .`, or broad scripted replacement.

Use these commands to inspect conflicts:

```powershell
git diff --name-only --diff-filter=U
git diff --cc <file>
git show :2:<file>  # ours: this customized site
git show :3:<file>  # theirs: upstream al-folio
```

Prefer this customized site's version for personal identity and content:

- `_config.yml`
- `_data/`
- `_pages/`
- `_posts/`
- `_projects/`
- `_news/`
- `_bibliography/`
- `assets/img/`
- `papers/`
- `projects/`
- `workers/`
- SEO and analytics docs/scripts

Prefer upstream updates for generic al-folio framework improvements when they do not remove custom behavior:

- `_layouts/`
- `_includes/`
- `_sass/`
- `_plugins/`
- `_scripts/`
- `.github/workflows/`
- Docker/build/dependency files
- upstream documentation and template improvements

For mixed files, manually integrate upstream structure while preserving this site's custom behavior, especially:

- blog navigation and blog read counters
- analytics setup and SEO metadata
- visitor worker hooks
- secret or research-thoughts pages
- Sirui-specific visuals and pages
- custom publication/project/content data

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

After the merge is resolved:

```powershell
npx prettier . --write
docker compose up --build
```

Verify the site at `http://localhost:8080`. Check navigation, pages, images, posts, projects, publications, dark mode, and custom analytics/visitor/read-counter behavior.

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

Do not push unless the user explicitly asks.
