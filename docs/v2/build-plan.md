# Brew Station V2 Build Plan

## Current Status - June 19, 2026

- V2 is merged to `main` through PR #1 at `7e19c2c Brew Station V2 campaign workspace rewrite`.
- V2 is running as the root-level React/Vite/TypeScript app with optional Supabase persistence.
- Campaign core, character core, session notes, secrets/reveals, encounters, runner controls, SRD library browsing, monster combatant importing, player view, player summary, and player handout export are implemented.
- The top-level Characters workspace uses a step-by-step builder for campaign-linked, 2024-compatible sheets; unassigned owner-level characters remain a future schema/model extension.
- Supabase schema diagnostics exist in Settings, and a manual Supabase smoke pass succeeded after editing, saving, and refreshing an existing test campaign.
- The campaign dashboard refactor and first UX polish pass are complete: major dashboard sections and encounter internals now live in focused components, section nav has count badges, Player View handout download is surfaced, and runner note filtering reports visible result counts.
- Latest post-merge verification from `main`: `npm run build`, `npm run lint`, and `npm run test:e2e`.

## Recommended Next Work

- Harden release documentation: Supabase migration order, release checklist, and baseline smoke-test steps.
- Run a live Supabase schema diagnostic and campaign save/refresh smoke pass before each release baseline.
- Continue focused UX work in small branches after the release hardening pass.

## Phase 0: Planning

- Create `rewrite/v2`.
- Document architecture.
- Document schema.

## Phase 1: Foundation

- Clean Vite React TypeScript shell.
- Routing.
- Providers.
- Design tokens.
- UI primitives.
- Supabase client.
- Auth screens.

## Phase 2: Campaign Core

- Campaign list.
- Create campaign.
- Campaign dashboard.
- Campaign member roles.
- Campaign settings.

## Phase 3: Character Core

- Campaign-scoped character list.
- Character creation.
- 2024 D&D ruleset data layer.
- Character sheet shell.
- Local draft save and Supabase save.

## Phase 4: Library

- Library pack model.
- Spells/items/conditions.
- Import/export.
- Built-in 5e 2024 starter content.
- Legacy/expanded support for Artificer.

## Phase 5: DM Tools

- Session notes.
- Secrets and reveals.
- Encounter tracker.
- Roll log.
- NPC/monster notes.

## Phase 6: Party Tools

- Presence.
- Join requests.
- Party dashboard.
- Player/DM scoped views.

## Phase 7: Campaign Integration

- Greyholt campaign preset.
- Character presets for Cael, Bram, Lucien, and Oren.
- Session 1 scene support.
- Custom clues, secrets, conditions, and items.
