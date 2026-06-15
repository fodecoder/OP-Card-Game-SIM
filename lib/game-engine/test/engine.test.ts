import { describe, expect, it } from "vitest";
import { initializeGame, processAction } from "../src/engine";
import type { DBCard, GameState } from "../src/types";

function card(overrides: Partial<DBCard> & Pick<DBCard, "id" | "cardNumber" | "name" | "cardType">): DBCard {
  return {
    color: "red",
    rarity: "C",
    setCode: "OP05",
    cost: 1,
    power: 3000,
    counter: 1000,
    attribute: null,
    life: null,
    cardTypes: null,
    subtypes: [],
    effectText: null,
    triggerEffect: null,
    keywords: [],
    imageUrl: null,
    ...overrides,
  };
}

function deck(name: string): DBCard[] {
  return [
    card({
      id: 1,
      cardNumber: `${name}-L`,
      name: `${name} Leader`,
      cardType: "leader",
      life: 2,
      power: 5000,
    }),
    ...Array.from({ length: 12 }, (_, index) =>
      card({
        id: index + 2,
        cardNumber: `${name}-${index}`,
        name: `${name} Card ${index}`,
        cardType: "character",
      }),
    ),
  ];
}

function completeSetup(state: GameState): GameState {
  state = processAction(state, "host", { type: "keep_hand" }).state;
  return processAction(state, "guest", { type: "keep_hand" }).state;
}

describe("game setup and turns", () => {
  it("places Life after mulligan and draws at the start of later turns", () => {
    let state = initializeGame(1, 1, deck("H"), 2, 2, deck("G"));
    expect(state.phase).toBe("setup");
    expect(state.host.life).toHaveLength(0);

    state = processAction(state, "host", { type: "mulligan" }).state;
    state = processAction(state, "guest", { type: "keep_hand" }).state;
    expect(state.phase).toBe("main");
    expect(state.host.life).toHaveLength(2);
    expect(state.host.hand).toHaveLength(5);

    const guestHand = state.guest.hand.length;
    state = processAction(state, "host", { type: "end_turn" }).state;
    expect(state.activePlayer).toBe("guest");
    expect(state.guest.hand).toHaveLength(guestHand + 1);
  });
});

describe("Life damage", () => {
  it("adds Life to hand and only loses on a later hit at zero Life", () => {
    let state = completeSetup(initializeGame(1, 1, deck("H"), 2, 2, deck("G")));
    state = { ...state, turn: 2 };
    const handBefore = state.guest.hand.length;
    state = processAction(state, "host", {
      type: "declare_attack",
      attackerInstanceId: "leader",
      targetSide: "guest",
      targetInstanceId: "leader",
    }).state;
    state = processAction(state, "host", { type: "resolve_attack" }).state;
    expect(state.guest.hand).toHaveLength(handBefore + 1);
    expect(state.winner).toBeNull();

    state = {
      ...state,
      guest: { ...state.guest, life: [] },
      host: { ...state.host, leader: { ...state.host.leader, rested: false } },
    };
    state = processAction(state, "host", {
      type: "declare_attack",
      attackerInstanceId: "leader",
      targetSide: "guest",
      targetInstanceId: "leader",
    }).state;
    state = processAction(state, "host", { type: "resolve_attack" }).state;
    expect(state.winner).toBe("host");
  });
});

describe("ordered effects", () => {
  it("draws before requiring a trash selection when written in that order", () => {
    let state = completeSetup(initializeGame(1, 1, deck("H"), 2, 2, deck("G")));
    const effectCard = card({
      id: 99,
      cardNumber: "TEST-001",
      name: "Ordered Effect",
      cardType: "character",
      effectText: "[On Play] Draw 1 card, then trash 1 card from your hand.",
      keywords: ["On Play"],
    });
    const instance = {
      ...effectCard,
      instanceId: "effect-card",
      rested: false,
      attachedDon: 0,
      summonedThisTurn: false,
    };
    state = {
      ...state,
      host: {
        ...state.host,
        hand: [...state.host.hand, instance],
        donActive: 10,
      },
    };
    const handBefore = state.host.hand.length;
    state = processAction(state, "host", { type: "play_card", instanceId: instance.instanceId }).state;
    expect(state.host.hand).toHaveLength(handBefore);
    expect(state.pendingEffect?.operations[0]?.type).toBe("trash_from_hand");

    const selected = state.host.hand[0].instanceId;
    state = processAction(state, "host", {
      type: "resolve_effect",
      cardInstanceIds: [selected],
    }).state;
    expect(state.pendingEffect).toBeNull();
    expect(state.host.trash.some((value) => value.instanceId === selected)).toBe(true);
  });
});
