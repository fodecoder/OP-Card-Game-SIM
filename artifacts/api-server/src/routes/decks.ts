import { Router, type IRouter } from "express";
import { db, decksTable, deckCardsTable, cardsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { formatCard } from "./cards";
import {
  CreateDeckBody,
  UpdateDeckBody,
  AddCardToDeckBody,
} from "@workspace/api-zod";
import { validateStoredDeck } from "../lib/deckRules";

const router: IRouter = Router();

router.get("/decks", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;

  const decks = await db
    .select()
    .from(decksTable)
    .where(eq(decksTable.userId, userId));

  const result = await Promise.all(
    decks.map(async (deck) => {
      let leaderName: string | null = null;
      let leaderImageUrl: string | null = null;
      let leaderColor: string | null = null;

      if (deck.leaderId) {
        const [leader] = await db
          .select()
          .from(cardsTable)
          .where(eq(cardsTable.id, deck.leaderId));
        if (leader) {
          leaderName = leader.name;
          leaderImageUrl = leader.imageUrl ?? null;
          leaderColor = leader.color;
        }
      }

      return {
        id: deck.id,
        name: deck.name,
        leaderId: deck.leaderId ?? null,
        leaderName,
        leaderImageUrl,
        leaderColor,
        cardCount: deck.cardCount,
        isValid: deck.isValid,
        description: deck.description ?? null,
        createdAt: deck.createdAt.toISOString(),
        updatedAt: deck.updatedAt.toISOString(),
      };
    })
  );

  res.json(result);
});

router.post("/decks", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;

  const parsed = CreateDeckBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [deck] = await db
    .insert(decksTable)
    .values({
      userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      leaderId: parsed.data.leaderId ?? null,
    })
    .returning();

  res.status(201).json({
    id: deck.id,
    name: deck.name,
    leaderId: deck.leaderId ?? null,
    leaderName: null,
    leaderImageUrl: null,
    leaderColor: null,
    cardCount: deck.cardCount,
    isValid: deck.isValid,
    description: deck.description ?? null,
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
  });
});

router.post("/decks/starters", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;

  const leaders = await db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.cardType, "leader"));

  if (leaders.length === 0) {
    res.status(400).json({ error: "No leader cards found. Seed cards first." });
    return;
  }

  const pickedLeaders = leaders.slice(0, 2);
  const createdDecks = [];

  for (const leader of pickedLeaders) {
    const deckName = `Starter: ${leader.name}`;

    const [existingDeck] = await db
      .select()
      .from(decksTable)
      .where(and(eq(decksTable.userId, userId), eq(decksTable.leaderId, leader.id)));

    if (existingDeck) {
      createdDecks.push({
        id: existingDeck.id,
        name: existingDeck.name,
        leaderId: existingDeck.leaderId ?? null,
        leaderName: leader.name,
        leaderImageUrl: leader.imageUrl ?? null,
        leaderColor: leader.color,
        cardCount: existingDeck.cardCount,
        isValid: existingDeck.isValid,
        description: existingDeck.description ?? null,
        createdAt: existingDeck.createdAt.toISOString(),
        updatedAt: existingDeck.updatedAt.toISOString(),
      });
      continue;
    }

    const [newDeck] = await db
      .insert(decksTable)
      .values({ userId, name: deckName, leaderId: leader.id })
      .returning();

    const leaderColors = (leader.color ?? "").split("/").map((c: string) => c.trim());
    const sameColorCards = await db
      .select()
      .from(cardsTable)
      .where(eq(cardsTable.cardType, "Character"));

    const filtered = sameColorCards.filter((c) => {
      const cardColors = (c.color ?? "").split("/").map((x: string) => x.trim());
      return cardColors.some((cc: string) => leaderColors.includes(cc));
    });

    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    let totalCards = 0;
    const cardCounts = new Map<number, number>();

    for (const card of shuffled) {
      if (totalCards >= 50) break;
      const currentQty = cardCounts.get(card.id) ?? 0;
      if (currentQty >= 4) continue;
      const add = Math.min(4 - currentQty, 50 - totalCards, 4);
      if (add <= 0) continue;
      cardCounts.set(card.id, currentQty + add);
      totalCards += add;
    }

    for (const [cardId, qty] of cardCounts.entries()) {
      await db.insert(deckCardsTable).values({ deckId: newDeck.id, cardId, quantity: qty });
    }

    const isValid = totalCards === 50;
    await db
      .update(decksTable)
      .set({ cardCount: totalCards, isValid })
      .where(eq(decksTable.id, newDeck.id));

    createdDecks.push({
      id: newDeck.id,
      name: newDeck.name,
      leaderId: newDeck.leaderId ?? null,
      leaderName: leader.name,
      leaderImageUrl: leader.imageUrl ?? null,
      leaderColor: leader.color,
      cardCount: totalCards,
      isValid,
      description: null,
      createdAt: newDeck.createdAt.toISOString(),
      updatedAt: newDeck.updatedAt.toISOString(),
    });
  }

  res.status(201).json(createdDecks);
});

