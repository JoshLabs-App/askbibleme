# Mobile Content Delivery Baseline

This file defines the minimum baseline for "content-first updates without store resubmission".

## 1) Content Architecture Layers

- **Layer A (bundled fallback)**: app-bundled JSON/SQLite/assets for offline safety.
- **Layer B (remote manifest)**: `/api/mobile/content/manifest` controls remotely updatable content entries.
- **Layer C (runtime fetch)**: client fetches manifest, then fetches content by manifest entries.

Current baseline routes:

- `/api/mobile/content/manifest`
- `/api/mobile/content/flags`
- `/api/nature/settings`
- `/api/music/companion`
- `/api/read/reading-plans/registry`

## 2) Interface Versioning Rules

- Every mobile content control response must include `schemaVersion`.
- New fields must be optional and have defaults in client normalization.
- Breaking schema changes require a new `schemaVersion` and compatibility branch.

## 3) Feature Flags Rules

- Use server-side flags for fast rollback (no binary rebuild).
- Current flags:
  - `MOBILE_REMOTE_CONTENT_MANIFEST_ENABLED`
  - `MOBILE_EXPLORE_CATEGORIES_REMOTE_ENABLED`
  - `MEMBER_REGISTER_ENABLED`
- Client gate for membership entry:
  - `EXPO_PUBLIC_MEMBER_REGISTER_ENABLED`

## 4) Manifest + Cache + Fallback Rules

- Client attempts remote manifest first in non-bundled mode.
- If remote fails, fallback order is:
  1. cached manifest
  2. bundled manifest
- Never leave homepage on a hard dependency that can white-screen.

## 5) When Store Resubmission Is Required

Only required when changing native footprint, for example:

- new native permissions
- new native SDK/library/plugin
- Expo SDK / React Native major native upgrade
- package id / signing / deep native config changes

Otherwise prefer data update or OTA update.
