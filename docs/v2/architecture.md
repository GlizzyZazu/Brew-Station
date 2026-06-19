# Brew Station V2 Architecture

V2 is a campaign-first rewrite. The current app remains the prototype/reference.

## Principles

- Campaigns are the center of the product.
- Rulesets are modular and data-driven.
- Supabase access is role-aware and scoped by campaign membership.
- UI is built from reusable primitives, not inline one-off layouts.
- Feature logic lives outside page components.
- Every phase leaves the app runnable and testable.

## Workspaces

- Player: characters, sheets, inventory, spells/features, party status, private notes.
- DM: campaign dashboard, sessions, encounters, NPCs, clues, secrets, loot, party overview.
- Library: rulesets, classes, species, backgrounds, spells, items, conditions, import/export.

## Target Frontend Structure

```text
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
    layout/
  components/
    ui/
    forms/
    data-display/
  features/
    auth/
    campaigns/
    characters/
    parties/
    sessions/
    encounters/
    library/
    notes/
    secrets/
  rulesets/
    dnd5e-2024/
    dnd5e-legacy/
    homebrew/
  lib/
    supabase/
    validation/
    dates/
  tests/
```

## Suggested Stack

- React + Vite + TypeScript
- Supabase
- TanStack Query for server state
- Zod for validation/parsing
- React Hook Form for forms
- Zustand or small React contexts for UI state
- Playwright later for critical browser flows

## First Code Milestone

- Auth gate
- Sidebar layout
- Campaign list page
- Empty states
- Supabase connection check
- Basic test setup
