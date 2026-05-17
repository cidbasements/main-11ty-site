# CID Basements

Website for **Custom Integrated Designs Ltd.** — a basement finishing and remodeling company based in Parker, CO, serving the Denver metro area since 1977.

Live site: [cidbasements.com](https://www.cidbasements.com)

## Tech stack

- [Eleventy (11ty)](https://www.11ty.dev/) v3 — static site generator
- [Nunjucks](https://mozilla.github.io/nunjucks/) — templating
- [Tailwind CSS](https://tailwindcss.com/) v3 + PostCSS — styles
- Deployed to GitHub Pages via GitHub Actions

## Project structure

```
src/
  _data/          # Global data (site config, gallery JSON)
  _includes/      # Nunjucks components (nav, footer, sidebar)
  assets/         # CSS, JS, images
  content/        # Markdown content collections
    blog/
    pages/
    pictures/
    projects/
    testimonials/
    videos/
  *.njk           # Top-level page templates
scripts/          # One-off content extraction utilities
_site/            # Build output (git-ignored)
```

## Local development

```bash
npm install
npm start         # Eleventy + CSS watch on http://localhost:8181
```

## Build

```bash
npm run build     # Outputs to _site/
```

## Deploy

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`), which builds the site and publishes `_site/` to the `gh-pages` branch.

