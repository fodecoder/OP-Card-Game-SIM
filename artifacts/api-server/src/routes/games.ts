import { Router, type IRouter } from "express";
import { db, gamesTable, usersTable, decksTable, gameStatesTable, deckCardsTable, cardsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { CreateGameBody, JoinGameBody } from "@workspace/api-zod";
import { initializeGame } from "@workspace/game-engine";
import type { GameState } from "@workspace/game-engine";

const router: IRouter = Router();

async function loadDeckCards(deckId: number) {
  const rows = await db
    .select({ card: cardsTable })
    .from(deckCardsTable)
    .innerJoin(cardsTable, eq(deckCardsTable.cardId, cardsTable.id))
    .where(eq(deckCardsTable.deckId, deckId));
  return rows.map((r) => ({ ...r.card, keywords: r.card.keywords ?? [] }));
}

async function formatGame(game: typeof gamesTable.$inferSelect) {
  const [host] = await db.select().from(usersTable).where(eq(usersTable.id, game.hostId));
  let guestUsername: string | null = null;
  if (game.guestId) {
    const [guest] = await db.select().from(usersTable).where(eq(usersTable.id, game.guestId));
    guestUsername = guest?.username ?? null;
  }
  return {
    id: game.id,
    status: game.status,
    isPrivate: game.isPrivate,
    hostId: game.hostId,
    hostUsername: host?.username ?? "Unknown",
    hostDeckId: game.hostDeckId ?? null,
    guestId: game.guestId ?? null,
    guestUsername,
    guestDeckId: game.guestDeckId ?? null,
    winnerId: game.winnerId ?? null,
    createdAt: game.createdAt.toISOString(),
    startedAt: game.startedAt?.toISOString() ?? null,
    endedAt: game.endedAt?.toISOString() ?? null,
  };
}

router.get("/games", async (req, res): Promise<void> => {
  const games = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.status, "waiting"));

  const result = await Promise.all(games.map(formatGame));
  res.json(result);
});

router.post("/games", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;

  const parsed = CreateGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { deckId, isPrivate, isLocal, guestDeckId } = parsed.data;

  const [deck] = await db
    .select()
    .from(decksTable)
    .where(and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)));

  if (!deck) {
    res.status(400).json({ error: "Deck not found or does not belong to you" });
    return;
  }

  if (isLocal) {
    if (!guestDeckId) {
      res.status(400).json({ error: "Local game requires a guest deck" });
      return;
    }
    const [guestDeck] = await db
      .select()
      .from(decksTable)
      .where(and(eq(decksTable.id, guestDeckId), eq(decksTable.userId, userId)));

    if (!guestDeck) {
      res.status(400).json({ error: "Guest deck not found or does not belong to you" });
      return;
    }

    const [hostCards, guestCards] = await Promise.all([
      loadDeckCards(deckId),
      loadDeckCards(guestDeckId),
    ]);

    if (hostCards.length === 0) {
      res.status(400).json({ error: "Your deck is empty. Add cards before playing." });
      return;
    }
    if (guestCards.length === 0) {
      res.status(400).json({ error: "Opponent deck is empty. Add cards before playing." });
      return;
    }

    let gameState: GameState;
    try {
      gameState = initializeGame(userId, deckId, hostCards, userId, guestDeckId, guestCards);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initialize game";
      res.status(400).json({ error: msg });
      return;
    }

    const [localGame] = await db
      .insert(gamesTable)
      .values({
        hostId: userId,
        hostDeckId: deckId,
        guestId: userId,
        guestDeckId,
        isPrivate: isPrivate ?? false,
        status: "active",
        startedAt: new Date(),
      })
      .returning();

    await db
      .insert(gameStatesTable)
      .values({ gameId: localGame.id, state: gameState as unknown as Record<string, unknown> });

    res.status(201).json(await formatGame(localGame));
    return;
  }

  const [game] = await db
    .insert(gamesTable)
    .values({
      hostId: userId,
      hostDeckId: deckId,
      isPrivate: isPrivate ?? false,
      status: "waiting",
    })
    .returning();

  res.status(201).json(await formatGame(game));
});

router.get("/games/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  res.json(await formatGame(game));
});

router.delete("/games/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  if (game.hostId !== userId) {
    res.status(403).json({ error: "Only the host can close this room" });
    return;
  }

  if (game.status !== "waiting") {
    res.status(400).json({ error: "Can only close rooms that are still waiting" });
    return;
  }

  await db.delete(gamesTable).where(eq(gamesTable.id, id));
  res.sendStatus(204);
});

router.post("/games/:id/join", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const gameId = parseInt(raw, 10);

  const parsed = JoinGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  if (game.status !== "waiting") {
    res.status(400).json({ error: "Game is not open to join" });
    return;
  }

  if (game.hostId === userId) {
    res.status(400).json({ error: "Cannot join your own game" });
    return;
  }

  const { deckId } = parsed.data;

  const [deck] = await db
    .select()
    .from(decksTable)
    .where(and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)));

  if (!deck) {
    res.status(400).json({ error: "Deck not found or does not belong to you" });
    return;
  }

  const [updated] = await db
    .update(gamesTable)
    .set({
      guestId: userId,
      guestDeckId: deckId,
      status: "active",
      startedAt: new Date(),
    })
    .where(eq(gamesTable.id, gameId))
    .returning();

  res.json(await formatGame(updated));
});

export default router;
