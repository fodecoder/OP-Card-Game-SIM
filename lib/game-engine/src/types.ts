export interface DBCard {
  id: number;
  cardNumber: string;
  name: string;
  // core type: leader | character | event | stage
  cardType: "leader" | "character" | "event" | "stage";
  color: string;
  rarity: string;
  setCode: string;
  cost: number | null;
  power: number | null;
  counter: number | null;
  attribute: string | null;
  life: number | null;
  // legacy raw card types string (kept for backward compatibility)
  cardTypes?: string | null;
  // normalized array of subtypes (e.g. ["Straw Hat Crew", "Slash"])
  subtypes: string[];
  effectText: string | null;
  triggerEffect: string | null;
  keywords: string[];
  imageUrl: string | null;
  restriction?: string | null;
}

export interface CardInstance extends DBCard {
  instanceId: string;
  rested: boolean;
  attachedDon: number;
  summonedThisTurn: boolean;
}

export interface PlayerState {
  userId: number;
  deckId: number;
  leader: CardInstance;
  life: CardInstance[];
  hand: CardInstance[];
  deck: CardInstance[];
  field: CardInstance[];
  trash: CardInstance[];
  donDeck: number;
  donActive: number;
  donRested: number;
  mulliganUsed: boolean;
  setupComplete: boolean;
  abilitiesUsed: string[];
}

export interface PendingAttack {
  attackerSide: PlayerSide;
  attackerInstanceId: string;
  defenderSide: PlayerSide;
  targetInstanceId: string;
  counterPower: number;
  damage: number;
  banish: boolean;
}

export type Phase = "setup" | "refresh" | "draw" | "don" | "main" | "end";
export type PlayerSide = "host" | "guest";
export type GameFormat = "local" | "standard" | "extra";

export type EffectOperation =
  | { type: "draw"; count: number }
  | { type: "rest_source" }
  | { type: "set_source_active" }
  | { type: "life_to_hand"; count: number }
  | { type: "trash_life"; count: number }
  | {
      type: "trash_from_hand";
      count: number;
      selectedInstanceIds?: string[];
    };

export interface PendingEffect {
  sourceInstanceId: string;
  sourceName: string;
  side: PlayerSide;
  operations: EffectOperation[];
  unresolvedText?: string;
}

export interface GameState {
  turn: number;
  activePlayer: PlayerSide;
  phase: Phase;
  host: PlayerState;
  guest: PlayerState;
  winner: PlayerSide | null;
  log: string[];
  pendingAttack: PendingAttack | null;
  pendingEffect: PendingEffect | null;
}

export type GameAction =
  | { type: "pass_phase" }
  | { type: "end_turn" }
  | { type: "play_card"; instanceId: string }
  | { type: "give_don"; targetInstanceId: string; donCount: number }
  | {
      type: "declare_attack";
      attackerInstanceId: string;
      targetSide: PlayerSide;
      targetInstanceId: string;
    }
  | { type: "activate_blocker"; blockerInstanceId: string }
  | { type: "activate_ability"; instanceId: string; abilityId?: string }
  | { type: "keep_hand" }
  | { type: "mulligan" }
  | { type: "resolve_effect"; cardInstanceIds?: string[] }
  | { type: "declare_counter"; cardInstanceIds: string[] }
  | { type: "resolve_attack" }
  | { type: "concede" };

export interface GameActionResult {
  state: GameState;
  error?: string;
}
