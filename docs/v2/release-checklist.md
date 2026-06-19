# Brew Station V2 Release Checklist

Use this checklist before cutting a release, merging a post-V2 branch, or treating `main` as a deployment baseline.

## Local Verification

1. Confirm the branch is clean with `git status --short --branch`.
2. Run `npm run build`.
3. Run `npm run lint`.
4. Run `npm run test:e2e`.
5. Start the app with `npm run dev` and confirm the shell loads at `http://127.0.0.1:5173/`.
6. Confirm the bundled SRD pack responds at `http://127.0.0.1:5173/packs/5e-srd-library.json`.

## Supabase Verification

1. Confirm `.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Apply the SQL listed in `docs/v2/supabase-migration-order.md`.
3. Sign in from Settings.
4. Run the Settings Supabase schema diagnostic and confirm every V2 table check passes.
5. Open an existing test campaign, edit a field, save, refresh, and confirm the change persists.
6. In DM View, add or update one session, party member, character, secret, and encounter.
7. Reveal one secret and confirm Player View only shows player-safe sections and revealed content.
8. Download the Player View handout and confirm it excludes hidden secrets, encounter tooling, prep notes, and private character notes.

## GitHub Verification

1. Open the pull request Files changed tab and scan for accidental files such as build output, local env files, logs, or editor metadata.
2. Confirm GitHub/Vercel checks pass on the latest commit.
3. Confirm README and V2 docs describe the current branch, migration order, and verification commands.
4. Merge only after local checks, Supabase smoke, and deployed checks agree.

## Post-Merge Baseline

1. Fetch `origin`.
2. Switch to `main`.
3. Fast-forward to `origin/main`.
4. Rerun `npm run build`, `npm run lint`, and `npm run test:e2e`.
5. Update `/home/gabrielc/codex/brew-station-context.md` with the merged commit and next milestone.
