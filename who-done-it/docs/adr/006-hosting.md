# ADR-006: Hosting and install

Status: accepted (host chosen; deploy method to settle in task 5.4)

## Decision

Serve the game with **GitHub Pages from the public `studious-disco-public` repository**, at the path `/who-done-it/` next to the owner's other games. Free, HTTPS, no new account.

The game is a built app (Vite), unlike Capital Clash at the repository root, which is plain files. So Pages must serve the **built** `who-done-it/dist/`, not the source folder.

## How to deploy (task 5.4)

Use a GitHub Actions workflow that publishes Pages:

1. Trigger on pushes to the default branch.
2. In `who-done-it/`: `npm ci`, `npm test`, `npm run build`.
3. Assemble a site folder: the repository root's static files (so Capital Clash keeps working at the same address) plus `who-done-it/dist` copied to `site/who-done-it/`.
4. Upload it with `actions/upload-pages-artifact` and publish with `actions/deploy-pages`.

This needs one setting changed by the owner: repository Settings, Pages, Source: "GitHub Actions". **Check how Pages is set up today before changing it.** If it currently serves a branch directly, switching the source changes how Capital Clash is published, so the workflow must include the root files as in step 3.

`base: './'` in `vite.config.ts` keeps the build path-independent, so it works under `/who-done-it/`.

## Privacy

The repository and the site are public. The game holds no personal data, and saves stay on each phone, so that is acceptable.

## Install steps (shown on the Home screen)

**iPhone**
1. Open the game's URL in **Safari** (not Chrome).
2. Tap the Share button.
3. Tap "Add to Home Screen", then "Add".
4. Open the game from the new icon. It now runs full screen and works offline.

**Android**
1. Open the URL in **Chrome**.
2. Tap "Install app" when offered, or open the ⋮ menu and tap "Install app" / "Add to Home screen".
3. Open the game from the new icon.

## Alternatives considered

- **Cloudflare Pages**: works with private repositories and can add a login gate. Not needed now that the game lives in a public repository.
- **Committing `dist/` to the repository**: no workflow needed, but built files in git go stale and bloat history. Rejected.
