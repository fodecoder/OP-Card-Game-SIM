import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { cardsTable } from "./cards";

export const decksTable = pgTable("decks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  leaderId: integer("leader_id").references(() => cardsTable.id, { onDelete: "set null" }),
  cardCount: integer("card_count").notNull().default(0),
  isValid: boolean("is_valid").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const deckCardsTable = pgTable("deck_cards", {
  id: serial("id").primaryKey(),
  deckId: integer("deck_id").notNull().references(() => decksTable.id, { onDelete: "cascade" }),
  cardId: integer("card_id").notNull().references(() => cardsTable.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
});

export const insertDeckSchema = createInsertSchema(decksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeck = z.infer<typeof insertDeckSchema>;
export type Deck = typeof decksTable.$inferSelect;

export const insertDeckCardSchema = createInsertSchema(deckCardsTable).omit({ id: true });
export type InsertDeckCard = z.infer<typeof insertDeckCardSchema>;
export type DeckCard = typeof deckCardsTable.$inferSelect;
