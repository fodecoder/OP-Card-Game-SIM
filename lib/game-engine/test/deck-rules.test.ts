import { describe, expect, it } from "vitest";
import { validateDeck } from "../src/deck-rules";
import type { DBCard } from "../src/types";

function makeCard(cardNumber: string, setCode: string, cardType: DBCard["cardType"] = "character"): DBCard {
  return {
    id: Math.random(),
    cardNumber,
    name: cardNumber,
    cardType,
    color: "red",
    rarity: "C",
    setCode,
    cost: 1,
    power: 1000,
    counter: 1000,
    attribute: null,
    life: cardType === "leader" ? 5 : null,
    cardTypes: null,
    subtypes: [],
    effectText: null,
    triggerEffect: null,
    keywords: [],
    imageUrl: null,
  };
}

describe("deck validation", () => {
  const leader = makeCard("OP05-001", "OP05", "leader");

  it("allows incomplete decks only for local games", () => {
    const entries = [{ card: makeCard("OP05-002", "OP05"), quantity: 4 }];
    expect(validateDeck(leader, entries, "local").valid).toBe(true);
    expect(validateDeck(leader, entries, "extra").valid).toBe(false);
  });

  it("rotates Block 1 out of Standard but keeps it in Extra", () => {
    const entries = [
      { card: makeCard("OP01-002", "OP01"), quantity: 4 },
      { card: makeCard("OP05-003", "OP05"), quantity: 46 },
    ];
    expect(validateDeck(leader, entries, "standard").errors.some((error) => error.includes("Block 1"))).toBe(true);
    expect(validateDeck(leader, entries, "extra").errors.some((error) => error.includes("Block 1"))).toBe(false);
  });

  it("enforces the current banned list and banned pairs online", () => {
    const entries = [
      { card: makeCard("OP06-047", "OP06"), quantity: 1 },
      { card: makeCard("OP07-115", "OP07"), quantity: 1 },
      { card: makeCard("EB04-058", "EB04"), quantity: 1 },
      { card: makeCard("OP05-002", "OP05"), quantity: 47 },
    ];
    const errors = validateDeck(leader, entries, "extra").errors.join(" ");
    expect(errors).toContain("OP06-047");
    expect(errors).toContain("banned pair");
  });
});
