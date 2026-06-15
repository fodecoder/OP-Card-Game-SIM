import { db, cardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sampleCards } from "./sampleCardList";

// Official image URL format: https://en.onepiececardgame.com/system/web/card/en_OP01-001.png
// For local images, copy files to artifacts/api-server/public/cards/ and use:
// imageUrl: "/api/static/cards/OP01-001.png"
const BASE_IMG = "https://en.onepiececardgame.com/system/web/card/en_";
const BASE_IMG_LOCAL = "/api/static/cards/";

async function seed() {
  console.log("Seeding cards...");

  for (const card of sampleCards) {
    const subtypes = card.cardTypes
      ? card.cardTypes.split("/").map((s: string) => s.trim())
      : [];

    await db
      .insert(cardsTable)
      .values({
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
        subtypes: subtypes,
        imageUrl: card.imageUrl ?? null,
        keywords: [...(card.keywords ?? [])],
      })
      .onConflictDoUpdate({
        target: cardsTable.cardNumber,
        set: { imageUrl: card.imageUrl ?? null, name: card.name, subtypes: subtypes },
      });
  }

  console.log(`Seeded ${sampleCards.length} cards successfully.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
