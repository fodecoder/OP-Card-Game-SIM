# One Piece TCG Simulator

A competitive One Piece Card Game simulator with deck builder, card collection, and real-time game lobby — built as a cross-platform mobile app (iOS/Android/web).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/mobile run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed-cards` — seed sample One Piece card data
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo + React Native (web/iOS/Android), expo-router v6, React Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (access 15m + refresh 7d) via `SESSION_SECRET`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API endpoints
- `lib/db/src/schema/index.ts` — exports all 6 DB tables
- `lib/api-client-react/` — generated React Query hooks (from codegen)
- `lib/api-zod/` — generated Zod schemas (from codegen)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/auth.ts` — JWT sign/verify + `requireAuth` middleware + `AuthRequest` interface
- `artifacts/mobile/app/` — Expo Router screens (file-based routing)
- `artifacts/mobile/context/AuthContext.tsx` — auth state + AsyncStorage persistence
- `artifacts/mobile/constants/colors.ts` — dark navy/gold design tokens
- `scripts/src/seed-cards.ts` — 25 sample OP01-OP03 cards

## Architecture decisions

- **OpenAPI-first**: The spec drives generated hooks and Zod validators — never write client fetching code by hand.
- **JWT dual-token**: Short-lived access tokens (15m) + long-lived refresh tokens (7d) stored in DB for revocation.
- **`AuthRequest` pattern**: All authenticated routes use `(req as unknown as AuthRequest).userId` to avoid TS2352 errors with Express 5's stricter types.
- **`router.push()` not `Link asChild`**: On React Native Web, `Link asChild` with StyleSheet ID arrays crashes the CSS engine. Always use `router.push()` with `TouchableOpacity`.
- **No `react-native-keyboard-controller` on web**: The `KeyboardProvider` is web-incompatible; `KeyboardAwareScrollViewCompat` handles the platform split.

## Product

- **Auth flow**: Register, login, JWT refresh, logout
- **Card Browser**: Search, filter by color, view card details (25 seeded OP01–OP03 cards)
- **Deck Builder**: Create/edit decks, validate 60-card rule, set leader
- **Collection Tracker**: Track owned copies of each card
- **Game Lobby**: Create and join game rooms, see open/in-progress/finished games
- **Dashboard**: Win/loss stats, recent matches, quick actions

## User preferences

- Dark navy/gold One Piece theme throughout
- No emojis in code or UI

## Gotchas

- **Never use `Link asChild`** with complex styles on web — use `router.push()` instead.
- **Seed cards** before testing card features: `pnpm --filter @workspace/scripts run seed-cards`
- Run codegen after any OpenAPI spec change: `pnpm --filter @workspace/api-spec run codegen`
- The mobile workflow needs `EXPO_PUBLIC_DOMAIN` env var (set automatically by the workflow config).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
