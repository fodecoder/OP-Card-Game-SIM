import type { Card } from "@workspace/db";
import type { DBCard } from "@workspace/game-engine";

const VALID_CARD_TYPES = new Set<DBCard["cardType"]>([
  "leader",
  "character",
  "event",
  "stage",
]);

function isValidCardType(value: string): value is DBCard["cardType"] {
  return VALID_CARD_TYPES.has(value as DBCard["cardType"]);
}

export function toGameEngineCard(card: Card): DBCard {
  if (!isValidCardType(card.cardType)) {
    throw new Error(`Invalid card type "${card.cardType}" for card ${card.cardNumber}`);
  }

  return {
    id: card.id,
    cardNumber: card.cardNumber,
    name: card.name,
    cardType: card.cardType,
    color: card.color,
    rarity: card.rarity,
    setCode: card.setCode,
    cost: card.cost,
    power: card.power,
    counter: card.counter,
    attribute: card.attribute,
    life: card.life,
    cardTypes: card.cardTypes,
    subtypes: card.subtypes ?? [],
    effectText: card.effectText,
    triggerEffect: card.triggerEffect,
    keywords: card.keywords ?? [],
    imageUrl: card.imageUrl,
    restriction: card.restriction,
  };
}
