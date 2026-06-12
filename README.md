# One Piece TCG Simulator

Simulatore mobile cross-platform per One Piece Card Game, con card browser, deck builder, collection tracker, lobby online e modalita locale. La repo e organizzata come monorepo pnpm con app Expo, API Express, database Drizzle/PostgreSQL, client React Query generato da OpenAPI e un game engine condiviso.

## Stato del progetto

Il progetto ha buone fondamenta: Expo Router, TypeScript strict, TanStack Query, OpenAPI-first codegen, Drizzle ORM e separazione chiara tra mobile, API, DB e game engine. Al momento sembra pero piu vicino a un prototipo avanzato/MVP che a una release production-ready.

Priorita tecniche consigliate:

1. Spostare i token da AsyncStorage a storage sicuro, per esempio MMKV cifrato o SecureStore/MMKV in base ai requisiti di sicurezza.
2. Sostituire i form manuali di login/register con React Hook Form + Zod, condividendo le regole con gli schema API.
3. Eliminare `any` dai componenti e dagli handler di errore; usare `StyleProp<ViewStyle>` e narrowing sugli errori API.
4. Migliorare accessibilita di bottoni, touch target e input con `accessibilityLabel`, `accessibilityRole` e stati disabilitati chiari.
5. Standardizzare cache invalidation con TanStack Query invece di usare molti `refetch()` manuali dopo le mutation.
6. Rimuovere fallback deboli per `SESSION_SECRET` in produzione e fallire esplicitamente se manca la variabile.
7. Aggiungere test: unit test sul game engine, route API critiche e smoke test React Native con React Native Testing Library.

## Stack

- Package manager: pnpm workspaces
- Language: TypeScript strict
- Mobile: Expo SDK 54, React Native 0.81, Expo Router 6
- State/server data: TanStack Query
- API: Express 5
- Database: PostgreSQL + Drizzle ORM
- Validation/codegen: OpenAPI, Orval, Zod
- Auth: JWT access token + refresh token persistito su DB
- Game logic: package condiviso `@workspace/game-engine`

## Struttura

```text
artifacts/mobile/           Expo app iOS, Android e web
artifacts/api-server/       API Express
artifacts/mockup-sandbox/   Sandbox Vite per mockup web
lib/api-spec/               OpenAPI spec e configurazione Orval
lib/api-client-react/       Hook React Query generati
lib/api-zod/                Schema Zod generati
lib/db/                     Schema e accesso DB Drizzle
lib/game-engine/            Logica di gioco condivisa
scripts/                    Script di supporto e seed dati
attached_assets/            PDF regole e asset importati
```

## Prerequisiti

- Node compatibile con la repo
- pnpm
- PostgreSQL
- Expo tooling per sviluppo mobile

La repo usa `minimumReleaseAge` in `pnpm-workspace.yaml` per ridurre il rischio supply-chain. Evitare di disabilitarlo salvo emergenze controllate.

## Variabili ambiente

API server:

```bash
PORT=3000
DATABASE_URL=postgres://user:password@localhost:5432/op_tcg
SESSION_SECRET=replace-with-a-long-random-secret
```

Mobile:

```bash
EXPO_PUBLIC_DOMAIN=localhost:3000
```

Note:

- In sviluppo, `artifacts/mobile/scripts/dev-start.cjs` imposta `EXPO_PUBLIC_DOMAIN` da `REPLIT_DEV_DOMAIN` o `localhost:3000`.
- In produzione, evitare base URL vuoti e configurare sempre un dominio API esplicito.
- `SESSION_SECRET` non dovrebbe mai avere fallback in un deployment reale.

## Comandi principali

Installazione:

```bash
pnpm install
```

Typecheck completo:

```bash
pnpm run typecheck
```

Build completa:

```bash
pnpm run build
```

API server:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

Mobile Expo:

```bash
pnpm --filter @workspace/mobile run dev
```

Codegen API:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Push schema database:

```bash
pnpm --filter @workspace/db run push
```

Seed carte:

```bash
pnpm --filter @workspace/scripts run seed-cards
```

Test game engine:

```bash
pnpm --filter @workspace/game-engine test
```

## Flussi principali

- Auth: registrazione, login, refresh token, logout, profilo utente.
- Card browser: ricerca, filtro colore, dettaglio carta.
- Deck builder: creazione deck, scelta leader, aggiunta/rimozione carte.
- Collection tracker: copie possedute per carta.
- Lobby: creazione stanza, join partita, selezione deck.
- Local game: selezione deck player 1 e player 2 e avvio board locale.
- Dashboard: statistiche, match recenti e quick actions.

## Architettura API

`lib/api-spec/openapi.yaml` e la fonte di verita delle API. Orval genera:

- hook TanStack Query in `lib/api-client-react`
- schema/tipi Zod in `lib/api-zod`

Quando cambia un endpoint:

1. Aggiornare `lib/api-spec/openapi.yaml`.
2. Eseguire `pnpm --filter @workspace/api-spec run codegen`.
3. Aggiornare route Express e chiamate mobile se necessario.
4. Lanciare `pnpm run typecheck`.

## Note React Native

- La navigazione usa Expo Router file-based in `artifacts/mobile/app`.
- I token sono inizializzati in `artifacts/mobile/context/AuthContext.tsx`.
- Il base URL API viene risolto da `artifacts/mobile/lib/url.ts`.
- La UI usa `StyleSheet` e token colore in `artifacts/mobile/constants/colors.ts`.
- Evitare `Link asChild` con stili complessi su React Native Web; la repo usa `router.push()` con `TouchableOpacity`.

## Review tecnica sintetica

### Buone scelte

- Monorepo pulito con package separati per mobile, API, DB, API client e game engine.
- OpenAPI-first: riduce drift tra backend e frontend.
- TypeScript strict attivo nella mobile app.
- Query client centralizzato e hook API generati.
- Refresh token lato server con rotazione e persistenza su DB.
- Componenti di loading, empty state ed error boundary gia presenti.

### Rischi da correggere

- `artifacts/mobile/context/AuthContext.tsx` salva access token e refresh token in AsyncStorage. Questo e comodo ma non adeguato per token sensibili su mobile.
- `artifacts/api-server/src/lib/auth.ts` usa fallback statici per `SESSION_SECRET`. In produzione questo puo invalidare la sicurezza dei JWT.
- `artifacts/mobile/app/auth/login.tsx` e `register.tsx` validano i form manualmente e usano `catch (err: any)`.
- Alcuni componenti usano `style?: any`, perdendo il vantaggio del type checking.
- Molti handler mostrano solo `console.error`, senza feedback visibile o retry chiaro per l'utente.
- Diversi `TouchableOpacity` non espongono label/role accessibili.
- Alcune mutation fanno `refetch()` manuale; meglio usare `queryClient.invalidateQueries()` con query key stabili.

## Roadmap consigliata

1. Hardening auth e secret management.
2. Refactor form auth con React Hook Form + Zod.
3. Tipizzazione componenti e rimozione `any`.
4. Accessibilita e UX error states.
5. Cache invalidation TanStack Query.
6. Test minimi su auth, deck builder, card browser e game engine.
7. Preparazione build mobile reale con profili ambiente separati.

