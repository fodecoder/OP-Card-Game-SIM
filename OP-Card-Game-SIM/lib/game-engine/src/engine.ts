import type {
  DBCard,
  CardInstance,
  PlayerState,
  PlayerSide,
  Phase,
  GameState,
  GameAction,
  GameActionResult,
  PendingAttack,
} from "./types.js";

function generateId(): string {
  // Use timestamp + random chunk to avoid collisions across concurrent calls
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Minimal data-driven keyword handlers. Handlers may modify and return a new GameState.
const keywordHandlers: Record<
  string,
  (state: GameState, side: PlayerSide, card: CardInstance) => GameState | void
> = {
  Rush(state, side, card) {
    // Rush: allow this card to attack this turn by clearing summonedThisTurn
    const player = getPlayer(state, side);
    const newField = player.field.map((c) => (c.instanceId === card.instanceId ? { ...c, summonedThisTurn: false } : c));
    const updatedPlayer: PlayerState = { ...player, field: newField };
    const newState = updatePlayer(state, side, updatedPlayer);
    return addLog(newState, `${card.name} has Rush — can attack this turn!`);
  },
  "On Play"(state, side, card) {
    // Placeholder for On Play effects; log for now
    return addLog(state, `On Play triggered: ${card.name} → ${card.effectText ?? "(no text)"}`);
  },
};

function makeInstance(card: DBCard): CardInstance {
  return {
    ...card,
    instanceId: generateId(),
    rested: false,
    attachedDon: 0,
    summonedThisTurn: false,
  };
}

function createPlayerState(userId: number, deckId: number, cards: DBCard[]): PlayerState {
  const leaderCard = cards.find((c) => c.cardType === "leader");
  if (!leaderCard) throw new Error("No leader card in deck");

  const nonLeaders = cards.filter((c) => c.cardType !== "leader");
  const shuffledDeck = shuffle(nonLeaders.map(makeInstance));

  const lifeCount = leaderCard.life ?? 4;
  const life = shuffledDeck.splice(0, lifeCount);
  const hand = shuffledDeck.splice(0, 5);

  return {
    userId,
    deckId,
    leader: makeInstance(leaderCard),
    life,
    hand,
    deck: shuffledDeck,
    field: [],
    trash: [],
    donDeck: 10,
    donActive: 0,
    donRested: 0,
  };
}

export function initializeGame(
  hostUserId: number,
  hostDeckId: number,
  hostCards: DBCard[],
  guestUserId: number,
  guestDeckId: number,
  guestCards: DBCard[],
): GameState {
  const host = createPlayerState(hostUserId, hostDeckId, hostCards);
  const guest = createPlayerState(guestUserId, guestDeckId, guestCards);

  host.donDeck -= 1;
  host.donActive = 1;

  return {
    turn: 1,
    activePlayer: "host",
    phase: "main",
    host,
    guest,
    winner: null,
    pendingAttack: null,
    log: [
      "Game started! Host goes first.",
      "Host: 5 cards drawn, 1 DON!! gained. (No draw on turn 1.)",
      "Guest: 5 cards drawn.",
      "Phase: MAIN",
    ],
  };
}

function getPlayer(state: GameState, side: PlayerSide): PlayerState {
  return side === "host" ? state.host : state.guest;
}

function opponentSide(side: PlayerSide): PlayerSide {
  return side === "host" ? "guest" : "host";
}

function getEffectivePower(card: CardInstance): number {
  return (card.power ?? 0) + card.attachedDon * 1000;
}

function addLog(state: GameState, ...msgs: string[]): GameState {
  const log = [...state.log, ...msgs].slice(-60);
  return { ...state, log };
}

function updatePlayer(state: GameState, side: PlayerSide, updated: PlayerState): GameState {
  if (side === "host") return { ...state, host: updated };
  return { ...state, guest: updated };
}

function processRefresh(state: GameState): GameState {
  const side = state.activePlayer;
  const player = getPlayer(state, side);

  // Sum all DON that should return to active at refresh:
  // - DON attached to leader
  // - DON attached to each field card
  // - DON currently in rested/cost area (donRested)
  const leader: CardInstance = { ...player.leader, rested: false, attachedDon: 0, summonedThisTurn: false };
  const field = player.field.map((c) => ({ ...c, rested: false, attachedDon: 0, summonedThisTurn: false }));

  const attachedFromLeader = player.leader.attachedDon || 0;
  const attachedFromField = player.field.reduce((s, c) => s + (c.attachedDon || 0), 0);
  const donReturned = attachedFromLeader + attachedFromField + (player.donRested || 0);

  const updatedPlayer: PlayerState = {
    ...player,
    leader,
    field,
    donActive: player.donActive + donReturned,
    donRested: 0,
  };

  let newState = updatePlayer(state, side, updatedPlayer);
  newState = addLog(
    newState,
    `--- Refresh: all cards unrest. ${donReturned} DON!! returned (${player.donRested} rested + ${donReturned - player.donRested} attached).`,
  );
  return newState;
}

function processDraw(state: GameState): GameState {
  const side = state.activePlayer;
  const player = getPlayer(state, side);

  if (player.deck.length === 0) {
    return addLog(state, "Draw: deck empty — cannot draw.");
  }

  const [drawn, ...remainingDeck] = player.deck;
  const updatedPlayer: PlayerState = {
    ...player,
    hand: [...player.hand, drawn],
    deck: remainingDeck,
  };

  let newState = updatePlayer(state, side, updatedPlayer);
  newState = addLog(newState, `Draw: drew 1 card. (${updatedPlayer.hand.length} in hand)`);
  return newState;
}

function processDon(state: GameState): GameState {
  const side = state.activePlayer;
  const player = getPlayer(state, side);

  let donGained = 0;
  if (player.donDeck > 0) {
    if (state.turn === 1) {
      donGained = side === "guest" ? 2 : 1;
    } else {
      donGained = 2;
    }
    donGained = Math.min(donGained, player.donDeck);
  }

  const updatedPlayer: PlayerState = {
    ...player,
    donDeck: player.donDeck - donGained,
    donActive: player.donActive + donGained,
  };

  let newState = updatePlayer(state, side, updatedPlayer);
  newState = addLog(
    newState,
    `DON!!: +${donGained} from deck. Active: ${updatedPlayer.donActive}. Deck: ${updatedPlayer.donDeck} remaining.`,
  );
  return newState;
}

function nextPhase(state: GameState): GameState {
  // Turn end -> switch active player and execute start-of-turn phases
  if (state.phase === "end") {
    const nextPlayer = opponentSide(state.activePlayer);
    const newTurn = nextPlayer === "host" ? state.turn + 1 : state.turn;
    const label = nextPlayer === "host" ? "Host" : "Guest";
    let newState: GameState = {
      ...state,
      activePlayer: nextPlayer,
      phase: "refresh",
      turn: newTurn,
      pendingAttack: null,
    };
    newState = addLog(newState, `--- Turn ${newTurn}: ${label}'s turn ---`, "Phase: REFRESH");
    newState = processRefresh(newState);
    newState = { ...newState, phase: "draw" };
    newState = addLog(newState, "Phase: DRAW");
    newState = processDraw(newState);
    newState = { ...newState, phase: "don" };
    newState = addLog(newState, "Phase: DON!!");
    newState = processDon(newState);
    newState = { ...newState, phase: "main" };
    newState = addLog(newState, "Phase: MAIN");
    return newState;
  }

  // Main -> End (attacks and plays happen inside Main according to rules)
  if (state.phase === "main") {
    let newState: GameState = { ...state, phase: "end" };
    newState = addLog(newState, "Phase: END");
    return newState;
  }

  return state;
}

function resolveAttack(state: GameState, attack: PendingAttack): GameActionResult {
  const { attackerSide, attackerInstanceId, defenderSide, targetInstanceId, counterPower } = attack;

  const attPlayer = getPlayer(state, attackerSide);
  const defPlayer = getPlayer(state, defenderSide);

  let attackerCard: CardInstance;
  if (attackerInstanceId === "leader") {
    attackerCard = attPlayer.leader;
  } else {
    const found = attPlayer.field.find((c) => c.instanceId === attackerInstanceId);
    if (!found) return { state, error: "Attacker no longer on field" };
    attackerCard = found;
  }

  let defenderCard: CardInstance;
  let defField = [...defPlayer.field];
  let defLeader = defPlayer.leader;
  let defLife = [...defPlayer.life];
  let defTrash = [...defPlayer.trash];
  let defDonActive = defPlayer.donActive;

  if (targetInstanceId === "leader") {
    defenderCard = defPlayer.leader;
  } else {
    const found = defField.find((c) => c.instanceId === targetInstanceId);
    if (!found) return { state, error: "Target no longer on field" };
    defenderCard = found;
  }

  const atkPower = getEffectivePower(attackerCard);
  const defPower = getEffectivePower(defenderCard) + counterPower;
  const sideLabel = attackerSide === "host" ? "Host" : "Guest";
  const logs: string[] = [
    `${sideLabel} resolves attack: ${attackerCard.name} (${atkPower}) vs ${defenderCard.name} (${defPower}${counterPower > 0 ? ` +${counterPower} counter` : ""})`,
  ];

  let winner: PlayerSide | null = state.winner;

  if (targetInstanceId === "leader") {
    if (atkPower >= defPower) {
      if (defLife.length > 0) {
        const lifeCard = defLife[defLife.length - 1];
        defLife = defLife.slice(0, -1);
        defTrash = [...defTrash, lifeCard];
        logs.push(
          `Hit! ${defenderSide === "host" ? "Host" : "Guest"} reveals life: ${lifeCard.name}. ${defLife.length} life remaining.`,
        );
        if (lifeCard.triggerEffect) {
          logs.push(`TRIGGER activated: "${lifeCard.triggerEffect}" (apply manually)`);
        }
        if (defLife.length === 0) {
          winner = attackerSide;
          logs.push(`${attackerSide === "host" ? "Host" : "Guest"} WINS! No life remaining!`);
        }
      } else {
        winner = attackerSide;
        logs.push(`${attackerSide === "host" ? "Host" : "Guest"} WINS!`);
      }
    } else {
      logs.push(`Blocked by leader power (${atkPower} < ${defPower}).`);
    }
  } else {
    if (atkPower >= defPower) {
      const idx = defField.findIndex((c) => c.instanceId === targetInstanceId);
      defDonActive += defenderCard.attachedDon;
      defTrash = [...defTrash, defField[idx]];
      defField.splice(idx, 1);
      logs.push(`${defenderCard.name} is KO'd!`);
      if (defenderCard.attachedDon > 0) {
        logs.push(`${defenderCard.attachedDon} DON!! returned to ${defenderSide === "host" ? "Host" : "Guest"}.`);
      }
    } else {
      logs.push(`${defenderCard.name} survives (${atkPower} < ${defPower}).`);
    }
  }

  const updatedDef: PlayerState = {
    ...defPlayer,
    leader: defLeader,
    field: defField,
    life: defLife,
    trash: defTrash,
    donActive: defDonActive,
  };

  let newState = updatePlayer(state, defenderSide, updatedDef);
  newState = { ...newState, winner, pendingAttack: null };
  newState = addLog(newState, ...logs);
  return { state: newState };
}

export function processAction(
  state: GameState,
  side: PlayerSide,
  action: GameAction,
): GameActionResult {
  if (state.winner) {
    return { state, error: "Game is already over" };
  }

  const notMyTurn = state.activePlayer !== side;

  if (action.type !== "concede" && action.type !== "declare_counter" && notMyTurn) {
    return { state, error: "Not your turn" };
  }

  switch (action.type) {
    case "pass_phase": {
      if (notMyTurn) return { state, error: "Not your turn" };
      if (state.pendingAttack) return { state, error: "Resolve the pending attack first" };
      return { state: nextPhase(state) };
    }

    case "end_turn": {
      if (notMyTurn) return { state, error: "Not your turn" };
      if (state.pendingAttack) return { state, error: "Resolve the pending attack first" };
      const endState: GameState = { ...state, phase: "end" };
      return { state: nextPhase(endState) };
    }

    case "play_card": {
      if (notMyTurn) return { state, error: "Not your turn" };
      if (state.phase !== "main") {
        return { state, error: "Can only play cards in the Main phase" };
      }
      const player = getPlayer(state, side);
      const cardIdx = player.hand.findIndex((c) => c.instanceId === action.instanceId);
      if (cardIdx === -1) return { state, error: "Card not in hand" };

      const card = player.hand[cardIdx];
      const cost = card.cost ?? 0;
      if (player.donActive < cost) {
        return { state, error: `Not enough DON!! (need ${cost}, have ${player.donActive})` };
      }
      if (card.cardType === "leader") {
        return { state, error: "Leader is already in play" };
      }

      const newHand = player.hand.filter((_, i) => i !== cardIdx);
      let updatedPlayer: PlayerState;
      const isFieldCard = card.cardType === "character" || card.cardType === "stage";
      // create instance if field card
      let instance: CardInstance | null = null;
      if (isFieldCard) {
        instance = { ...card, summonedThisTurn: true, rested: false };
        updatedPlayer = {
          ...player,
          hand: newHand,
          field: [...player.field, instance],
          donActive: player.donActive - cost,
          donRested: player.donRested + cost,
        };
      } else {
        updatedPlayer = {
          ...player,
          hand: newHand,
          trash: [...player.trash, card],
          donActive: player.donActive - cost,
          donRested: player.donRested + cost,
        };
      }

      let newState = updatePlayer(state, side, updatedPlayer);
      const sideLabel = side === "host" ? "Host" : "Guest";
      const destination = isFieldCard ? "field" : "trash";
      const effectHint = card.effectText ? ` [Effect: ${card.effectText}]` : "";
      newState = addLog(newState, `${sideLabel} played ${card.name} (cost ${cost}) → ${destination}.${effectHint}`);

      // Apply keyword handlers (if any)
      for (const kw of card.keywords || []) {
        const handler = keywordHandlers[kw];
        if (handler) {
          // pass the instance for field cards, otherwise pass a temporary instance-like object
          const target = instance ?? ({ ...card, instanceId: generateId(), rested: false, attachedDon: 0, summonedThisTurn: false } as CardInstance);
          const result = handler(newState, side, target);
          if (result) newState = result;
        } else {
          // no handler: log presence for debugging
          newState = addLog(newState, `${card.name} keyword present: ${kw}`);
        }
      }

      return { state: newState };
    }

    case "give_don": {
      if (notMyTurn) return { state, error: "Not your turn" };
      if (state.phase !== "main") {
        return { state, error: "Can only give DON!! in the Main phase" };
      }
      const player = getPlayer(state, side);
      if (player.donActive < action.donCount) {
        return { state, error: `Not enough active DON!! (need ${action.donCount}, have ${player.donActive})` };
      }

      let leader = player.leader;
      let field = [...player.field];
      let targetName: string;

      if (action.targetInstanceId === "leader") {
        leader = { ...leader, attachedDon: leader.attachedDon + action.donCount };
        targetName = `Leader (${leader.name})`;
      } else {
        const idx = field.findIndex((c) => c.instanceId === action.targetInstanceId);
        if (idx === -1) return { state, error: "Target not found on field" };
        field[idx] = { ...field[idx], attachedDon: field[idx].attachedDon + action.donCount };
        targetName = field[idx].name;
      }

      const updatedPlayer: PlayerState = { ...player, leader, field, donActive: player.donActive - action.donCount };
      let newState = updatePlayer(state, side, updatedPlayer);
      const newPower = action.targetInstanceId === "leader"
        ? getEffectivePower(leader)
        : getEffectivePower(field.find((c) => c.instanceId === action.targetInstanceId)!);
      newState = addLog(
        newState,
        `${side === "host" ? "Host" : "Guest"} attached ${action.donCount} DON!! to ${targetName}. Power now: ${newPower}.`,
      );
      return { state: newState };
    }

    case "declare_attack": {
      if (notMyTurn) return { state, error: "Not your turn" };
      if (state.phase !== "main") {
        return { state, error: "Can only attack during the Main phase" };
      }
      if (state.turn === 1) {
        return { state, error: "Cannot attack on the first turn." };
      }
      if (action.targetSide === side) {
        return { state, error: "Cannot attack your own cards" };
      }
      if (state.pendingAttack) {
        return { state, error: "Resolve the pending attack first" };
      }

      const attPlayer = getPlayer(state, side);
      let attLeader = attPlayer.leader;
      let attField = [...attPlayer.field];

      let attackerCard: CardInstance;
      if (action.attackerInstanceId === "leader") {
        attackerCard = attPlayer.leader;
        if (attackerCard.rested) return { state, error: "Leader is rested and cannot attack" };
        attLeader = { ...attackerCard, rested: true };
      } else {
        const idx = attField.findIndex((c) => c.instanceId === action.attackerInstanceId);
        if (idx === -1) return { state, error: "Attacker not found on field" };
        attackerCard = attField[idx];
        if (attackerCard.rested) return { state, error: "Card is rested and cannot attack" };
        if (attackerCard.summonedThisTurn && !attackerCard.keywords.includes("Rush")) {
          return { state, error: `${attackerCard.name} was summoned this turn and doesn't have Rush` };
        }
        attField[idx] = { ...attackerCard, rested: true };
      }

      const defPlayer = getPlayer(state, action.targetSide);
      if (action.targetInstanceId !== "leader") {
        const defIdx = defPlayer.field.findIndex((c) => c.instanceId === action.targetInstanceId);
        if (defIdx === -1) return { state, error: "Target not found on field" };
      }

      const pendingAttack: PendingAttack = {
        attackerSide: side,
        attackerInstanceId: action.attackerInstanceId,
        defenderSide: action.targetSide,
        targetInstanceId: action.targetInstanceId,
        counterPower: 0,
      };

      const updatedAtt: PlayerState = { ...attPlayer, leader: attLeader, field: attField };
      let newState = updatePlayer(state, side, updatedAtt);
      newState = { ...newState, pendingAttack };
      const defenderName = action.targetInstanceId === "leader"
        ? `${action.targetSide === "host" ? "Host" : "Guest"} Leader`
        : defPlayer.field.find((c) => c.instanceId === action.targetInstanceId)?.name ?? "target";
      newState = addLog(
        newState,
        `${side === "host" ? "Host" : "Guest"} attacks ${defenderName} with ${attackerCard.name} (${getEffectivePower(attackerCard)})! Defender may counter.`,
      );
      return { state: newState };
    }

    case "activate_blocker": {
      const pending = state.pendingAttack;
      if (!pending) return { state, error: "No pending attack to block" };
      if (side !== pending.defenderSide) return { state, error: "Only the defender can activate blockers" };

      const defender = getPlayer(state, side);
      const idx = defender.field.findIndex((c) => c.instanceId === action.blockerInstanceId);
      if (idx === -1) return { state, error: "Blocker not found on field" };
      const blocker = defender.field[idx];
      if (blocker.rested) return { state, error: "Blocker is already rested" };
      if (!blocker.keywords.includes("Blocker")) return { state, error: "Card is not a Blocker" };

      // Put blocker in rested position and redirect attack to it
      const newField = defender.field.map((c, i) => (i === idx ? { ...c, rested: true } : c));
      const updatedDef: PlayerState = { ...defender, field: newField };
      let newState = updatePlayer(state, side, updatedDef);
      const newPending: PendingAttack = { ...pending, targetInstanceId: blocker.instanceId };
      newState = { ...newState, pendingAttack: newPending };
      newState = addLog(newState, `${side === "host" ? "Host" : "Guest"} activated Blocker ${blocker.name} to intercept the attack.`);
      return { state: newState };
    }

    case "activate_ability": {
      if (notMyTurn) return { state, error: "Not your turn" };
      if (state.phase !== "main") return { state, error: "Can only activate abilities in the Main phase" };

      const player = getPlayer(state, side);
      // ability can be on leader or field
      let targetCard: CardInstance | undefined;
      if (action.instanceId === "leader") {
        targetCard = player.leader;
      } else {
        targetCard = player.field.find((c) => c.instanceId === action.instanceId);
      }
      if (!targetCard) return { state, error: "Ability target not found" };

      // Only allow if card has Activate: Main keyword (basic check)
      if (!targetCard.keywords.some((k) => k.startsWith("Activate: Main"))) {
        return { state, error: "This card has no Activate: Main ability" };
      }

      // Mark card as rested (costs an action) and log; effect application is data-driven and not implemented here
      if (action.instanceId === "leader") {
        const newLeader = { ...player.leader, rested: true };
        const updatedPlayer: PlayerState = { ...player, leader: newLeader };
        let newState = updatePlayer(state, side, updatedPlayer);
        newState = addLog(newState, `${side === "host" ? "Host" : "Guest"} activated ability on Leader ${newLeader.name}.`);
        return { state: newState };
      } else {
        const newField = player.field.map((c) => (c.instanceId === action.instanceId ? { ...c, rested: true } : c));
        const updatedPlayer: PlayerState = { ...player, field: newField };
        let newState = updatePlayer(state, side, updatedPlayer);
        const card = player.field.find((c) => c.instanceId === action.instanceId)!;
        newState = addLog(newState, `${side === "host" ? "Host" : "Guest"} activated ability on ${card.name}.`);
        return { state: newState };
      }
    }

    case "declare_counter": {
      const pending = state.pendingAttack;
      if (!pending) return { state, error: "No pending attack to counter" };
      if (side !== pending.defenderSide) return { state, error: "Only the defender can counter" };

      const defender = getPlayer(state, side);
      const counterCards = defender.hand.filter((c) => action.cardInstanceIds.includes(c.instanceId));
      if (counterCards.length !== action.cardInstanceIds.length) {
        return { state, error: "Some counter cards not found in hand" };
      }
      const counterValue = counterCards.reduce((sum, c) => sum + (c.counter ?? 0), 0);
      if (counterValue === 0) return { state, error: "Selected cards have no counter value" };

      const newHand = defender.hand.filter((c) => !action.cardInstanceIds.includes(c.instanceId));
      const newTrash = [...defender.trash, ...counterCards];
      const updatedDefender: PlayerState = { ...defender, hand: newHand, trash: newTrash };
      const newPending: PendingAttack = { ...pending, counterPower: pending.counterPower + counterValue };

      let newState = updatePlayer(state, side, updatedDefender);
      newState = { ...newState, pendingAttack: newPending };
      newState = addLog(
        newState,
        `${side === "host" ? "Host" : "Guest"} counters with ${counterCards.map((c) => c.name).join(", ")}! +${counterValue} counter power. (Total: ${newPending.counterPower})`,
      );
      return { state: newState };
    }

    case "resolve_attack": {
      const pending = state.pendingAttack;
      if (!pending) return { state, error: "No pending attack to resolve" };
      if (side !== pending.attackerSide && side !== pending.defenderSide) {
        return { state, error: "Only participants can resolve the attack" };
      }
      return resolveAttack(state, pending);
    }

    case "concede": {
      const opp = opponentSide(side);
      let newState: GameState = { ...state, winner: opp, pendingAttack: null };
      newState = addLog(newState, `${side === "host" ? "Host" : "Guest"} conceded. ${opp === "host" ? "Host" : "Guest"} wins!`);
      return { state: newState };
    }

    default:
      return { state, error: "Unknown action type" };
  }
}
