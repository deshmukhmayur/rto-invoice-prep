# 0001 — Defer telemetry; use GitHub download counts

Date: 2026-10-13
Status: Accepted

## Context

We wanted to know how many users have installed the app and are actively using it. The user base is currently very small, so measurement needs were minimal.

## Decision

No telemetry code and no infrastructure. The only usage signal is the per-asset **download count** on GitHub Releases (eyeballed on the Releases page). A Cloudflare Worker + D1 beacon (install ID, launch pings, invoice-export counts, aggregate `/stats`) is explicitly slated for later if usage grows.

## Why

- The app is an Electron build distributed via GitHub Releases; the counter exists for free.
- The Cloudflare design added an endpoint the updater or app must reach, a worker + D1 to deploy, and a stats surface — not worth it at this scale.
- Considered and rejected along the way: third-party vendors (Aptabase/PostHog — constraint: no third party), piggybacking the electron-updater feed through a worker (complexity), DNS/favicon beacons (fragile).

## Known limits (accepted)

- Download count is a cumulative downloads total, not installs or active users: it lags hours, never decays, and is inflated over time by auto-updates (electron-updater downloads the same release assets).
- No way to distinguish version adoption, retention, or actual invoice usage.

## Revisit when

Usage grows beyond eyeballing, or any question arises that download counts cannot answer (active users, retention, exports). The deferred design: Cloudflare Worker + D1, own UUID install ID in userData, launch beacon + per-quit export-count event, aggregate-only `/stats`, fire-and-forget, packaged builds only.
