# landing-page

Source for straysignals.dev. Built with Eleventy, deployed to GitHub Pages via `.github/workflows/deploy.yml`.

## Maintenance

- **`SUBMODULE_SYNC_TOKEN` (repo secret) expires Sep 21, 2026.** This fine-grained PAT lets this repo's workflows (`deploy.yml`, `sync-pigeonhole.yml`) check out the `Pigeonhole` repo's submodule at `root/projects/pigeonhole` — `Pigeonhole` is private, so the default `GITHUB_TOKEN` can't see it. It's the same token value as `Pigeonhole`'s `LANDING_PAGE_DISPATCH_TOKEN` secret — scoped to both the `Pigeonhole` and `landing-page` repos, Contents: Read and write. When it expires, generate a new fine-grained PAT with that same scope and update **both** secrets (in `landing-page` and in `Pigeonhole`).
