import type { DBCard, GameFormat } from "./types.js";

export interface DeckEntry {
  card: DBCard;
  quantity: number;
}

export interface DeckValidationResult {
  valid: boolean;
  errors: string[];
}

const BANNED_CARDS = new Set([
  "OP06-047",
  "OP03-040",
  "OP06-086",
  "ST10-001",
  "OP06-116",
]);

const BANNED_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["OP07-115", "EB04-058"],
  ["OP11-040", "OP11-067"],
  ["OP11-040", "OP08-069"],
];

function colors(value: string): string[] {
  return value.toLowerCase().split("/").map((color) => color.trim()).filter(Boolean);
}

export function inferBlockNumber(setCode: string): number | null {
  const match = /^OP-?(\d{1,2})$/i.exec(setCode);
  if (!match) return null;
  const setNumber = Number(match[1]);
  if (!Number.isFinite(setNumber) || setNumber < 1) return null;
  return Math.ceil(setNumber / 4);
}

export function validateDeck(
  leader: DBCard | null,
  entries: DeckEntry[],
  format: GameFormat,
): DeckValidationResult {
  const errors: string[] = [];

  if (!leader || leader.cardType !== "leader") {
    errors.push("The deck must have exactly one Leader card.");
  }

  const mainDeckEntries = entries.filter(({ quantity }) => quantity > 0);
  const total = mainDeckEntries.reduce((sum, { quantity }) => sum + quantity, 0);
  if (format !== "local" && total !== 50) {
    errors.push(`The main deck must contain exactly 50 cards (currently ${total}).`);
  }
  if (format === "local" && total < 1) {
    errors.push("The main deck must contain at least one card.");
  }

  const leaderColors = leader ? colors(leader.color) : [];
  const includedNumbers = new Set<string>();
  if (leader) includedNumbers.add(leader.cardNumber);

  if (leader && format !== "local") {
    if (BANNED_CARDS.has(leader.cardNumber) || leader.restriction === "banned") {
      errors.push(`${leader.cardNumber} is banned in sanctioned play.`);
    }
    if (format === "standard") {
      const block = inferBlockNumber(leader.setCode);
      if (block !== null && (block < 2 || block > 5)) {
        errors.push(`${leader.cardNumber} (Block ${block}) is not legal in Standard Regulation.`);
      }
    }
  }

  for (const { card, quantity } of mainDeckEntries) {
    includedNumbers.add(card.cardNumber);

    if (card.cardType === "leader") {
      errors.push(`${card.cardNumber} is a Leader and cannot be in the 50-card main deck.`);
    }
    if (format !== "local") {
      if (quantity > 4) {
        errors.push(`${card.cardNumber} exceeds the 4-copy limit.`);
      }
      if (leader && !colors(card.color).some((color) => leaderColors.includes(color))) {
        errors.push(`${card.cardNumber} does not match the Leader's color.`);
      }
      if (BANNED_CARDS.has(card.cardNumber) || card.restriction === "banned") {
        errors.push(`${card.cardNumber} is banned in sanctioned play.`);
      }
      const maxCopies =
        card.restriction === "limited_1" ? 1 : card.restriction === "limited_2" ? 2 : 4;
      if (quantity > maxCopies) {
        errors.push(`${card.cardNumber} is limited to ${maxCopies} copies.`);
      }
    }

    if (format === "standard") {
      const block = inferBlockNumber(card.setCode);
      if (block !== null && (block < 2 || block > 5)) {
        errors.push(`${card.cardNumber} (Block ${block}) is not legal in Standard Regulation.`);
      }
    }
  }

  if (format !== "local") {
    for (const [first, second] of BANNED_PAIRS) {
      if (includedNumbers.has(first) && includedNumbers.has(second)) {
        errors.push(`${first} and ${second} are a banned pair.`);
      }
    }
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
