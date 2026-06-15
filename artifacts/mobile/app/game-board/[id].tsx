import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  ImageBackground,
  Modal,
  Animated,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Feather } from "@expo/vector-icons";
import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GameState, CardInstance, PlayerSide, GameAction } from "@workspace/game-engine";
import { getApiBaseUrl } from "@/lib/url";
import { LinearGradient } from "expo-linear-gradient";
import { CardImage } from "@/components/CardImage";

const TYPE_ORDER: Record<string, number> = { character: 0, event: 1, stage: 2, leader: 3 };
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

function sortHand(hand: CardInstance[]): CardInstance[] {
  return [...hand].sort((a, b) => {
    const ta = TYPE_ORDER[a.cardType.toLowerCase()] ?? 99;
    const tb = TYPE_ORDER[b.cardType.toLowerCase()] ?? 99;
    if (ta !== tb) return ta - tb;
    const colorCmp = (a.color ?? "").localeCompare(b.color ?? "");
    if (colorCmp !== 0) return colorCmp;
    if ((b.counter ?? 0) !== (a.counter ?? 0)) return (b.counter ?? 0) - (a.counter ?? 0);
    return (a.cost ?? 0) - (b.cost ?? 0);
  });
}

function apiBase(): string {
  return getApiBaseUrl();
}

async function fetchGameState(gameId: number, token: string | null) {
  const res = await fetch(`${apiBase()}/api/games/${gameId}/state`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ state: GameState; version: number }>;
}

