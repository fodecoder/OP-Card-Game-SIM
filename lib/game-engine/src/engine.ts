import type {
  DBCard,
  CardInstance,
  PlayerState,
  PlayerSide,
  GameState,
  GameAction,
  GameActionResult,
  PendingAttack,
  EffectOperation,
  PendingEffect,
} from "./types.js";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeInstance(card: DBCard): CardInstance {
  return {
    ...card,
    instanceId: generateId(),
    rested: false,
    attachedDon: 0,
    summonedThisTurn: false,
  };
}

function getPlayer(state: GameState, side: PlayerSide): PlayerState {
  return side === "host" ? state.host : state.guest;
}

function opponentSide(side: PlayerSide): PlayerSide {
  return side === "host" ? "guest" : "host";
}

function updatePlayer(state: GameState, side: PlayerSide, player: PlayerState): GameState {
  return side === "host" ? { ...state, host: player } : { ...state, guest: player };
}

function addLog(state: GameState, ...messages: string[]): GameState {
  return { ...state, log: [...state.log, ...messages].slice(-80) };
}

function hasKeyword(card: CardInstance, keyword: string): boolean {
  const expected = keyword.trim().toLowerCase();
  return card.keywords.some((value) => value.trim().toLowerCase() === expected);
}

function effectivePower(card: CardInstance): number {
  return (card.power ?? 0) + card.attachedDon * 1000;
}

function parseOrderedEffects(text: string | null): EffectOperation[] {
  if (!text) return [];

  const body = text.replace(/\[[^\]]+\]/g, " ");
  const matches: Array<{ index: number; operation: EffectOperation }> = [];
  const drawPattern = /\bdraw\s+(\d+|one)\s+cards?\b/gi;
  const trashPattern = /\b(?:trash|discard)\s+(\d+|one)\s+cards?\s+from\s+your\s+hand\b/gi;

  for (const match of body.matchAll(drawPattern)) {
    matches.push({
      index: match.index ?? 0,
      operation: {
        type: "draw",
        count: match[1].toLowerCase() === "one" ? 1 : Number(match[1]),
      },
    });
  }
  for (const match of body.matchAll(trashPattern)) {
    matches.push({
      index: match.index ?? 0,
      operation: {
        type: "trash_from_hand",
        count: match[1].toLowerCase() === "one" ? 1 : Number(match[1]),
      },
    });
  }

  return matches.sort((a, b) => a.index - b.index).map(({ operation }) => operation);
}

