import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { decksTable } from "./decks";

export const gamesTable = pgTable("games", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("waiting"),
  isPrivate: boolean("is_private").notNull().default(false),
  hostId: integer("host_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  hostDeckId: integer("host_deck_id").references(() => decksTable.id, { onDelete: "set null" }),
  guestId: integer("guest_id").references(() => usersTable.id, { onDelete: "set null" }),
  guestDeckId: integer("guest_deck_id").references(() => decksTable.id, { onDelete: "set null" }),
  winnerId: integer("winner_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({ id: true, createdAt: true });
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;
