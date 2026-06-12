import { Router, type IRouter } from "express";
import { db, userCollectionsTable, cardsTable } from "@workspace/db";
import { eq, and, ilike, SQL } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { formatCard } from "./cards";
import { AddToCollectionBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/collection", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const { search, page = "1", limit = "20" } = req.query as Record<string, string | undefined>;

  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? "20", 10)));
  const offset = (pageNum - 1) * limitNum;

  const userCards = await db
    .select()
    .from(userCollectionsTable)
    .where(eq(userCollectionsTable.userId, userId));

  const cardsWithDetails = await Promise.all(
    userCards.map(async (uc) => {
      const [card] = await db
        .select()
        .from(cardsTable)
        .where(eq(cardsTable.id, uc.cardId));
      return card ? {
        cardId: uc.cardId,
        quantity: uc.quantity,
        isFavorite: uc.isFavorite,
        card: formatCard(card),
      } : null;
    })
  );

  const filtered = cardsWithDetails.filter((c): c is NonNullable<typeof c> => {
    if (!c) return false;
    if (search) {
      return c.card.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + limitNum);

  res.json({ cards: paged, total, page: pageNum, limit: limitNum });
});

router.post("/collection", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;

  const parsed = AddToCollectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { cardId, quantity } = parsed.data;

  const [existing] = await db
    .select()
    .from(userCollectionsTable)
    .where(
      and(
        eq(userCollectionsTable.userId, userId),
        eq(userCollectionsTable.cardId, cardId)
      )
    );

  let result;
  if (existing) {
    [result] = await db
      .update(userCollectionsTable)
      .set({ quantity })
      .where(eq(userCollectionsTable.id, existing.id))
      .returning();
  } else {
    [result] = await db
      .insert(userCollectionsTable)
      .values({ userId, cardId, quantity })
      .returning();
  }

  const [card] = await db.select().from(cardsTable).where(eq(cardsTable.id, cardId));

  res.json({
    cardId: result.cardId,
    quantity: result.quantity,
    isFavorite: result.isFavorite,
    card: card ? formatCard(card) : null,
  });
});

router.delete("/collection/:cardId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const raw = Array.isArray(req.params.cardId) ? req.params.cardId[0] : req.params.cardId;
  const cardId = parseInt(raw, 10);

  const [existing] = await db
    .select()
    .from(userCollectionsTable)
    .where(
      and(
        eq(userCollectionsTable.userId, userId),
        eq(userCollectionsTable.cardId, cardId)
      )
    );

  if (!existing) {
    res.status(404).json({ error: "Card not in collection" });
    return;
  }

  await db.delete(userCollectionsTable).where(eq(userCollectionsTable.id, existing.id));
  res.sendStatus(204);
});

export default router;
