# One Piece TCG Simulator

A cross-platform One Piece Card Game simulator with card browsing, deck building, collection tracking, online lobby flow, and local game mode. The repository is a pnpm monorepo with an Expo mobile app, Express API, Drizzle/PostgreSQL database layer, OpenAPI-generated React Query client, and a shared game engine.

## Project Status

The project has solid foundations and is already shaped like a real product: Expo Router, TypeScript strict mode, TanStack Query, OpenAPI-first code generation, Drizzle ORM, and a separate game-engine package. It should still be treated as an advanced MVP rather than a production-ready release.

Recommended technical priorities:

1. Move mobile auth tokens out of AsyncStorage and into a safer storage strategy.
2. Replace manual login/register form validation with React Hook Form + Zod.
3. Remove remaining `any` usage from components and error handlers.
4. Improve accessibility labels, roles, disabled states, and touch targets.
5. Standardize TanStack Query invalidation after mutations.
6. Require `SESSION_SECRET` in production instead of falling back to static defaults.
7. Add tests for auth, deck building, card browsing, and game-engine behavior.

## Stack

- Package manager: pnpm workspaces
- Language: TypeScript strict
- Mobile: Expo SDK 54, React Native 0.81, Expo Router 6
- Server state: TanStack Query
- API: Express 5
- Database: PostgreSQL + Drizzle ORM
- Validation and codegen: OpenAPI, Orval, Zod
- Auth: JWT access token + refresh token persisted in DB
- Game logic: shared `@workspace/game-engine` package

## Repository Layout

```text
artifacts/mobile/           Expo app for iOS, Android, and web
artifacts/api-server/       Express API server
artifacts/mockup-sandbox/   Vite web mockup sandbox
lib/api-spec/               OpenAPI spec and Orval config
lib/api-client-react/       Generated React Query hooks
lib/api-zod/                Generated Zod schemas
lib/db/                     Drizzle schema and DB client
lib/game-engine/            Shared game rules and state transitions
scripts/                    Utility scripts and card seeding
attached_assets/            Rule PDFs and imported assets
```

## Prerequisites

- Node compatible with this workspace
- pnpm
- PostgreSQL
- Expo tooling for local mobile development
- Optional: Docker, if PostgreSQL is running in a container

The workspace uses `minimumReleaseAge` in `pnpm-workspace.yaml` to reduce npm supply-chain risk. Do not disable it unless there is a controlled emergency.

## Environment Variables

API server:

```bash
PORT=3000
DATABASE_URL=postgres://user:password@localhost:5432/op_tcg
SESSION_SECRET=replace-with-a-long-random-secret
```

Mobile app:

```bash
EXPO_PUBLIC_DOMAIN=localhost:3000
```

Notes:

- `artifacts/mobile/scripts/dev-start.cjs` defaults `EXPO_PUBLIC_DOMAIN` to `REPLIT_DEV_DOMAIN` or `localhost:3000`.
- `SESSION_SECRET` should always be configured in real deployments.
- `EXPO_PUBLIC_DOMAIN` should point to the API host reachable by the mobile runtime. On a physical phone, `localhost` means the phone itself, not your development machine.

## Database Access

There is no `docker-compose.yml` in this repository, so access depends on how the PostgreSQL container was started. First identify the running container:

```bash
docker ps
```

If you know the DB user and database name:

```bash
docker exec -it <postgres-container> psql -U <user> -d <database>
```

Useful psql commands:

```sql
\dt
\d cards
select id, card_number, name, card_type, color, rarity, set_code from cards order by id limit 20;
select * from decks order by id desc limit 10;
select * from deck_cards limit 20;
select * from user_collections limit 20;
```

If `psql` is installed locally and `DATABASE_URL` is set:

```bash
psql "$DATABASE_URL"
```

On PowerShell:

```powershell
$env:DATABASE_URL="postgres://user:password@localhost:5432/op_tcg"
psql $env:DATABASE_URL
```

You can also use Drizzle Kit against the configured database:

```bash
pnpm --filter @workspace/db exec drizzle-kit studio --config ./drizzle.config.js
```

## Local Development

Install dependencies:

```bash
pnpm install
```

Set environment variables in the current PowerShell session:

```powershell
$env:PORT="3000"
$env:DATABASE_URL="postgres://user:password@localhost:5432/op_tcg"
$env:SESSION_SECRET="replace-with-a-long-random-secret"
$env:EXPO_PUBLIC_DOMAIN="localhost:3000"
```

Push the DB schema:

```bash
pnpm --filter @workspace/db run push
```

Seed sample cards:

