import { initializeGame, processAction } from "../src/engine";
import type { GameState, PlayerSide } from "../src/types";

function makeSampleDeck(leaderName: string) {
  // minimal deck: leader + one blocker + one attacker
  return [
    { id: 1, cardNumber: "L-1", name: leaderName, cardType: "leader", color: "red", rarity: "L", setCode: "OP01", cost: null, power: 5000, counter: null, attribute: null, life: 4, cardTypes: null, subtypes: [], effectText: null, triggerEffect: null, keywords: [], imageUrl: null },
    { id: 2, cardNumber: "B-1", name: "Blocker", cardType: "character", color: "blue", rarity: "C", setCode: "OP01", cost: 2, power: 1000, counter: 0, attribute: null, life: null, cardTypes: null, subtypes: [], effectText: null, triggerEffect: null, keywords: ["Blocker"], imageUrl: null },
    { id: 3, cardNumber: "A-1", name: "Attacker", cardType: "character", color: "red", rarity: "C", setCode: "OP01", cost: 2, power: 3000, counter: 0, attribute: null, life: null, cardTypes: null, subtypes: [], effectText: null, triggerEffect: null, keywords: [], imageUrl: null },
  ];
}

// basic smoke tests without test runner: run with a test runner (vitest/jest) later
export function runActivateBlockerScenario() {
  const hostDeck = makeSampleDeck("HostLeader");
  const guestDeck = makeSampleDeck("GuestLeader");

  let state = initializeGame(1, 1, hostDeck, 2, 2, guestDeck);

  // Fast-forward: put attacker on host field and blocker on guest field
  const host = state.host;
  const guest = state.guest;
  const attacker = host.hand.find((c) => c.name === "Attacker")!;
  const blocker = guest.hand.find((c) => c.name === "Blocker")!;

  // Play attacker (assume enough DON for test)
  host.donActive = 10;
  state = processAction(state, "host", { type: "play_card", instanceId: attacker.instanceId }).state;

  // Play blocker by guest
  guest.donActive = 10;
  state = processAction(state, "guest", { type: "play_card", instanceId: blocker.instanceId }).state;

  // Host declares attack on guest leader
  state = processAction(state, "host", { type: "declare_attack", attackerInstanceId: attacker.instanceId, targetSide: "guest", targetInstanceId: "leader" }).state;

  // Guest activates blocker
  const blockerInstanceId = state.guest.field.find((c) => c.name === "Blocker")!.instanceId;
  const res = processAction(state, "guest", { type: "activate_blocker", blockerInstanceId });

  // After activation, pendingAttack target should be blocker
  if (res.error) throw new Error("activate_blocker failed: " + res.error);
  if (!res.state.pendingAttack || res.state.pendingAttack.targetInstanceId !== blockerInstanceId) {
    throw new Error("Blocker did not intercept the attack");
  }

  console.log("activate_blocker scenario passed");
}

if (require.main === module) {
  runActivateBlockerScenario();
}