function createPlayerState(userId: number, deckId: number, cards: DBCard[]): PlayerState {
  const leaders = cards.filter((card) => card.cardType === "leader");
  if (leaders.length !== 1) throw new Error("Deck must contain exactly one Leader");

  const deck = shuffle(cards.filter((card) => card.cardType !== "leader").map(makeInstance));
  const hand = deck.splice(0, 5);
  return {
    userId,
    deckId,
    leader: makeInstance(leaders[0]),
    life: [],
    hand,
    deck,
    field: [],
    trash: [],
    donDeck: 10,
    donActive: 0,
    donRested: 0,
    mulliganUsed: false,
    setupComplete: false,
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
  return {
    turn: 1,
    activePlayer: "host",
    phase: "setup",
    host: createPlayerState(hostUserId, hostDeckId, hostCards),
    guest: createPlayerState(guestUserId, guestDeckId, guestCards),
    winner: null,
    pendingAttack: null,
    pendingEffect: null,
    log: [
      "Game started. Host goes first.",
      "Both players drew 5 cards. Host decides whether to mulligan first.",
    ],
  };
}

function finishSetupIfReady(state: GameState): GameState {
  if (!state.host.setupComplete || !state.guest.setupComplete) return state;

  let next = state;
  for (const side of ["host", "guest"] as const) {
    const player = getPlayer(next, side);
    const deck = [...player.deck];
    const life = deck.splice(0, player.leader.life ?? 4);
    next = updatePlayer(next, side, { ...player, deck, life });
  }

  next = updatePlayer(next, "host", {
    ...next.host,
    donDeck: next.host.donDeck - 1,
    donActive: 1,
  });
  return addLog(
    { ...next, phase: "main", activePlayer: "host" },
    "Mulligan complete. Life cards placed face-down.",
    "Host gains 1 DON!! and skips the first-turn draw.",
    "Phase: MAIN",
  );
}

function drawOne(state: GameState, side: PlayerSide): GameState {
  const player = getPlayer(state, side);
  if (player.deck.length === 0) {
    return addLog(
      { ...state, winner: opponentSide(side), pendingEffect: null },
      `${side === "host" ? "Host" : "Guest"} loses because their deck is empty.`,
    );
  }

  const [drawn, ...deck] = player.deck;
  return updatePlayer(state, side, { ...player, deck, hand: [...player.hand, drawn] });
}

function continuePendingEffect(state: GameState): GameState {
  let current = state;
  let pending = current.pendingEffect;
  if (!pending) return current;

  while (pending.operations.length > 0) {
    const [operation, ...remaining] = pending.operations;
    if (operation.type === "trash_from_hand") {
      return { ...current, pendingEffect: { ...pending, operations: [operation, ...remaining] } };
    }

    for (let i = 0; i < operation.count; i++) {
      current = drawOne(current, pending.side);
      if (current.winner) return current;
    }
    current = addLog(current, `${pending.sourceName}: drew ${operation.count} card(s).`);
    pending = { ...pending, operations: remaining };
    current = { ...current, pendingEffect: pending };
  }

  return addLog({ ...current, pendingEffect: null }, `${pending.sourceName}'s effect resolved.`);
}

function queueEffect(state: GameState, side: PlayerSide, card: CardInstance): GameState {
  const operations = parseOrderedEffects(card.effectText);
  if (operations.length === 0) {
    return card.effectText
      ? addLog(state, `${card.name}: card-specific effect is not automated yet.`)
      : state;
  }

  const pendingEffect: PendingEffect = {
    sourceInstanceId: card.instanceId,
    sourceName: card.name,
    side,
    operations,
  };
  return continuePendingEffect({ ...state, pendingEffect });
}

function refreshPlayer(state: GameState, side: PlayerSide): GameState {
  const player = getPlayer(state, side);
  const attached =
    player.leader.attachedDon +
    player.field.reduce((sum, card) => sum + card.attachedDon, 0);
  return updatePlayer(state, side, {
    ...player,
    leader: { ...player.leader, rested: false, attachedDon: 0 },
    field: player.field.map((card) => ({
      ...card,
      rested: false,
      attachedDon: 0,
      summonedThisTurn: false,
    })),
    donActive: player.donActive + player.donRested + attached,
    donRested: 0,
  });
}

function startNextTurn(state: GameState): GameState {
  const side = opponentSide(state.activePlayer);
  const turn = side === "host" ? state.turn + 1 : state.turn;
  let next = addLog(
    { ...state, activePlayer: side, turn, phase: "refresh", pendingAttack: null },
    `--- Turn ${turn}: ${side === "host" ? "Host" : "Guest"} ---`,
  );
  next = refreshPlayer(next, side);
  next = { ...next, phase: "draw" };
  next = drawOne(next, side);
  if (next.winner) return next;
  next = addLog(next, "Draw: drew 1 card.");

  const player = getPlayer(next, side);
  const gained = Math.min(2, player.donDeck);
  next = updatePlayer(next, side, {
    ...player,
    donDeck: player.donDeck - gained,
    donActive: player.donActive + gained,
  });
  return addLog({ ...next, phase: "main" }, `DON!!: gained ${gained}.`, "Phase: MAIN");
}

function resolveAttack(state: GameState, attack: PendingAttack): GameActionResult {
  const attacker = getPlayer(state, attack.attackerSide);
  const defender = getPlayer(state, attack.defenderSide);
  const attackerCard =
    attack.attackerInstanceId === "leader"
      ? attacker.leader
      : attacker.field.find((card) => card.instanceId === attack.attackerInstanceId);
  const defenderCard =
    attack.targetInstanceId === "leader"
      ? defender.leader
      : defender.field.find((card) => card.instanceId === attack.targetInstanceId);
  if (!attackerCard || !defenderCard) return { state, error: "Attack card is no longer available" };

  const attackPower = effectivePower(attackerCard);
  const defensePower = effectivePower(defenderCard) + attack.counterPower;
  let next: GameState = { ...state, pendingAttack: null };
  if (attackPower < defensePower) {
    return {
      state: addLog(next, `${defenderCard.name} defended (${defensePower} > ${attackPower}).`),
    };
  }

  if (attack.targetInstanceId === "leader") {
    let damagedPlayer = defender;
    const messages: string[] = [];
    for (let damage = 0; damage < attack.damage; damage++) {
      if (damagedPlayer.life.length === 0) {
        return {
          state: addLog(
            { ...updatePlayer(next, attack.defenderSide, damagedPlayer), winner: attack.attackerSide },
            ...messages,
            `${attack.attackerSide === "host" ? "Host" : "Guest"} wins with a finishing blow.`,
          ),
        };
      }

      const life = [...damagedPlayer.life];
      const lifeCard = life.pop()!;
      damagedPlayer = {
        ...damagedPlayer,
        life,
        hand: attack.banish ? damagedPlayer.hand : [...damagedPlayer.hand, lifeCard],
        trash: attack.banish ? [...damagedPlayer.trash, lifeCard] : damagedPlayer.trash,
      };
      messages.push(
        attack.banish
          ? `Banish: a Life card was sent directly to trash. ${life.length} Life remaining.`
          : `${attack.defenderSide === "host" ? "Host" : "Guest"} added a Life card to hand. ${life.length} Life remaining.`,
      );
      if (!attack.banish && lifeCard.triggerEffect) {
        messages.push(`${lifeCard.name} has a Trigger that may be activated.`);
      }
    }
    return { state: addLog(updatePlayer(next, attack.defenderSide, damagedPlayer), ...messages) };
  }

  const field = defender.field.filter((card) => card.instanceId !== defenderCard.instanceId);
  next = updatePlayer(next, attack.defenderSide, {
    ...defender,
    field,
    trash: [...defender.trash, defenderCard],
    donActive: defender.donActive + defenderCard.attachedDon,
  });
  return { state: addLog(next, `${defenderCard.name} was K.O.'d.`) };
}

export function processAction(
  state: GameState,
  side: PlayerSide,
  action: GameAction,
): GameActionResult {
  if (state.winner) return { state, error: "Game is already over" };

  if (state.phase === "setup") {
    if (action.type !== "keep_hand" && action.type !== "mulligan" && action.type !== "concede") {
      return { state, error: "Complete the mulligan before playing" };
    }
    if (action.type === "concede") {
      return { state: { ...state, winner: opponentSide(side) } };
    }

    const expectedSide: PlayerSide = state.host.setupComplete ? "guest" : "host";
    if (side !== expectedSide) return { state, error: `${expectedSide} must decide first` };
    const player = getPlayer(state, side);
    if (player.setupComplete) return { state, error: "Mulligan decision already made" };

    let updated = player;
    if (action.type === "mulligan") {
      const deck = shuffle([...player.deck, ...player.hand]);
      const hand = deck.splice(0, 5);
      updated = { ...player, deck, hand, mulliganUsed: true, setupComplete: true };
    } else {
      updated = { ...player, setupComplete: true };
    }
    return {
      state: finishSetupIfReady(
        addLog(
          updatePlayer(state, side, updated),
          `${side === "host" ? "Host" : "Guest"} ${action.type === "mulligan" ? "took a mulligan" : "kept their hand"}.`,
        ),
      ),
    };
  }

  if (state.pendingEffect) {
    if (action.type !== "resolve_effect" && action.type !== "concede") {
      return { state, error: "Resolve the pending card effect first" };
    }
    if (action.type === "concede") {
      return { state: { ...state, winner: opponentSide(side), pendingEffect: null } };
    }
    if (side !== state.pendingEffect.side) return { state, error: "The effect belongs to the other player" };

    const [operation, ...remaining] = state.pendingEffect.operations;
    if (!operation || operation.type !== "trash_from_hand") {
      return { state: continuePendingEffect(state) };
    }
    const ids = action.cardInstanceIds ?? [];
    if (ids.length !== operation.count || new Set(ids).size !== ids.length) {
      return { state, error: `Select exactly ${operation.count} card(s) to trash` };
    }
    const player = getPlayer(state, side);
    const selected = player.hand.filter((card) => ids.includes(card.instanceId));
    if (selected.length !== operation.count) return { state, error: "Selected card is not in hand" };

    let next = updatePlayer(state, side, {
      ...player,
      hand: player.hand.filter((card) => !ids.includes(card.instanceId)),
      trash: [...player.trash, ...selected],
    });
    next = addLog(next, `${state.pendingEffect.sourceName}: trashed ${operation.count} card(s) from hand.`);
    return {
      state: continuePendingEffect({
        ...next,
        pendingEffect: { ...state.pendingEffect, operations: remaining },
      }),
    };
  }

  const notMyTurn = state.activePlayer !== side;
  if (action.type !== "concede" && action.type !== "declare_counter" && action.type !== "activate_blocker" && action.type !== "resolve_attack" && notMyTurn) {
    return { state, error: "Not your turn" };
  }

  switch (action.type) {
    case "pass_phase":
    case "end_turn":
      if (state.pendingAttack) return { state, error: "Resolve the pending attack first" };
      return { state: startNextTurn(state) };

    case "play_card": {
      if (state.phase !== "main") return { state, error: "Cards can only be played in Main" };
      const player = getPlayer(state, side);
      const card = player.hand.find((value) => value.instanceId === action.instanceId);
      if (!card) return { state, error: "Card not in hand" };
      if (card.cardType === "leader") return { state, error: "Leader is already in play" };
      const cost = card.cost ?? 0;
      if (player.donActive < cost) return { state, error: `Not enough DON!! (need ${cost})` };

      const hand = player.hand.filter((value) => value.instanceId !== card.instanceId);
      const isPermanent = card.cardType === "character" || card.cardType === "stage";
      const played = { ...card, summonedThisTurn: card.cardType === "character" };
      let next = updatePlayer(state, side, {
        ...player,
        hand,
        field: isPermanent ? [...player.field, played] : player.field,
        trash: isPermanent ? player.trash : [...player.trash, card],
        donActive: player.donActive - cost,
        donRested: player.donRested + cost,
      });
      next = addLog(next, `${card.name} was played for ${cost} DON!!.`);
      if (hasKeyword(card, "On Play") || card.cardType === "event") {
        next = queueEffect(next, side, played);
      }
      return { state: next };
    }

    case "give_don": {
      if (state.phase !== "main") return { state, error: "DON!! can only be given in Main" };
      if (!Number.isInteger(action.donCount) || action.donCount < 1) {
        return { state, error: "DON!! count must be positive" };
      }
      const player = getPlayer(state, side);
      if (player.donActive < action.donCount) return { state, error: "Not enough active DON!!" };
      if (action.targetInstanceId === "leader") {
        return {
          state: updatePlayer(state, side, {
            ...player,
            leader: { ...player.leader, attachedDon: player.leader.attachedDon + action.donCount },
            donActive: player.donActive - action.donCount,
          }),
        };
      }
      const target = player.field.find((card) => card.instanceId === action.targetInstanceId);
      if (!target) return { state, error: "DON!! target not found" };
      return {
        state: updatePlayer(state, side, {
          ...player,
          field: player.field.map((card) =>
            card.instanceId === target.instanceId
              ? { ...card, attachedDon: card.attachedDon + action.donCount }
              : card,
          ),
          donActive: player.donActive - action.donCount,
        }),
      };
    }

    case "declare_attack": {
      if (state.phase !== "main") return { state, error: "Attacks can only be declared in Main" };
      if (state.turn === 1) return { state, error: "Neither player can attack on their first turn" };
      if (state.pendingAttack) return { state, error: "An attack is already pending" };
      if (action.targetSide === side) return { state, error: "Cannot attack your own cards" };

      const player = getPlayer(state, side);
      let attacker: CardInstance | undefined;
      let leader = player.leader;
      let field = [...player.field];
      if (action.attackerInstanceId === "leader") {
        attacker = leader;
        if (leader.rested) return { state, error: "Leader is rested" };
        leader = { ...leader, rested: true };
      } else {
        const index = field.findIndex((card) => card.instanceId === action.attackerInstanceId);
        if (index < 0) return { state, error: "Attacker not found" };
        attacker = field[index];
        if (attacker.rested) return { state, error: "Attacker is rested" };
        if (attacker.summonedThisTurn && !hasKeyword(attacker, "Rush")) {
          return { state, error: "This Character cannot attack on the turn it was played" };
        }
        field[index] = { ...attacker, rested: true };
      }

      const defender = getPlayer(state, action.targetSide);
      if (action.targetInstanceId !== "leader") {
        const target = defender.field.find((card) => card.instanceId === action.targetInstanceId);
        if (!target) return { state, error: "Target not found" };
        if (!target.rested) return { state, error: "Only rested Characters can be attacked" };
      }

      const pendingAttack: PendingAttack = {
        attackerSide: side,
        attackerInstanceId: action.attackerInstanceId,
        defenderSide: action.targetSide,
        targetInstanceId: action.targetInstanceId,
        counterPower: 0,
        damage: hasKeyword(attacker, "Double Attack") ? 2 : 1,
        banish: hasKeyword(attacker, "Banish"),
      };
      return {
        state: addLog(
          {
            ...updatePlayer(state, side, { ...player, leader, field }),
            pendingAttack,
          },
          `${attacker.name} attacks.`,
        ),
      };
    }

    case "activate_blocker": {
      const pending = state.pendingAttack;
      if (!pending || pending.defenderSide !== side) return { state, error: "No attack to block" };
      const player = getPlayer(state, side);
      const blocker = player.field.find((card) => card.instanceId === action.blockerInstanceId);
      if (!blocker || blocker.rested || !hasKeyword(blocker, "Blocker")) {
        return { state, error: "An active Blocker is required" };
      }
      return {
        state: {
          ...updatePlayer(state, side, {
            ...player,
            field: player.field.map((card) =>
              card.instanceId === blocker.instanceId ? { ...card, rested: true } : card,
            ),
          }),
          pendingAttack: { ...pending, targetInstanceId: blocker.instanceId },
        },
      };
    }

    case "declare_counter": {
      const pending = state.pendingAttack;
      if (!pending || pending.defenderSide !== side) return { state, error: "No attack to counter" };
      const player = getPlayer(state, side);
      const selected = player.hand.filter((card) => action.cardInstanceIds.includes(card.instanceId));
      if (selected.length !== action.cardInstanceIds.length) return { state, error: "Counter card not found" };
      const counterPower = selected.reduce((sum, card) => sum + (card.counter ?? 0), 0);
      if (counterPower < 1) return { state, error: "Selected cards have no Counter value" };
      return {
        state: {
          ...updatePlayer(state, side, {
            ...player,
            hand: player.hand.filter((card) => !action.cardInstanceIds.includes(card.instanceId)),
            trash: [...player.trash, ...selected],
          }),
          pendingAttack: { ...pending, counterPower: pending.counterPower + counterPower },
        },
      };
    }

    case "resolve_attack":
      if (!state.pendingAttack) return { state, error: "No pending attack" };
      return resolveAttack(state, state.pendingAttack);

    case "activate_ability": {
      if (state.phase !== "main") return { state, error: "Abilities can only be activated in Main" };
      const player = getPlayer(state, side);
      const card =
        action.instanceId === "leader"
          ? player.leader
          : player.field.find((value) => value.instanceId === action.instanceId);
      if (!card) return { state, error: "Ability source not found" };
      if (!card.keywords.some((keyword) => keyword.toLowerCase().startsWith("activate: main"))) {
        return { state, error: "This card has no Activate: Main ability" };
      }
      return { state: queueEffect(state, side, card) };
    }

    case "concede":
      return {
        state: addLog(
          { ...state, winner: opponentSide(side), pendingAttack: null, pendingEffect: null },
          `${side === "host" ? "Host" : "Guest"} conceded.`,
        ),
      };

    case "keep_hand":
    case "mulligan":
    case "resolve_effect":
      return { state, error: "Action is not valid at this time" };
  }
}
