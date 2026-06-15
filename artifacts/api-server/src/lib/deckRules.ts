import { db, cardsTable, deckCardsTable, decksTable } from "@workspace/db";
import { validateDeck } from "@workspace/game-engine";
import type { DBCard, GameFormat } from "@workspace/game-engine";
import { eq } from "drizzle-orm";
import { toGameEngineCard } from "./cardMapper";

export interface LoadedDeck {
  leader: DBCard | null;
  entries: Array<{ card: DBCard; quantity: number }>;
  engineCards: DBCard[];
}

export async function loadDeck(deckId: number): Promise<LoadedDeck> {
  const [deck] = await db.select().from(decksTable).where(eq(decksTable.id, deckId));
  if (!deck) throw new Error("Deck not found");

  const leaderRow = deck.leaderId
    ? (await db.select().from(cardsTable).where(eq(cardsTable.id, deck.leaderId)))[0]
    : null;
  const rows = await db
    .select({ card: cardsTable, quantity: deckCardsTable.quantity })
    .from(deckCardsTable)
    .innerJoin(cardsTable, eq(deckCardsTable.cardId, cardsTable.id))
    .where(eq(deckCardsTable.deckId, deckId));

  const leader = leaderRow ? toGameEngineCard(leaderRow) : null;
  const entries = rows.map((row) => ({
    card: toGameEngineCard(row.card),
    quantity: row.quantity,
  }));
  const engineCards = [
    ...(leader ? [leader] : []),
    ...entries.flatMap(({ card, quantity }) =>
      Array.from({ length: quantity }, () => ({ ...card })),
    ),
  ];
  return { leader, entries, engineCards };
}

export async function validateStoredDeck(deckId: number, format: GameFormat) {
  const loaded = await loadDeck(deckId);
  return {
    loaded,
    validation: validateDeck(loaded.leader, loaded.entries, format),
  };
}
