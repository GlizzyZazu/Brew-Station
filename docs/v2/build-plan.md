# Brew Station V2 Build Plan

## Current Status - June 19, 2026

- Branch `rewrite/v2` is clean and synced with GitHub at `7268842 Extract campaign secrets sections`.
- V2 is running as the root-level React/Vite/TypeScript app with optional Supabase persistence.
- Campaign core, character core, session notes, secrets/reveals, encounters, runner controls, SRD library browsing, monster combatant importing, player view, player summary, and player handout export are implemented.
- Supabase schema diagnostics exist in Settings, and a manual Supabase smoke pass succeeded after editing, saving, and refreshing an existing test campaign.
- The campaign dashboard refactor pass is mostly complete: major dashboard sections and encounter internals now live in focused components instead of one large dashboard file.
- Latest verification before the current status update: `npm run build`, `npm run lint`, and `npm run test:e2e`.

## Recommended Next Work

- Polish the campaign dashboard UX now that the component split is in place.
- Tighten dense DM workflows: section navigation, edit affordances, encounter prep/run flow, and runner notes ergonomics.
- Review player view and handout export affordances so the player-facing path is obvious without exposing DM-only data.

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
