import { pgTable, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { gamesTable } from "./games";

export const gameStatesTable = pgTable("game_states", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id")
    .notNull()
    .references(() => gamesTable.id, { onDelete: "cascade" })
    .unique(),
  state: jsonb("state").notNull().$type<Record<string, unknown>>(),
  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
