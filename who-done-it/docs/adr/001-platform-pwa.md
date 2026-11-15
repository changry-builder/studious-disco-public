# ADR-001: Platform is a Progressive Web App

Status: accepted

## Decision

Build one installable PWA. No native app, no Expo, no Capacitor wrapper in v1.

## Why

- The game must install on both iPhone and Android with no app stores and no developer accounts. A PWA does that from a single URL.
- A native iPhone build (Expo or otherwise) needs a paid Apple developer account, or a free one whose builds expire after 7 days. That fails the brief.
- The game needs nothing native: no camera, no notifications, no background work. It is text, taps and local storage.
- The engine is pure TypeScript, so a native shell could be added later without rewriting anything.

## What we accept

- iPhone install is manual: Safari, Share, "Add to Home Screen". There is no install prompt.
- iOS can evict storage for sites not added to the home screen after about 7 days without use. Installed home-screen apps are not subject to that cap. The Home screen should remind an iPhone user who is running in a Safari tab to install.
- iOS only plays sound after a tap. Sound is optional anyway.

## Alternatives considered

- **Expo / React Native**: better feel, but blocked on iPhone by the developer account. Rejected.
- **Capacitor**: wraps the web app as an Android APK only. No gain for this game. Could be added later for Android if wanted.
