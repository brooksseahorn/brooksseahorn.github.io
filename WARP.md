# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

Preview locally
- Start a simple HTTP server from the repo root:
  - `python3 -m http.server 8080`
  - Open: `http://localhost:8080`

Optional: preview via Jekyll (matches GitHub Pages processing)
- Prereqs (once): `gem install jekyll jekyll-theme-architect`
- Serve with live reload: `jekyll serve --livereload`
  - If a Gemfile is added later: `bundle exec jekyll serve --livereload`

Deploy
- GitHub Pages: pushing to `main` updates the site. Keep `CNAME` committed.

Linting / tests
- None are configured in this repo.

## High-level architecture

- Static single‑page site.
  - Entry: `index.html` loads `index.css` and `index.js`, and contains a `#console` div where content renders. jQuery is referenced but currently unused by the code in `index.js`.
  - Behavior: `index.js` (vanilla JS) generates a Slurm-like status report client‑side and simulates typing it into `#console`. After the initial render, a timer re‑types only the numeric fields every 15 seconds to appear live.
  - Content: The report is assembled dynamically; `messages.json` provides system messages with optional `weight` used for weighted random selection. `input.txt` is no longer consumed. `brooks.txt` remains as an example of prior content.
  - Presentation: `index.css` styles the terminal‑like UI.
  - Site configuration: `_config.yml` sets the Jekyll theme `jekyll-theme-architect`; `CNAME` configures the custom domain.

Data/flow overview
- Generator in `index.js` → builds HTML with `<span class="metric" data-key=...>` around numeric fields → typed into `#console` → periodic job updates only those spans with a re‑type effect.

Notes / gotchas
- Serve over HTTP when developing; opening via `file://` can block asset/script execution in some browsers.
- `index.html` references `index2.js` (not present). It is safe to remove or ignore.
