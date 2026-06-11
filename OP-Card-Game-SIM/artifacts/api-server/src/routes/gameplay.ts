import { Router, type IRouter } from "express";
import { db, gamesTable, gameStatesTable, decksTable, deckCardsTable, cardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { initializeGame, processAction } from "@workspace/game-engine";
import type { GameState, GameAction, PlayerSide } from "@workspace/game-engine";

const router: IRouter = Router();

async function loadDeckCards(deckId: number) {
  const rows = await db
    .select({ card: cardsTable })
    .from(deckCardsTable)
    .innerJoin(cardsTable, eq(deckCardsTable.cardId, cardsTable.id))
    .where(eq(deckCardsTable.deckId, deckId));
  const cards = rows.map((r) => ({
    ...r.card,
    subtypes: r.card.subtypes ?? [],
    keywords: r.card.keywords ?? [],
  }));
  return cards;
}

router.post("/games/:id/initialize", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const gameId = parseInt(req.params.id as string, 10);

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  if (game.hostId !== userId && game.guestId !== userId) {
    res.status(403).json({ error: "Not a participant of this game" });
    return;
  }
  if (!game.guestId || !game.hostDeckId || !game.guestDeckId) {
    res.status(400).json({ error: "Game is not ready (need both players and decks)" });
    return;
  }

  const existing = await db.select().from(gameStatesTable).where(eq(gameStatesTable.gameId, gameId));
  if (existing.length > 0) {
    res.status(400).json({ error: "Game already initialized" });
    return;
  }

  const [hostCards, guestCards] = await Promise.all([
    loadDeckCards(game.hostDeckId),
    loadDeckCards(game.guestDeckId),
  ]);

  if (hostCards.length === 0) {
    res.status(400).json({ error: "Host deck is empty" });
    return;
  }
  if (guestCards.length === 0) {
    res.status(400).json({ error: "Guest deck is empty" });
    return;
  }

  let gameState: GameState;
  try {
    gameState = initializeGame(
      game.hostId,
      game.hostDeckId,
      hostCards,
      game.guestId,
      game.guestDeckId,
      guestCards,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to initialize game";
    res.status(400).json({ error: msg });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(gameStatesTable)
      .values({ gameId, state: gameState as unknown as Record<string, unknown> });
    await tx
      .update(gamesTable)
      .set({ status: "active", startedAt: new Date() })
      .where(eq(gamesTable.id, gameId));
  });

  res.status(201).json(gameState);
});

router.get("/games/:id/state", async (req, res): Promise<void> => {
  const gameId = parseInt(req.params.id as string, 10);

  const [row] = await db.select().from(gameStatesTable).where(eq(gameStatesTable.gameId, gameId));
  if (!row) {
    res.status(404).json({ error: "Game state not found. Initialize the game first." });
    return;
  }

  res.json({ state: row.state, version: row.version });
});

router.post("/games/:id/action", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const gameId = parseInt(req.params.id as string, 10);

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  if (game.hostId !== userId && game.guestId !== userId) {
    res.status(403).json({ error: "Not a participant of this game" });
    return;
  }

  const { side, action } = req.body as { side: PlayerSide; action: GameAction };
  if (!side || !action) {
    res.status(400).json({ error: "Missing 'side' or 'action' in body" });
    return;
  }

  const isLocalGame = game.hostId === game.guestId;
  if (!isLocalGame) {
    const expectedSide: PlayerSide = game.hostId === userId ? "host" : "guest";
    if (side !== expectedSide) {
      res.status(403).json({ error: `You are the ${expectedSide}, not ${side}` });
      return;
    }
  }

  const [row] = await db.select().from(gameStatesTable).where(eq(gameStatesTable.gameId, gameId));
  if (!row) {
    res.status(404).json({ error: "Game not initialized" });
    return;
  }

  const currentState = row.state as unknown as GameState;
  const result = processAction(currentState, side, action);

  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  const newVersion = row.version + 1;
  await db
    .update(gameStatesTable)
    .set({
      state: result.state as unknown as Record<string, unknown>,
      version: newVersion,
      updatedAt: new Date(),
    })
    .where(eq(gameStatesTable.gameId, gameId));

  if (result.state.winner) {
    await db
      .update(gamesTable)
      .set({
        status: "finished",
        endedAt: new Date(),
        winnerId: result.state.winner === "host" ? game.hostId : game.guestId,
      })
      .where(eq(gamesTable.id, gameId));
  }

  res.json({ state: result.state, version: newVersion });
});

export default router;
