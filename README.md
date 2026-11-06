# Nebula-Play OS — Games

Game launcher built on top of the UGS single-file repo, with a real-cover system.

## Quick start

1. **Fork / clone** this repo to your own GitHub.
2. **Enable Actions**: repo → Settings → Actions → Allow all actions.
3. **Run the cover builder**: Actions tab → "Build cover map" → **Run workflow**.
   - First test with `limit: 5` to confirm it works (~1 min).
   - Then run with `limit: 0` to build the full map (~15–20 min).
4. **Enable GitHub Pages**: Settings → Pages → Source: main branch / root.
5. Open `https://YOURUSER.github.io/REPO/` — done.

## How covers work

Cover lookup cascades through:

1. **OCR map** (`cover-map.json`) — built from `timmysmathwork/covers` via OCR
2. **Name-based CDN** (`freebuisness/covers`) — tries `<normalizedname>.png/jpg/webp`
3. **Gradient fallback** — deterministic color tile from the game name

To rebuild the OCR map (e.g. when covers get new images), just re-run the workflow.

## Changing the game source

Edit `index.html` → `const UGS_REPO`. The fetch uses `cl*.html` files from the repo root / subfolders via GitHub Trees API.

## Changing the covers repo

Edit `index.html` → `COVERS_TIM_REPO` and `COVERS_TIM_BRANCH`. Also update the same constants in `build-cover-map.js` → `COVERS_REPO`.
