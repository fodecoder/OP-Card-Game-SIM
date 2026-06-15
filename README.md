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
DATABASE_URL=postgres://<real-user>:<real-password>@localhost:<published-port>/<real-database>
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

Inspect the container configuration to find its PostgreSQL user, database, and published host port:

```bash
docker inspect <postgres-container>
docker exec <postgres-container> printenv POSTGRES_USER
docker exec <postgres-container> printenv POSTGRES_DB
```

Docker Desktop also shows these values under the container's **Inspect** and **Ports** tabs. The password may be stored in `POSTGRES_PASSWORD`, a Docker secret, or the command/script that originally created the container.

For the official `postgres` Docker image, a missing `POSTGRES_USER` defaults to
`postgres`. A PostgreSQL URL would therefore start with:

```text
postgres://postgres:<real-password>@localhost:<published-port>/<real-database>
```

If `POSTGRES_DB` is also missing, it normally defaults to the selected user
name, so the database is usually `postgres`.

These environment variables are only used when the data directory is first
initialized. If the container uses an existing volume, changing
`POSTGRES_USER`, `POSTGRES_PASSWORD`, or `POSTGRES_DB` later does not change the
credentials stored in that volume.

Example only:

```text
POSTGRES_USER=postgres
POSTGRES_PASSWORD=my-local-password
POSTGRES_DB=op_tcg
PORTS=0.0.0.0:5432->5432/tcp
```

This produces:

```bash
DATABASE_URL=postgres://postgres:my-local-password@localhost:5432/op_tcg
```

Do not copy the literal `user`, `password`, or `op_tcg` placeholders unless those are the actual values configured in your container.

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
$env:DATABASE_URL="postgres://<real-user>:<real-password>@localhost:<published-port>/<real-database>"
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

### Database Authentication Troubleshooting

PostgreSQL error `28P01` means that the server was reached, but the username or password is wrong:

```text
password authentication failed for user "user"
```

Verify the connection before running Drizzle or the seed:

```powershell
psql $env:DATABASE_URL -c "select current_user, current_database();"
```

The repository also provides a connection diagnostic that does not print the
password:

```powershell
pnpm --filter @workspace/db run check
```

If `psql` is not installed locally, run the check inside the container:

```bash
docker exec -it <postgres-container> psql -U <real-user> -d <real-database> -c "select current_user, current_database();"
```

Then run:

```bash
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed-cards
```

The API now verifies the database connection before opening its HTTP port. Invalid credentials cause startup to fail immediately with a database configuration message instead of returning an HTML 500 error during login or registration.

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

## Game Rules and Formats

Game creation validates decks on the server immediately before a room is
created, joined, or initialized:

- `local`: requires one Leader and at least one main-deck card, but does not
  apply tournament color, copy, rotation, or ban-list rules.
- `standard`: applies the April 2026 Standard Regulation card pool (Blocks
  2-5), the 50-card rule, Leader colors, copy limits, banned cards, and banned
  pairs.
- `extra`: allows cards from every block while retaining the tournament deck
  construction rules and banned/restricted list.

The competitive list is based on the official rules effective April 10, 2026.
When Bandai revises it, update `BANNED_CARDS` and `BANNED_PAIRS` in
`lib/game-engine/src/deck-rules.ts`.

## Extending Keywords and Effects

Keywords that change core battle rules belong in the engine, not in the UI.
`Rush`, `Blocker`, `Double Attack`, and `Banish` are currently interpreted
directly by `lib/game-engine/src/engine.ts`. Add another keyword by normalizing
its spelling in card data and checking it at the rule point it modifies.

Ordered card effects are represented as an operation queue. The generic parser
currently recognizes:

```text
draw N card(s)
trash/discard N card(s) from your hand
```

The parser records operations in textual order. Therefore:

```text
Trash 1 card from your hand, then draw 1 card.
```

requires a hand selection before drawing, while:

```text
Draw 1 card, then trash 1 card from your hand.
```

draws first and then blocks play until the player selects a card to trash.

To add a new reusable operation:

1. Add a variant to `EffectOperation` in `lib/game-engine/src/types.ts`.
2. Parse the phrase in `parseOrderedEffects`.
3. Resolve it in `continuePendingEffect`, pausing with `pendingEffect` when
   player input is required.
4. Add the corresponding selection control to the game board.
5. Cover both operation orderings with an engine test.

Effects involving targets, searches, replacement effects, optional costs, or
moving cards to the bottom of a deck should use explicit typed operations
rather than broad text matching. Card-specific effects that have not yet been
modeled are logged but are not silently treated as resolved.

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
