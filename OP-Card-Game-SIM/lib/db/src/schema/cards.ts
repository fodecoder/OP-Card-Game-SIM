import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cardsTable = pgTable("cards", {
  id: serial("id").primaryKey(),
  cardNumber: text("card_number").notNull().unique(),
  name: text("name").notNull(),
  cardType: text("card_type").notNull(),
  color: text("color").notNull(),
  rarity: text("rarity").notNull(),
  setCode: text("set_code").notNull(),
  cost: integer("cost"),
  power: integer("power"),
  counter: integer("counter"),
  attribute: text("attribute"),
  effectText: text("effect_text"),
  triggerEffect: text("trigger_effect"),
  life: integer("life"),
  cardTypes: text("card_types"),
  imageUrl: text("image_url"),
  keywords: text("keywords").array().notNull().default([]),
  restriction: text("restriction"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCardSchema = createInsertSchema(cardsTable).omit({ id: true, createdAt: true });
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cardsTable.$inferSelect;
