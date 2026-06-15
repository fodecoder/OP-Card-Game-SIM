export { initializeGame, processAction } from "./engine.js";
export { inferBlockNumber, validateDeck } from "./deck-rules.js";
export type { DeckEntry, DeckValidationResult } from "./deck-rules.js";
export type {
  DBCard,
  CardInstance,
  PlayerState,
  PlayerSide,
  Phase,
  GameState,
  GameAction,
  GameActionResult,
  GameFormat,
  EffectOperation,
  PendingEffect,
} from "./types.js";
