# Git Workflow

This document outlines the conventions for using Git and writing commit messages in this project.

## Single-owner default

Sirui is the only active contributor and prefers normal work directly on `main` (September 2026). Use a temporary branch only when requested or when isolation is necessary. Integrate completed work onto `main`, then remove the merged local feature branch. Delete an obsolete remote feature branch only after verifying that its commits are contained in `main`; preserve the `gh-pages` deployment branch. A local merge is not authorization to publish a new site deployment.

## Commit Message Format

All commit messages should follow this format:

```
<type>: <subject>

<body (optional)>
```

**Types:**

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
- `config`: Changes to configuration files
- `chore`: Changes to the build process or auxiliary tools and libraries

**Examples:**

```
feat: Add dark mode toggle button to header
fix: Correct baseurl in project site configuration
docs: Update docs/INSTALL.md with Docker troubleshooting
style: Format all Liquid templates with Prettier
config: Enable blog section in _config.yml
chore: Update Jekyll dependencies with bundle update --all
```

## Staging Changes

**Always `git add` files explicitly.** Do not stage everything with `git add .` unless you are certain of what's being committed. Check `git status` first to review your changes.

## What NOT to Commit

**Always obey the project's [`.gitignore`](../.gitignore) file.** It prevents the accidental commit of:

- Build outputs (`_site/`, `.jekyll-cache/`)
- Dependencies (`node_modules/`, `vendor/`)
- OS-specific files (`.DS_store`)
- Editor temporary files (`.idea/`, `.swp`, `.swo`)
- Secrets and API keys (never commit credentials)