```bash
pnpm --filter @workspace/scripts run seed-cards
```

Start the API server:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

Start the Expo app in another terminal:

```bash
pnpm --filter @workspace/mobile run dev
```

For a physical device on the same network, use your machine LAN IP instead of localhost:

```powershell
$env:EXPO_PUBLIC_DOMAIN="192.168.1.20:3000"
pnpm --filter @workspace/mobile run dev
```

## Common Commands

Full typecheck:

```bash
pnpm run typecheck
```

Full build:

```bash
pnpm run build
```

Regenerate API clients from OpenAPI:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Run game-engine tests:

```bash
pnpm --filter @workspace/game-engine test
```

## Main Product Flows

- Auth: register, login, token refresh, logout, current user.
- Card browser: search, color filter, card detail.
- Deck builder: create decks, select leader, add/remove cards.
- Collection tracker: track owned copies of each card.
- Lobby: create room, join room, select deck.
- Local game: select player 1 and player 2 decks, then start the board.
- Dashboard: stats, recent matches, and quick actions.

## API Architecture

`lib/api-spec/openapi.yaml` is the source of truth for the API contract. Orval generates:

- React Query hooks in `lib/api-client-react`
- Zod schemas and types in `lib/api-zod`

When an endpoint changes:

1. Update `lib/api-spec/openapi.yaml`.
2. Run `pnpm --filter @workspace/api-spec run codegen`.
3. Update the Express route and mobile usage if needed.
4. Run `pnpm run typecheck`.

## Card Variants

One Piece cards can have base and alternate printings. The desired serial format is:

```text
XX-NUM (V.Y)
```

Where:

- `XX` is the expansion prefix, such as `ST`, `OP`, `PRB`, or `P`.
- `NUM` is the card number inside that expansion, such as `001` or `125`.
- `(V.Y)` is an optional variant marker, where `Y` is a variant number from 1 to n.

Recommended model:

- Keep gameplay identity separate from printing identity.
- Use a canonical card identity for deck legality, copy limits, effects, and game-engine behavior.
- Store individual printings/variants as selectable visual versions.
- Deck entries and collection entries should reference the selected printing, while validation should count copies by canonical card identity.

Current state:

- `cards.card_number` is currently treated as unique.
- `deck_cards` and `user_collections` currently store only `card_id + quantity`.
- This means variants can work today only if each variant is inserted as a separate card row, but copy-limit validation would count them separately unless extra canonical identity fields are added.

Suggested future schema:

```text
cards
  id
  canonical_card_number   -- OP01-001
  print_code              -- OP01-001 or OP01-001 (V.1)
  variant_code            -- null, V.1, V.2
  variant_label           -- Base, Alternate Art, Manga, Parallel, etc.
  image_url
  gameplay/effect fields

deck_cards
  deck_id
  card_id                 -- selected printing
  quantity

user_collections
  user_id
  card_id                 -- selected printing
  quantity
```

Then deck validation should enforce max copies by `canonical_card_number`, not by `card_id`.

## React Native Notes

- Navigation uses Expo Router file-based routes in `artifacts/mobile/app`.
- Auth state is initialized in `artifacts/mobile/context/AuthContext.tsx`.
- API base URL resolution lives in `artifacts/mobile/lib/url.ts`.
- UI uses `StyleSheet` and color tokens from `artifacts/mobile/constants/colors.ts`.
- Avoid `Link asChild` with complex styles on React Native Web; the app uses `router.push()` with touchables.
- Code comments should be written in English.

## Technical Review Summary

### Strengths

- Clean package boundaries for mobile, API, DB, generated clients, and game logic.
- OpenAPI-first API contract reduces frontend/backend drift.
- TypeScript strict mode is enabled.
- Generated TanStack Query hooks are already in use.
- Server-side refresh token rotation is implemented.
- Loading, empty, and error boundary components already exist.

### Risks

- Mobile auth tokens are stored in AsyncStorage.
- Production auth secrets should not have static fallbacks.
- Auth forms are manually validated and still use loose error handling.
- Several components still use loose style typing.
- Some user-facing errors are only logged with `console.error`.
- Some touchables do not yet expose accessibility labels and roles.
- Mutation cache handling is mostly manual `refetch()` instead of query invalidation.

## Recommended Roadmap

1. Harden auth storage and production secret handling.
2. Add card variant support with canonical card identity.
3. Refactor auth forms with React Hook Form + Zod.
4. Improve accessibility and visible error states.
5. Standardize TanStack Query invalidation.
6. Add focused tests for auth, deck builder, card browser, and game engine.
7. Prepare separate development, staging, and production mobile build profiles.

