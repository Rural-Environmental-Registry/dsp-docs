# Contributing to rer-dsp-docs

Thank you for your interest in contributing to the DSP documentation.

This repository is the documentation site of the **DSP (Data Sharing
Platform)**, part of the Rural Environmental Registry (RER). It is published
in Portuguese (Brazil) and English. It is not the application code.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

The published site is
[rural-environmental-registry.github.io/dsp-docs](https://rural-environmental-registry.github.io/dsp-docs).
The guide below covers how to change this site.

---

## What belongs here

Changes to platform documentation belong in this repository:

- Pages under `docs/pt-br/` and `docs/en/`
- Navigation in `zensical.pt-br.toml` and `zensical.en.toml`
- Site build scripts under `scripts/`
- This module's `README.md` (how to build and edit the site, not the DSP itself)

A content change in one language includes the same page in the other language,
with the same relative path. A new page is added to the `nav` of both TOML
files.

Application and infrastructure changes belong in their own repositories:

| Change | Repository |
|--------|------------|
| Stack orchestration, gateway, and adopter configuration | [dsp-core](https://github.com/Rural-Environmental-Registry/dsp-core) |
| REST API | [dsp-backend](https://github.com/Rural-Environmental-Registry/dsp-backend) |
| Web interface | [dsp-frontend](https://github.com/Rural-Environmental-Registry/dsp-frontend) |
| Source-database migration | [dsp-job-data-migration](https://github.com/Rural-Environmental-Registry/dsp-job-data-migration) |
| Pre-generated download files | [dsp-job-geo-file-generation](https://github.com/Rural-Environmental-Registry/dsp-job-geo-file-generation) |

Each module keeps a short `README.md` (purpose, stack, how to run). Behavior of
the platform is documented here.

---

## How to contribute

### 1. Bugs and features

1. Open an issue describing the problem or the change in the dsp-core repository:
   https://github.com/Rural-Environmental-Registry/dsp-core/issues
2. Fork the repository
3. Create a branch from `develop`: `git checkout -b feat/short-description`
4. Edit `docs/pt-br/` and the matching file in `docs/en/`
5. Build or serve the site and check the page
6. Commit with a clear message
7. Open a pull request against `develop`

### 2. Pages

| Language | Folder | Config |
|----------|--------|--------|
| Portuguese (Brazil) | `docs/pt-br/` | `zensical.pt-br.toml` |
| English | `docs/en/` | `zensical.en.toml` |

`zensical.toml` matches `zensical.pt-br.toml`. The site root sends `pt*` to
`/pt-br/` and other languages to `/en/`.

Name files in lowercase with hyphens: `quick-start.md`. Keep the same path in
both languages. Update both `nav` lists when you add or move a page.

### 3. README of this module

`README.md` explains how to build, edit, and publish this site. It does not
replace the pages under `docs/`.

---

## Local setup

Requirements: Python 3 and pip.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Live reload for one language (no language switch in the menu):

```bash
./scripts/serve-one-locale.sh pt-br
# or
./scripts/serve-one-locale.sh en --open
```

Open http://127.0.0.1:8000. In this mode the pages are at the server root, without `/pt-br/` or `/en/`.

Full site, same shape as GitHub Pages:

```bash
./scripts/build-site.sh
cd site
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000/pt-br/.

Do not run `zensical build -f zensical.pt-br.toml` on the source TOML files.
`site_url` uses the placeholder `__DOCS_PAGES_BASE__`, and the HTML comes out
broken. `scripts/build-site.sh` and the CI go through
`scripts/resolve-zensical-config.sh`.

The `site/` folder is generated. Do not commit it. Push to `main` publishes
the site with the Documentation workflow.

---

## Writing standards

- Write the Portuguese pages in Brazilian Portuguese and the English pages in English
- Keep headings, tables, and section order aligned between the two files
- Use ATX headings (`# Title`)
- Use fenced code blocks with a language tag
- Diagrams use Mermaid, as in the existing architecture pages
- Callouts use the admonition syntax already present in the pages (`!!! note`, `!!! warning`, `!!! tip`)
- Give images alt text
- Link to a sibling page with a relative path inside the same language

---

## Review process

1. **Build** — `./scripts/build-site.sh` completes, or the live-reload server shows the changed page
2. **Both languages** — `docs/pt-br/` and `docs/en/` match, including `nav` when the structure changed
3. **Peer review** — at least one maintainer reviews the pull request
4. **Merge** — approved pull requests are merged into `develop`

---

## Commit message format

Use conventional commits:

```
docs: describe the geo-file job schedule
docs: add the Portuguese page for generic layers
fix: repair the broken link in the quick start
```

**Types:**

- `docs:` — documentation pages
- `fix:` — correction in an existing page
- `feat:` — new page or site behavior

---

## Getting help

- **Questions or bugs:** open an issue in the dsp-core repository:
  https://github.com/Rural-Environmental-Registry/dsp-core/issues
- **Stuck on a pull request:** ask in the pull request

---

## License

By contributing, you agree that your contributions will be licensed under the
[GNU General Public License v3.0](LICENSE).

---

**Thank you for helping improve the DSP documentation.**