async function sendAction(gameId: number, side: PlayerSide, action: GameAction, token: string | null) {
  const res = await fetch(`${apiBase()}/api/games/${gameId}/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ side, action }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Action failed");
  }
  return res.json() as Promise<{ state: GameState; version: number }>;
}

function LifeCounter({ count, color }: { count: number; color: string }) {
  return (
    <View style={styles.lifeRow}>
      {Array.from({ length: Math.max(count, 0) }).map((_, i) => (
        <View key={i} style={[styles.lifeCard, { backgroundColor: color }]} />
      ))}
      {count === 0 && <Text style={[styles.noLife, { color }]}>NO LIFE</Text>}
    </View>
  );
}

function DonCounter({ active, rested, deck, color }: { active: number; rested: number; deck: number; color: string }) {
  return (
    <View style={[styles.donBadge, { borderColor: color }]}>
      <Text style={[styles.donText, { color }]}>DON!! {active}</Text>
      {rested > 0 && <Text style={[styles.donRestedText, { color: color + "99" }]}>rested: {rested}</Text>}
      <Text style={[styles.donDeckText, { color: color + "99" }]}>deck: {deck}</Text>
    </View>
  );
}

function CardThumb({
  card, onPress, onLongPress, highlight, rested, don, colors,
}: {
  card: CardInstance;
  onPress?: () => void;
  onLongPress?: () => void;
  highlight?: boolean;
  rested?: boolean;
  don?: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={[
        styles.cardThumb,
        { borderColor: highlight ? colors.primary : colors.border },
        rested && styles.cardRested,
      ]}
    >
      <CardImage card={card} width="100%" height="100%" />
      {(don ?? 0) > 0 && (
        <View style={[styles.donChip, { backgroundColor: colors.primary }]}>
          <Text style={styles.donChipText}>+{don}</Text>
        </View>
      )}
      {card.counter != null && card.counter > 0 && (
        <View style={[styles.counterChip, { backgroundColor: "#1d4ed8" }]}>
          <Text style={styles.counterChipText}>+{card.counter}</Text>
        </View>
      )}
      {card.summonedThisTurn && card.keywords.includes("Rush") && (
        <View style={[styles.rushChip, { backgroundColor: "#e63946" }]}>
          <Text style={styles.rushChipText}>RUSH</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function HandCard({
  card, onPress, onLongPress, selected, highlighted, colors,
}: {
  card: CardInstance;
  onPress: () => void;
  onLongPress: () => void;
  selected: boolean;
  highlighted?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.handCard,
        {
          borderColor: selected ? colors.primary : highlighted ? "#1d4ed8" : colors.border,
          backgroundColor: colors.card,
        },
      ]}
    >
      <CardImage card={card} width="100%" height={110} />
      <View style={styles.handCardMeta}>
        <Text style={[styles.handCardName, { color: colors.foreground }]} numberOfLines={1}>
          {card.name}
        </Text>
        <Text style={[styles.handCardCost, { color: colors.primary }]}>Cost: {card.cost ?? 0}</Text>
        {card.power != null && (
          <Text style={[styles.handCardStat, { color: colors.mutedForeground }]}>PWR: {card.power}</Text>
        )}
        {card.counter != null && (
          <Text style={[styles.handCardStat, { color: "#3b82f6" }]}>CTR: +{card.counter}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function CardDetailModal({ card, onClose, colors }: { card: CardInstance; onClose: () => void; colors: ReturnType<typeof useColors> }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <View style={styles.modalInner}>
            <CardImage card={card} width={110} height={154} />
            <View style={styles.modalInfo}>
              <Text style={[styles.modalCardName, { color: colors.foreground }]}>{card.name}</Text>
              <Text style={[styles.modalCardType, { color: colors.mutedForeground }]}>
                {card.cardType.charAt(0).toUpperCase() + card.cardType.slice(1)} · {card.color}
              </Text>
              <View style={styles.modalStats}>
                {card.cost != null && (
                  <View style={[styles.statBadge, { backgroundColor: colors.primary + "22" }]}>
                    <Text style={[styles.statBadgeText, { color: colors.primary }]}>Cost {card.cost}</Text>
                  </View>
                )}
                {card.power != null && (
                  <View style={[styles.statBadge, { backgroundColor: colors.success + "22" }]}>
                    <Text style={[styles.statBadgeText, { color: colors.success }]}>{card.power.toLocaleString()}</Text>
                  </View>
                )}
                {card.counter != null && (
                  <View style={[styles.statBadge, { backgroundColor: "#1d4ed822" }]}>
                    <Text style={[styles.statBadgeText, { color: "#3b82f6" }]}>CTR +{card.counter}</Text>
                  </View>
                )}
              </View>
              {card.effectText ? <Text style={[styles.modalEffect, { color: colors.foreground }]}>{card.effectText}</Text> : null}
              {card.triggerEffect ? <Text style={[styles.modalTrigger, { color: colors.accent }]}>Trigger: {card.triggerEffect}</Text> : null}
              {card.keywords.length > 0 && <Text style={[styles.modalKeywords, { color: colors.mutedForeground }]}>{card.keywords.join(" · ")}</Text>}
            </View>
          </View>
          <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={[styles.modalCloseBtnText, { color: colors.primaryForeground }]}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function PlayerBoard({
  player,
  side,
  isMine,
  colors,
  attackingCard,
  pendingAttack,
  selectedCard,
  canAttack,
  canActivate,
  onLeaderPress,
  onCardPress,
  onCardDetail,
  onTrashPress,
  onActivate,
}: {
  player: GameState[PlayerSide];
  side: PlayerSide;
  isMine: boolean;
  colors: ReturnType<typeof useColors>;
  attackingCard: CardInstance | null;
  pendingAttack: GameState["pendingAttack"];
  selectedCard: CardInstance | null;
  canAttack: boolean;
  canActivate: boolean;
  onLeaderPress: () => void;
  onCardPress: (card: CardInstance) => void;
  onCardDetail: (card: CardInstance) => void;
  onTrashPress: () => void;
  onActivate: (instanceId: string) => void;
}) {
  const characters = player.field.filter((card) => card.cardType === "character");
  const stage = player.field.find((card) => card.cardType === "stage");
  const hasActivateMain = (card: CardInstance) =>
    card.keywords.some((key) => key.toLowerCase().includes("activate: main")) ||
    card.effectText?.toLowerCase().includes("[activate: main]") === true;

  return (
    <ImageBackground
      source={require("../../assets/images/board-playmat.png")}
      resizeMode="stretch"
      style={[styles.playerBoard, !isMine && styles.opponentBoard]}
      imageStyle={styles.playerBoardImage}
    >
      <View style={styles.boardStatus}>
        <Text style={styles.boardStatusText}>
          {side.toUpperCase()} · Hand {player.hand.length}
        </Text>
      </View>

      <View style={[styles.boardSlot, styles.lifeSlot]}>
        <LifeCounter count={player.life.length} color={isMine ? colors.success : colors.destructive} />
      </View>

      <View style={[styles.boardSlot, styles.characterSlot]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.boardCardRow}>
            {characters.map((card) => (
              <CardThumb
                key={card.instanceId}
                card={card}
                colors={colors}
                rested={card.rested}
                don={card.attachedDon}
                highlight={
                  pendingAttack?.targetInstanceId === card.instanceId ||
                  selectedCard?.instanceId === card.instanceId ||
                  attackingCard?.instanceId === card.instanceId
                }
                onPress={() => onCardPress(card)}
                onLongPress={() => onCardDetail(card)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <TouchableOpacity
        style={[styles.boardSlot, styles.leaderSlot, player.leader.rested && styles.cardRested]}
        onPress={onLeaderPress}
        onLongPress={() => onCardDetail(player.leader)}
      >
        <CardImage card={player.leader} width="100%" height="100%" />
        <View style={[styles.leaderPowerBadge, { backgroundColor: colors.card }]}>
          <Text style={[styles.leaderPowerText, { color: colors.primary }]}>
            {(player.leader.power ?? 0) + player.leader.attachedDon * 1000}
          </Text>
        </View>
      </TouchableOpacity>

      {isMine && canActivate && hasActivateMain(player.leader) && (
        <TouchableOpacity
          style={[styles.boardActivateBtn, { backgroundColor: colors.primary }]}
          onPress={() => onActivate("leader")}
        >
          <Text style={styles.boardActivateText}>LEADER ABILITY</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.boardSlot, styles.stageSlot]}>
        {stage && (
          <CardThumb
            card={stage}
            colors={colors}
            rested={stage.rested}
            onPress={() => onCardPress(stage)}
            onLongPress={() => onCardDetail(stage)}
          />
        )}
      </View>

      <View style={[styles.boardSlot, styles.deckSlot]}>
        <Text style={styles.stackCount}>{player.deck.length}</Text>
      </View>

      <View style={[styles.boardSlot, styles.donSlot]}>
        <DonCounter
          active={player.donActive}
          rested={player.donRested}
          deck={player.donDeck}
          color={colors.accent}
        />
      </View>

      <View style={[styles.boardSlot, styles.costSlot]}>
        <View style={styles.donPips}>
          {Array.from({ length: Math.min(10, player.donActive + player.donRested) }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.donPip,
                { backgroundColor: index < player.donActive ? colors.accent : colors.mutedForeground },
              ]}
            />
          ))}
        </View>
      </View>

      <TouchableOpacity style={[styles.boardSlot, styles.trashSlot]} onPress={onTrashPress}>
        <Feather name="trash-2" size={15} color="#d1d5db" />
        <Text style={styles.stackCount}>{player.trash.length}</Text>
      </TouchableOpacity>

      {isMine && canActivate && (
        <View style={styles.fieldAbilityRail}>
          {player.field
            .filter(hasActivateMain)
            .map((card) => (
              <TouchableOpacity
                key={card.instanceId}
                style={[styles.fieldAbilityChip, { backgroundColor: colors.card }]}
                onPress={() => onActivate(card.instanceId)}
              >
                <Text style={[styles.fieldAbilityText, { color: colors.primary }]} numberOfLines={1}>
                  Use {card.name}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
      )}

      {!isMine && attackingCard && canAttack && (
        <View pointerEvents="none" style={styles.attackHint}>
          <Text style={styles.attackHintText}>SELECT TARGET</Text>
        </View>
      )}
    </ImageBackground>
  );
}

export default function GameBoardScreen() {
  const { id } = useLocalSearchParams();
  const gameId = parseInt(id as string, 10);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { accessToken, logout } = useAuth();
  const qc = useQueryClient();

  const [perspective, setPerspective] = useState<PlayerSide>("host");
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);
  const [attackingCard, setAttackingCard] = useState<CardInstance | null>(null);
  const [donMode, setDonMode] = useState(false);
  const [donTargetId, setDonTargetId] = useState<string>("leader");
  const [detailCard, setDetailCard] = useState<CardInstance | null>(null);
  const [confirmingConcede, setConfirmingConcede] = useState(false);
  const [counterSelectedIds, setCounterSelectedIds] = useState<string[]>([]);
  const [showTrash, setShowTrash] = useState<PlayerSide | null>(null);
  const logRef = useRef<ScrollView>(null);
  const boardEntrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(boardEntrance, {
      toValue: 1,
      tension: 45,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [boardEntrance]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["game-state", gameId],
    queryFn: () => fetchGameState(gameId, accessToken),
    refetchInterval: 3000,
  });

  const actionMutation = useMutation({
    mutationFn: (vars: { action: GameAction; side: PlayerSide }) =>
      sendAction(gameId, vars.side, vars.action, accessToken),
    onSuccess: (res) => {
      qc.setQueryData(["game-state", gameId], { state: res.state, version: res.version });
      setSelectedCard(null);
      setAttackingCard(null);
      setDonMode(false);
      setCounterSelectedIds([]);
    },
    onError: (err: Error) => Alert.alert("Invalid Action", err.message),
  });

  const doAction = useCallback(
    (action: GameAction) => {
      actionMutation.mutate({ action, side: perspective });
    },
    [actionMutation, perspective],
  );

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.destructive }]}>
          {(error as Error)?.message ?? "Failed to load game state"}
        </Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.card }]} onPress={() => router.back()}>
          <Text style={{ color: colors.foreground }}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { state } = data;
  const me = state[perspective];
  const opp = state[perspective === "host" ? "guest" : "host"];
  const oppSide: PlayerSide = perspective === "host" ? "guest" : "host";
  const isMyTurn = state.activePlayer === perspective;
  const phase = state.phase.toUpperCase();
  const busy = actionMutation.isPending;

  const canPlayCard = isMyTurn && state.phase === "main" && !state.winner && !state.pendingAttack;
  const canAttack = isMyTurn && state.phase === "main" && !state.winner && !state.pendingAttack;
  const canPassPhase = isMyTurn && (state.phase === "main" || state.phase === "end") && !state.winner && !state.pendingAttack;
  const canEndTurn = isMyTurn && (state.phase === "main" || state.phase === "end") && !state.winner && !state.pendingAttack;

  const isDefenderInPending = state.pendingAttack?.defenderSide === perspective;
  const isAttackerInPending = state.pendingAttack?.attackerSide === perspective;
  const pendingAttack = state.pendingAttack;
  const pendingEffect = state.pendingEffect;
  const pendingTrash = pendingEffect?.operations[0]?.type === "trash_from_hand"
    ? pendingEffect.operations[0]
    : null;

  const sortedHand = sortHand(me.hand);
  function handleHandCardPress(card: CardInstance) {
    if (busy) return;
    if (pendingTrash && pendingEffect?.side === perspective) {
      const ids = counterSelectedIds.includes(card.instanceId)
        ? counterSelectedIds.filter((value) => value !== card.instanceId)
        : [...counterSelectedIds, card.instanceId].slice(-pendingTrash.count);
      setCounterSelectedIds(ids);
      return;
    }
    if (isDefenderInPending && pendingAttack) {
      const ctr = card.counter ?? 0;
      if (ctr === 0) return;
      const ids = counterSelectedIds.includes(card.instanceId)
        ? counterSelectedIds.filter((x) => x !== card.instanceId)
        : [...counterSelectedIds, card.instanceId];
      setCounterSelectedIds(ids);
      return;
    }
    if (!canPlayCard) return;
    if (selectedCard?.instanceId === card.instanceId) {
      doAction({ type: "play_card", instanceId: card.instanceId });
    } else {
      setSelectedCard(card);
      setAttackingCard(null);
    }
  }

  function handleFieldCardPress(card: CardInstance, side: "mine" | "opp") {
    if (!isMyTurn || state.winner || busy) return;
    if (attackingCard && side === "opp" && canAttack) {
      doAction({
        type: "declare_attack",
        attackerInstanceId: attackingCard.instanceId,
        targetSide: oppSide,
        targetInstanceId: card.instanceId,
      });
      return;
    }
    if (canAttack && side === "mine" && !card.rested) {
      if (attackingCard?.instanceId === card.instanceId) {
        setAttackingCard(null);
      } else {
        setAttackingCard(card);
        setSelectedCard(null);
      }
    }
  }

  function handleAttackLeader() {
    if (!attackingCard || !canAttack) return;
    doAction({
      type: "declare_attack",
      attackerInstanceId: attackingCard.instanceId,
      targetSide: oppSide,
      targetInstanceId: "leader",
    });
  }

  function handleLeaderAttack() {
    if (!canAttack) return;
    if (attackingCard?.instanceId === "leader") {
      handleAttackLeader();
    } else {
      setAttackingCard({ ...me.leader, instanceId: "leader" });
      setSelectedCard(null);
    }
  }

  function giveDon(count: number) {
    doAction({ type: "give_don", targetInstanceId: donTargetId, donCount: count });
    setDonMode(false);
  }

  const passPhaseLabel = state.phase === "main" ? "End Phase" : "Pass Phase";

  return (
    <AnimatedGradient
      colors={["#07111f", colors.background, "#160b22"]}
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          opacity: boardEntrance,
          transform: [{
            translateY: boardEntrance.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          }],
        },
      ]}
    >
      <View style={styles.boardGlowTop} pointerEvents="none" />
      <View style={styles.boardGlowBottom} pointerEvents="none" />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.turnLabel, { color: state.winner ? colors.primary : isMyTurn ? colors.success : colors.mutedForeground }]}>
            {state.winner
              ? `Winner: ${state.winner.toUpperCase()}`
              : pendingAttack
                ? (isDefenderInPending ? "Defend — Counter or Resolve" : "Waiting for defender...")
                : isMyTurn
                  ? `Your Turn — ${phase}`
                  : `Opponent's Turn — ${phase}`}
          </Text>
          <Text style={[styles.turnSub, { color: colors.mutedForeground }]}>Turn {state.turn}</Text>
        </View>
        <TouchableOpacity
          style={[styles.perspectiveBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            setPerspective((p) => (p === "host" ? "guest" : "host"));
            setSelectedCard(null);
            setAttackingCard(null);
            setDonMode(false);
            setCounterSelectedIds([]);
          }}
        >
          <Feather name="refresh-cw" size={14} color={colors.primary} />
          <Text style={[styles.perspectiveBtnText, { color: colors.primary }]}>
            {perspective === "host" ? "Host" : "Guest"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.perspectiveBtn, { backgroundColor: colors.destructive }]}
          onPress={async () => {
            await logout();
            router.replace("/auth/login");
          }}
        >
          <Feather name="log-out" size={14} color={colors.primaryForeground} />
          <Text style={[styles.perspectiveBtnText, { color: colors.primaryForeground }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      <PlayerBoard
        player={opp}
        side={oppSide}
        isMine={false}
        colors={colors}
        attackingCard={attackingCard}
        pendingAttack={pendingAttack}
        selectedCard={selectedCard}
        canAttack={canAttack}
        canActivate={false}
        onLeaderPress={() => {
          if (attackingCard && canAttack) handleAttackLeader();
        }}
        onCardPress={(card) => handleFieldCardPress(card, "opp")}
        onCardDetail={setDetailCard}
        onTrashPress={() => setShowTrash(oppSide)}
        onActivate={() => {}}
      />

      {/* Pending Attack Banner */}
      {pendingAttack && (
        <View style={[styles.pendingBanner, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive }]}>
          <Text style={[styles.pendingTitle, { color: colors.destructive }]}>
            ATTACK: {pendingAttack.attackerSide === "host" ? "Host" : "Guest"} → {pendingAttack.defenderSide === "host" ? "Host" : "Guest"}
          </Text>
          <Text style={[styles.pendingSub, { color: colors.mutedForeground }]}>
            Counter power: +{pendingAttack.counterPower}
            {counterSelectedIds.length > 0
              ? ` (+${me.hand.filter((c) => counterSelectedIds.includes(c.instanceId)).reduce((s, c) => s + (c.counter ?? 0), 0)} selected)`
              : ""}
          </Text>
          {/* Blocker activation for defender */}
          {isDefenderInPending && (
            <View style={styles.blockerRow}>
              {opp.field
                .filter((c) => c.keywords.includes("Blocker") && !c.rested)
                .map((b) => (
                  <TouchableOpacity
                    key={b.instanceId}
                    style={[styles.blockerBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                    onPress={() => doAction({ type: "activate_blocker", blockerInstanceId: b.instanceId })}
                    disabled={busy}
                  >
                    <Text style={[styles.blockerBtnText, { color: colors.foreground }]}>Use Blocker: {b.name}</Text>
                  </TouchableOpacity>
                ))}
            </View>
          )}
        </View>
      )}

      {/* Log */}
      <ScrollView
        ref={logRef}
        style={[styles.log, { borderColor: colors.border }]}
        onContentSizeChange={() => logRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      >
        {state.log.map((entry, i) => (
          <Text key={i} style={[styles.logEntry, { color: entry.startsWith("---") ? colors.primary : colors.mutedForeground }]}>
            {entry}
          </Text>
        ))}
      </ScrollView>

      <PlayerBoard
        player={me}
        side={perspective}
        isMine
        colors={colors}
        attackingCard={attackingCard}
        pendingAttack={pendingAttack}
        selectedCard={selectedCard}
        canAttack={canAttack}
        canActivate={isMyTurn && state.phase === "main" && !pendingAttack && !busy}
        onLeaderPress={handleLeaderAttack}
        onCardPress={(card) => handleFieldCardPress(card, "mine")}
        onCardDetail={setDetailCard}
        onTrashPress={() => setShowTrash(perspective)}
        onActivate={(instanceId) => doAction({ type: "activate_ability", instanceId })}
      />

      {/* Hand */}
      <View style={[styles.handSection, { borderTopColor: colors.border }]}>
        <Text style={[styles.handLabel, { color: colors.mutedForeground }]}>
          Hand ({me.hand.length})
          {canPlayCard && selectedCard ? ` — tap again to play: ${selectedCard.name}` : ""}
          {canAttack && attackingCard ? ` — attacking with: ${attackingCard.name}` : ""}
          {isDefenderInPending && counterSelectedIds.length > 0 ? ` — countering with ${counterSelectedIds.length} card(s)` : ""}
          {isDefenderInPending && counterSelectedIds.length === 0 ? " — select cards with CTR to counter" : ""}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.handList}>
          {sortedHand.map((item) => (
            <HandCard
              key={item.instanceId}
              card={item}
              selected={canPlayCard && selectedCard?.instanceId === item.instanceId}
              highlighted={isDefenderInPending && counterSelectedIds.includes(item.instanceId)}
              onPress={() => handleHandCardPress(item)}
              onLongPress={() => setDetailCard(item)}
              colors={colors}
            />
          ))}
        </ScrollView>
      </View>

      {/* Action buttons */}
      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        {state.phase === "setup" && !me.setupComplete && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => doAction({ type: "keep_hand" })}
              disabled={busy || (perspective === "guest" && !state.host.setupComplete)}
            >
              <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Keep Hand</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1 }]}
              onPress={() => doAction({ type: "mulligan" })}
              disabled={busy || (perspective === "guest" && !state.host.setupComplete)}
            >
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Mulligan</Text>
            </TouchableOpacity>
          </>
        )}
        {pendingTrash && pendingEffect?.side === perspective && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.destructive }]}
            onPress={() => doAction({ type: "resolve_effect", cardInstanceIds: counterSelectedIds })}
            disabled={busy || counterSelectedIds.length !== pendingTrash.count}
          >
            <Text style={[styles.actionBtnText, { color: "#fff" }]}>
              Trash {pendingTrash.count} selected
            </Text>
          </TouchableOpacity>
        )}
        {/* Pending attack actions */}
        {pendingAttack && isDefenderInPending && (
          <>
            {counterSelectedIds.length > 0 && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#1d4ed8" }]}
                onPress={() => doAction({ type: "declare_counter", cardInstanceIds: counterSelectedIds })}
                disabled={busy}
              >
                <Text style={[styles.actionBtnText, { color: "#fff" }]}>Counter!</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.destructive }]}
              onPress={() => doAction({ type: "resolve_attack" })}
              disabled={busy}
            >
              <Text style={[styles.actionBtnText, { color: "#fff" }]}>Resolve</Text>
            </TouchableOpacity>
          </>
        )}
        {pendingAttack && isAttackerInPending && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.destructive }]}
            onPress={() => doAction({ type: "resolve_attack" })}
            disabled={busy}
          >
            <Text style={[styles.actionBtnText, { color: "#fff" }]}>Resolve Attack</Text>
          </TouchableOpacity>
        )}

        {/* Normal phase actions */}
        {!pendingAttack && canPassPhase && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => doAction({ type: "pass_phase" })}
            disabled={busy}
          >
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>{passPhaseLabel}</Text>
          </TouchableOpacity>
        )}
        {!pendingAttack && canEndTurn && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => doAction({ type: "end_turn" })}
            disabled={busy}
          >
            <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>End Turn</Text>
          </TouchableOpacity>
        )}
        {canAttack && !pendingAttack && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: attackingCard ? colors.destructive : colors.card, borderColor: colors.destructive, borderWidth: 1 }]}
            onPress={() => attackingCard ? setAttackingCard(null) : null}
            disabled={busy}
          >
            <Text style={[styles.actionBtnText, { color: attackingCard ? "#fff" : colors.destructive }]}>
              {attackingCard ? "Cancel" : "Select Attacker"}
            </Text>
          </TouchableOpacity>
        )}
        {isMyTurn && state.phase === "main" && !donMode && !pendingAttack && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => {
              const card = attackingCard ?? selectedCard;
              setDonTargetId(card ? card.instanceId : "leader");
              setDonMode(true);
            }}
            disabled={busy || me.donActive === 0}
          >
            <Text style={[styles.actionBtnText, { color: me.donActive > 0 ? colors.accent : colors.mutedForeground }]}>
              Give DON!!
            </Text>
          </TouchableOpacity>
        )}
        {donMode && (
          <View style={[styles.donPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.donPanelTitle, { color: colors.accent }]}>Give DON!! to:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36 }}>
              <View style={styles.donTargetRow}>
                {["leader", ...me.field.map((c) => c.instanceId)].map((tid) => {
                  const label = tid === "leader" ? `Leader` : (me.field.find((c) => c.instanceId === tid)?.name ?? tid.slice(0, 8));
                  return (
                    <TouchableOpacity
                      key={tid}
                      onPress={() => setDonTargetId(tid)}
                      style={[styles.donTargetBtn, { borderColor: donTargetId === tid ? colors.accent : colors.border, backgroundColor: donTargetId === tid ? colors.accent + "22" : "transparent" }]}
                    >
                      <Text style={[styles.donTargetText, { color: donTargetId === tid ? colors.accent : colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.donCountRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => giveDon(n)}
                  disabled={busy || me.donActive < n}
                  style={[styles.donCountBtn, { backgroundColor: me.donActive >= n ? colors.accent : colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.donCountText, { color: me.donActive >= n ? "#fff" : colors.mutedForeground }]}>+{n}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setDonMode(false)} style={[styles.donCountBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.donCountText, { color: colors.mutedForeground }]}>X</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {!state.winner && !confirmingConcede && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => setConfirmingConcede(true)}
            disabled={busy}
          >
            <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>Concede</Text>
          </TouchableOpacity>
        )}
        {confirmingConcede && (
          <View style={[styles.confirmRow, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive }]}>
            <Text style={[styles.confirmText, { color: colors.destructive }]}>Forfeit?</Text>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.destructive }]}
              onPress={() => { setConfirmingConcede(false); doAction({ type: "concede" }); }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => setConfirmingConcede(false)}
            >
              <Text style={{ color: colors.foreground, fontSize: 12 }}>No</Text>
            </TouchableOpacity>
          </View>
        )}
        {state.winner && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
            <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Back to Lobby</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Trash modal */}
      {showTrash !== null && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowTrash(null)}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowTrash(null)}>
            <TouchableOpacity activeOpacity={1} style={[styles.trashSheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
              <Text style={[styles.modalCardName, { color: colors.foreground, marginBottom: 8 }]}>
                {showTrash === perspective ? "My Trash" : "Opponent Trash"} ({state[showTrash].trash.length})
              </Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {state[showTrash].trash.length === 0 ? (
                  <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 16 }}>Empty</Text>
                ) : (
                  state[showTrash].trash.map((card) => (
                    <TouchableOpacity
                      key={card.instanceId + "-trash"}
                      onPress={() => { setShowTrash(null); setDetailCard(card); }}
                      style={[styles.trashItem, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.trashItemName, { color: colors.foreground }]}>{card.name}</Text>
                      <Text style={[styles.trashItemType, { color: colors.mutedForeground }]}>
                        {card.cardType} · Cost {card.cost ?? 0}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
              <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: colors.primary, marginTop: 8 }]} onPress={() => setShowTrash(null)}>
                <Text style={[styles.modalCloseBtnText, { color: colors.primaryForeground }]}>Close</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {detailCard && (
        <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} colors={colors} />
      )}
    </AnimatedGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  boardGlowTop: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(37, 99, 235, 0.16)",
    top: -120,
    right: -80,
  },
  boardGlowBottom: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(147, 51, 234, 0.13)",
    bottom: -160,
    left: -100,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  errorText: { fontSize: 16, textAlign: "center", paddingHorizontal: 24 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  turnLabel: { fontSize: 13, fontWeight: "bold", textAlign: "center" },
  turnSub: { fontSize: 10 },
  perspectiveBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  perspectiveBtnText: { fontSize: 12, fontWeight: "bold" },

  playerBoard: {
    width: "100%",
    height: 170,
    position: "relative",
    overflow: "hidden",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "#07101f",
  },
  opponentBoard: { backgroundColor: "#16090d" },
  playerBoardImage: { opacity: 0.58 },
  boardStatus: {
    position: "absolute",
    top: 4,
    left: "40%",
    right: "20%",
    alignItems: "center",
    zIndex: 5,
  },
  boardStatusText: {
    color: "#f8fafc",
    fontSize: 9,
    fontWeight: "800",
    backgroundColor: "rgba(2,6,23,0.72)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  boardSlot: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 5,
  },
  lifeSlot: { left: "2%", top: "8%", width: "15%", height: "48%" },
  characterSlot: { left: "19%", top: "7%", width: "68%", height: "34%" },
  leaderSlot: {
    left: "47%",
    top: "43%",
    width: "13%",
    height: "29%",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(250,204,21,0.9)",
    zIndex: 3,
  },
  stageSlot: { left: "62%", top: "43%", width: "14%", height: "29%" },
  deckSlot: {
    right: "3%",
    top: "43%",
    width: "11%",
    height: "29%",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.55)",
    backgroundColor: "rgba(2,6,23,0.72)",
  },
  donSlot: { left: "2%", bottom: "8%", width: "15%", height: "25%" },
  costSlot: { left: "19%", bottom: "8%", width: "57%", height: "18%" },
  trashSlot: {
    right: "3%",
    bottom: "8%",
    width: "11%",
    height: "22%",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.4)",
    backgroundColor: "rgba(2,6,23,0.68)",
  },
  boardCardRow: { flexDirection: "row", gap: 5, alignItems: "center", paddingHorizontal: 3 },
  stackCount: { color: "#f8fafc", fontSize: 13, fontWeight: "900" },
  donPips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4 },
  donPip: { width: 13, height: 18, borderRadius: 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" },
  boardActivateBtn: {
    position: "absolute",
    left: "43%",
    top: "74%",
    zIndex: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  boardActivateText: { color: "#fff", fontSize: 7, fontWeight: "900" },
  fieldAbilityRail: {
    position: "absolute",
    left: "19%",
    right: "17%",
    top: "35%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    zIndex: 7,
  },
  fieldAbilityChip: { maxWidth: 100, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5 },
  fieldAbilityText: { fontSize: 7, fontWeight: "800" },
  attackHint: {
    position: "absolute",
    left: "35%",
    right: "35%",
    top: "45%",
    paddingVertical: 5,
    alignItems: "center",
    borderRadius: 7,
    backgroundColor: "rgba(220,38,38,0.86)",
    zIndex: 10,
  },
  attackHintText: { color: "#fff", fontSize: 9, fontWeight: "900" },

  oppZone: { borderBottomWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  playmatZone: {
    overflow: "hidden",
    backgroundColor: "rgba(2, 8, 23, 0.92)",
  },
  playmatImage: { opacity: 0.3 },
  playmatImageOpponent: {
    opacity: 0.24,
    transform: [{ rotate: "180deg" }],
  },
  oppTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  oppInfo: { flex: 1 },

  myZone: { borderTopWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  myFieldRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  myInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },

  zoneLabelSmall: { fontSize: 10, fontWeight: "bold", marginBottom: 2 },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  fieldScroll: { flex: 1 },
  fieldCards: { flexDirection: "row", gap: 6, paddingVertical: 2 },
  fieldCardWrapper: { position: "relative" },
  emptyField: { fontSize: 10, fontStyle: "italic", alignSelf: "center", paddingHorizontal: 8 },

  trashBtn: { alignItems: "center", gap: 2, paddingHorizontal: 4 },
  trashCount: { fontSize: 9 },

  lifeRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  lifeCard: {
    width: 16,
    height: 23,
    borderRadius: 3,
    opacity: 0.9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    transform: [{ rotate: "-4deg" }],
  },
  noLife: { fontSize: 10, fontWeight: "bold" },

  donBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center" },
  donText: { fontSize: 13, fontWeight: "bold" },
  donRestedText: { fontSize: 9 },
  donDeckText: { fontSize: 9 },

  leaderThumb: { width: 56, height: 78, borderRadius: 6, borderWidth: 2, overflow: "hidden", position: "relative" },
  leaderImg: { width: "100%", height: "100%" },
  leaderPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center", padding: 4 },
  leaderName: { fontSize: 8, textAlign: "center", fontWeight: "bold" },
  leaderPowerBadge: { position: "absolute", bottom: 2, right: 2, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 4 },
  leaderPowerText: { fontSize: 9, fontWeight: "bold" },
  leaderDonBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  leaderDonText: { color: "#fff", fontSize: 9, fontWeight: "bold" },
  attackTarget: { position: "absolute", bottom: 0, left: 0, right: 0, paddingVertical: 2, alignItems: "center" },
  attackTargetText: { color: "#fff", fontSize: 8, fontWeight: "bold" },

  cardThumb: { width: 52, height: 72, borderRadius: 5, borderWidth: 2, overflow: "hidden", position: "relative" },
  cardRested: { transform: [{ rotate: "90deg" }], opacity: 0.85 },
  cardImg: { width: "100%", height: "100%" },
  cardImgPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center", padding: 2 },
  cardImgText: { fontSize: 7, textAlign: "center" },
  donChip: { position: "absolute", top: 1, right: 1, borderRadius: 4, paddingHorizontal: 3 },
  donChipText: { fontSize: 8, color: "#fff", fontWeight: "bold" },
  counterChip: { position: "absolute", bottom: 1, right: 1, borderRadius: 3, paddingHorizontal: 2 },
  counterChipText: { fontSize: 7, color: "#fff", fontWeight: "bold" },
  rushChip: { position: "absolute", bottom: 1, left: 1, borderRadius: 3, paddingHorizontal: 2 },
  rushChipText: { fontSize: 7, color: "#fff", fontWeight: "bold" },

  pendingBanner: { borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  pendingTitle: { fontSize: 12, fontWeight: "bold" },
  pendingSub: { fontSize: 10 },
  blockerRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  blockerBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  blockerBtnText: { fontSize: 10, fontWeight: "bold" },

  log: { flex: 1, borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 8, paddingVertical: 4, maxHeight: 80 },
  logEntry: { fontSize: 10, lineHeight: 15 },

  handSection: { borderTopWidth: 1, paddingTop: 4 },
  handLabel: { fontSize: 10, paddingHorizontal: 8, marginBottom: 2 },
  handList: { paddingHorizontal: 8, gap: 6, paddingVertical: 4 },

  handCard: { width: 80, borderRadius: 8, borderWidth: 2, overflow: "hidden" },
  handCardImg: { width: "100%", height: 110 },
  handCardImgPlaceholder: { height: 110, justifyContent: "center", alignItems: "center", padding: 4 },
  handCardText: { fontSize: 9, textAlign: "center" },
  handCardMeta: { padding: 4, gap: 1 },
  handCardName: { fontSize: 9, fontWeight: "bold" },
  handCardCost: { fontSize: 9 },
  handCardStat: { fontSize: 9 },

  donPanel: { width: "100%", borderWidth: 1, borderRadius: 10, padding: 8, gap: 6 },
  donPanelTitle: { fontSize: 12, fontWeight: "bold" },
  donTargetRow: { flexDirection: "row", gap: 6 },
  donTargetBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  donTargetText: { fontSize: 11 },
  donCountRow: { flexDirection: "row", gap: 6 },
  donCountBtn: { flex: 1, paddingVertical: 6, borderRadius: 6, borderWidth: 1, alignItems: "center" },
  donCountText: { fontSize: 12, fontWeight: "bold" },

  confirmRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  confirmText: { fontSize: 13, fontWeight: "bold", flex: 1 },
  confirmBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },

  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: 1 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  actionBtnText: { fontSize: 12, fontWeight: "bold" },
  activateBtn: {
    position: "absolute",
    left: 2,
    right: 2,
    bottom: 2,
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 2,
    alignItems: "center",
  },
  activateBtnText: { fontSize: 9, fontWeight: "bold" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalSheet: { width: "100%", maxWidth: 400, borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  trashSheet: { width: "100%", maxWidth: 360, borderRadius: 16, borderWidth: 1, padding: 16 },
  modalInner: { flexDirection: "row", gap: 14 },
  modalImg: { width: 110, height: 154, borderRadius: 8 },
  modalImgPlaceholder: { width: 110, height: 154, borderRadius: 8, justifyContent: "center", alignItems: "center", padding: 8 },
  modalImgText: { fontSize: 12, textAlign: "center", fontWeight: "bold" },
  modalInfo: { flex: 1, gap: 6 },
  modalCardName: { fontSize: 16, fontWeight: "bold" },
  modalCardType: { fontSize: 12 },
  modalStats: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statBadgeText: { fontSize: 12, fontWeight: "bold" },
  modalEffect: { fontSize: 12, lineHeight: 18 },
  modalTrigger: { fontSize: 12, fontStyle: "italic", lineHeight: 18 },
  modalKeywords: { fontSize: 11 },
  modalCloseBtn: { paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  modalCloseBtnText: { fontSize: 14, fontWeight: "bold" },

  trashItem: { paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1 },
  trashItemName: { fontSize: 13, fontWeight: "500" },
  trashItemType: { fontSize: 11 },
});