router.get("/decks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid deck ID" });
    return;
  }

  const [deck] = await db
    .select()
    .from(decksTable)
    .where(and(eq(decksTable.id, id), eq(decksTable.userId, userId)));

  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const deckCards = await db
    .select()
    .from(deckCardsTable)
    .where(eq(deckCardsTable.deckId, id));

  const cardsWithDetails = await Promise.all(
    deckCards.map(async (dc) => {
      const [card] = await db
        .select()
        .from(cardsTable)
        .where(eq(cardsTable.id, dc.cardId));
      return {
        cardId: dc.cardId,
        quantity: dc.quantity,
        card: card ? formatCard(card) : null,
      };
    })
  );

  let leaderName: string | null = null;
  let leaderImageUrl: string | null = null;
  let leaderColor: string | null = null;

  if (deck.leaderId) {
    const [leader] = await db
      .select()
      .from(cardsTable)
      .where(eq(cardsTable.id, deck.leaderId));
    if (leader) {
      leaderName = leader.name;
      leaderImageUrl = leader.imageUrl ?? null;
      leaderColor = leader.color;
    }
  }

  res.json({
    id: deck.id,
    name: deck.name,
    leaderId: deck.leaderId ?? null,
    leaderName,
    leaderImageUrl,
    leaderColor,
    cardCount: deck.cardCount,
    isValid: deck.isValid,
    description: deck.description ?? null,
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
    cards: cardsWithDetails,
  });
});

