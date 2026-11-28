# landing-page

Source for straysignals.dev, built with Eleventy and deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Local use

- `npm run build` writes the site to `_site/`
- `npm run serve` builds and serves it with live reload
- `npm test` runs the pixel tool checks

## Folders

- `avatar/` the face and its expressions
- `terminal/` the terminal and its commands
- `scripts/` desktop, window and app code
- `tools/` qr, palette, pixel and arcade
- `art/` things to look at
- `shared/` helpers used by several of the above (color, dom, screen)
- `root/` content for the terminal filesystem, including the Pigeonhole and ROAM submodules
- `build/` build and CI scripts

## Maintenance

- The `SUBMODULE_SYNC_TOKEN` secret in this repo expires Sep 21, 2026. It is a fine-grained PAT that lets `deploy.yml` and `sync-pigeonhole.yml` check out the private Pigeonhole submodule at `root/projects/pigeonhole`; the default `GITHUB_TOKEN` can't see that repo.
- The same token value is stored as `LANDING_PAGE_DISPATCH_TOKEN` in Pigeonhole.
- Scope: Contents read and write on both the Pigeonhole and landing-page repos.
- When it expires, generate a new PAT with that scope and update both secrets, `SUBMODULE_SYNC_TOKEN` in landing-page and `LANDING_PAGE_DISPATCH_TOKEN` in Pigeonhole.
