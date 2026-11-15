# ADR-002: Stack

Status: accepted

## Decision

- TypeScript 5 (strict), React 18, Vite 5, Vitest 2.
- `vite-plugin-pwa` for the service worker and manifest.
- `tsx` to run the CLI scripts.
- No router, no state-management library, no CSS framework, no UI kit.
- Plain CSS with custom properties for design tokens.

## Why

- These are the versions the owner's other React project already uses, so tooling and habits carry over.
- The app has about a dozen screens and one source of truth (a list of actions). A reducer plus `useSyncExternalStore` covers it. A state library would add concepts for the cheaper models to get wrong.
- Screen changes are a single piece of state. A router adds URL handling the installed app never shows.
- Fewer dependencies means fewer things to break in a personal project nobody maintains weekly.

## Rules that follow

- Adding a runtime dependency needs a one-line justification in the task report and the reviewer's agreement.
- The engine has zero runtime dependencies, permanently.
- Engine tests run in Vitest's `node` environment; app tests in `jsdom`.