router.patch("/decks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = UpdateDeckBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(decksTable)
    .where(and(eq(decksTable.id, id), eq(decksTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  if (parsed.data.leaderId !== undefined) {
    const [leader] = await db
      .select()
      .from(cardsTable)
      .where(eq(cardsTable.id, parsed.data.leaderId));
    if (!leader || leader.cardType.toLowerCase() !== "leader") {
      res.status(400).json({ error: "The selected card is not a Leader." });
      return;
    }
    await db
      .delete(deckCardsTable)
      .where(and(eq(deckCardsTable.deckId, id), eq(deckCardsTable.cardId, leader.id)));
  }

  const [updated] = await db
    .update(decksTable)
    .set({
      name: parsed.data.name ?? existing.name,
      description: parsed.data.description ?? existing.description,
      leaderId: parsed.data.leaderId ?? existing.leaderId,
    })
    .where(eq(decksTable.id, id))
    .returning();

  res.json({
    id: updated.id,
    name: updated.name,
    leaderId: updated.leaderId ?? null,
    leaderName: null,
    leaderImageUrl: null,
    leaderColor: null,
    cardCount: updated.cardCount,
    isValid: updated.isValid,
    description: updated.description ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.delete("/decks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db
    .select()
    .from(decksTable)
    .where(and(eq(decksTable.id, id), eq(decksTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  await db.delete(decksTable).where(eq(decksTable.id, id));
  res.sendStatus(204);
});

router.post("/decks/:id/cards", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deckId = parseInt(raw, 10);

  const parsed = AddCardToDeckBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [deck] = await db
    .select()
    .from(decksTable)
    .where(and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)));

  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const { cardId, quantity } = parsed.data;

  if (quantity > 0) {
    const [card] = await db.select().from(cardsTable).where(eq(cardsTable.id, cardId));
    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    if (card.cardType.toLowerCase() === "leader") {
      res.status(400).json({
        error: "Leader cards must be selected in the Leader slot and cannot enter the main deck.",
      });
      return;
    }

    if (deck.leaderId) {
      const [leader] = await db.select().from(cardsTable).where(eq(cardsTable.id, deck.leaderId));
      if (leader) {
        const leaderColors = leader.color.split("/").map((c) => c.trim());
        const cardColors = card.color.split("/").map((c) => c.trim());
        const colorMatch = cardColors.some((cc) => leaderColors.includes(cc));
        if (!colorMatch) {
          res.status(400).json({
            error: `${card.name} (${card.color}) cannot be used with this Leader (${leader.color}).`,
          });
          return;
        }
      }
    }
  }

  const [existing] = await db
    .select()
    .from(deckCardsTable)
    .where(and(eq(deckCardsTable.deckId, deckId), eq(deckCardsTable.cardId, cardId)));

  if (quantity === 0) {
    if (existing) {
      await db
        .delete(deckCardsTable)
        .where(and(eq(deckCardsTable.deckId, deckId), eq(deckCardsTable.cardId, cardId)));
    }
  } else if (existing) {
    await db
      .update(deckCardsTable)
      .set({ quantity })
      .where(and(eq(deckCardsTable.deckId, deckId), eq(deckCardsTable.cardId, cardId)));
  } else {
    await db.insert(deckCardsTable).values({ deckId, cardId, quantity });
  }

  const allDeckCards = await db
    .select()
    .from(deckCardsTable)
    .where(eq(deckCardsTable.deckId, deckId));

  const totalCards = allDeckCards.reduce((sum, dc) => sum + dc.quantity, 0);
  const { validation } = await validateStoredDeck(deckId, "extra");
  const isValid = validation.valid;

  await db
    .update(decksTable)
    .set({ cardCount: totalCards, isValid })
    .where(eq(decksTable.id, deckId));

  const cardsWithDetails = await Promise.all(
    allDeckCards.map(async (dc) => {
      const [card] = await db
        .select()
        .from(cardsTable)
        .where(eq(cardsTable.id, dc.cardId));
      return {
        cardId: dc.cardId,
        quantity: dc.quantity,
        card: card ? formatCard(card) : null,
      };
    })
  );

  const [updatedDeck] = await db.select().from(decksTable).where(eq(decksTable.id, deckId));

  res.json({
    id: updatedDeck.id,
    name: updatedDeck.name,
    leaderId: updatedDeck.leaderId ?? null,
    leaderName: null,
    leaderImageUrl: null,
    leaderColor: null,
    cardCount: updatedDeck.cardCount,
    isValid: updatedDeck.isValid,
    description: updatedDeck.description ?? null,
    createdAt: updatedDeck.createdAt.toISOString(),
    updatedAt: updatedDeck.updatedAt.toISOString(),
    cards: cardsWithDetails,
  });
});

router.delete("/decks/:id/cards/:cardId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const rawDeckId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawCardId = Array.isArray(req.params.cardId) ? req.params.cardId[0] : req.params.cardId;
  const deckId = parseInt(rawDeckId, 10);
  const cardId = parseInt(rawCardId, 10);

  const [deck] = await db
    .select()
    .from(decksTable)
    .where(and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)));

  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  await db
    .delete(deckCardsTable)
    .where(and(eq(deckCardsTable.deckId, deckId), eq(deckCardsTable.cardId, cardId)));

  const allDeckCards = await db
    .select()
    .from(deckCardsTable)
    .where(eq(deckCardsTable.deckId, deckId));

  const totalCards = allDeckCards.reduce((sum, dc) => sum + dc.quantity, 0);
  const { validation } = await validateStoredDeck(deckId, "extra");
  const isValid = validation.valid;

  await db
    .update(decksTable)
    .set({ cardCount: totalCards, isValid })
    .where(eq(decksTable.id, deckId));

  const cardsWithDetails = await Promise.all(
    allDeckCards.map(async (dc) => {
      const [card] = await db
        .select()
        .from(cardsTable)
        .where(eq(cardsTable.id, dc.cardId));
      return {
        cardId: dc.cardId,
        quantity: dc.quantity,
        card: card ? formatCard(card) : null,
      };
    })
  );

  const [updatedDeck] = await db.select().from(decksTable).where(eq(decksTable.id, deckId));

  res.json({
    id: updatedDeck.id,
    name: updatedDeck.name,
    leaderId: updatedDeck.leaderId ?? null,
    leaderName: null,
    leaderImageUrl: null,
    leaderColor: null,
    cardCount: updatedDeck.cardCount,
    isValid: updatedDeck.isValid,
    description: updatedDeck.description ?? null,
    createdAt: updatedDeck.createdAt.toISOString(),
    updatedAt: updatedDeck.updatedAt.toISOString(),
    cards: cardsWithDetails,
  });
});

export default router;
