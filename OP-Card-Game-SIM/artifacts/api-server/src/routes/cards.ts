import { Router, type IRouter } from "express";
import { db, cardsTable } from "@workspace/db";
import { eq, ilike, and, SQL } from "drizzle-orm";
import type { Request } from "express";

const router: IRouter = Router();

router.get("/cards", async (req, res): Promise<void> => {
  const { search, color, type, rarity, set, cost, page = "1", limit = "20" } = req.query as Record<string, string | undefined>;

  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? "20", 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];

  if (search) {
    conditions.push(ilike(cardsTable.name, `%${search}%`));
  }
  if (color) {
    conditions.push(ilike(cardsTable.color, `%${color}%`));
  }
  if (type) {
    conditions.push(ilike(cardsTable.cardType, `%${type}%`));
  }
  if (rarity) {
    conditions.push(eq(cardsTable.rarity, rarity));
  }
  if (set) {
    conditions.push(eq(cardsTable.setCode, set));
  }
  if (cost !== undefined) {
    conditions.push(eq(cardsTable.cost, parseInt(cost, 10)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [allCards, countResult] = await Promise.all([
    db.select().from(cardsTable).where(whereClause).limit(limitNum).offset(offset),
    db.$count(cardsTable, whereClause),
  ]);

  res.json({
    cards: allCards.map(formatCard),
    total: countResult,
    page: pageNum,
    limit: limitNum,
  });
});

router.get("/cards/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid card ID" });
    return;
  }

  const [card] = await db.select().from(cardsTable).where(eq(cardsTable.id, id));
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  res.json(formatCard(card));
});

function formatCard(card: typeof cardsTable.$inferSelect) {
  return {
    id: card.id,
    cardNumber: card.cardNumber,
    name: card.name,
    cardType: card.cardType,
    color: card.color,
    rarity: card.rarity,
    setCode: card.setCode,
    cost: card.cost ?? null,
    power: card.power ?? null,
    counter: card.counter ?? null,
    attribute: card.attribute ?? null,
    effectText: card.effectText ?? null,
    triggerEffect: card.triggerEffect ?? null,
    life: card.life ?? null,
    cardTypes: card.cardTypes ?? null,
    imageUrl: card.imageUrl ?? null,
    keywords: card.keywords ?? [],
    restriction: card.restriction ?? null,
  };
}

export { formatCard };
export default router;
