import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useListGames,
  useCreateGame,
  useJoinGame,
  useListDecks,
  Deck,
} from "@workspace/api-client-react";
import { GameRoomItem } from "@/components/GameRoomItem";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState, useCallback, useRef } from "react";

type PickerMode = "create" | "join" | "local-host" | "local-guest";

export default function LobbyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: games, isLoading, refetch, isRefetching } = useListGames();
  const { data: decks, isLoading: decksLoading } = useListDecks();
  const createGameMutation = useCreateGame();
  const joinGameMutation = useJoinGame();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTitle, setPickerTitle] = useState("Pick Your Deck");
  const [pickerMode, setPickerMode] = useState<PickerMode>("create");
  const [pendingGameId, setPendingGameId] = useState<number | null>(null);
  const [localHostDeckId, setLocalHostDeckId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [ruleset, setRuleset] = useState<"standard" | "extra">("standard");

  const openPicker = (mode: PickerMode, title: string, gameId?: number) => {
    setPickerMode(mode);
    setPickerTitle(title);
    if (gameId !== undefined) setPendingGameId(gameId);
    setPickerVisible(true);
  };

  const handleDeckSelected = useCallback(
    async (deckId: number) => {
      setPickerVisible(false);

      if (pickerMode === "create") {
        setBusy(true);
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const newGame = await createGameMutation.mutateAsync({
            data: { deckId, isPrivate: false, ruleset },
          });
          router.push(`/games/${newGame.id}`);
        } catch (e) {
          const msg = (e as { message?: string })?.message ?? "This deck is not legal for the selected ruleset.";
          Alert.alert("Invalid deck", msg);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
          setBusy(false);
        }
      } else if (pickerMode === "join" && pendingGameId !== null) {
        setBusy(true);
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await joinGameMutation.mutateAsync({
            id: pendingGameId,
            data: { deckId },
          });
          router.push(`/games/${pendingGameId}`);
        } catch (e) {
          const msg = (e as { message?: string })?.message ?? "This deck cannot join this room.";
          Alert.alert("Invalid deck", msg);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
          setBusy(false);
          setPendingGameId(null);
        }
      } else if (pickerMode === "local-host") {
        setLocalHostDeckId(deckId);
        setTimeout(() => {
          openPicker("local-guest", "Opponent Deck (Player 2)");
        }, 100);
      } else if (pickerMode === "local-guest" && localHostDeckId !== null) {
        setBusy(true);
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const newGame = await createGameMutation.mutateAsync({
            data: {
              deckId: localHostDeckId,
              isLocal: true,
              guestDeckId: deckId,
              isPrivate: false,
            },
          });
          setLocalHostDeckId(null);
          router.push(`/game-board/${newGame.id}`);
        } catch (e: unknown) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          const msg = (e as { message?: string })?.message ?? "Could not start the game.";
          Alert.alert("Error", msg);
        } finally {
          setBusy(false);
        }
      }
    },
    [pickerMode, pendingGameId, localHostDeckId, createGameMutation, joinGameMutation, ruleset]
  );

  const waitingGames = games?.filter((g) => g.status === "waiting") || [];
  const hasDecks = (decks?.length ?? 0) > 0;

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.foreground }]}>Game Lobby</Text>
      <View style={styles.headerBtns}>
        <View style={[styles.rulesetSwitch, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {(["standard", "extra"] as const).map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.rulesetOption,
                value === ruleset && { backgroundColor: colors.primary },
              ]}
              onPress={() => setRuleset(value)}
            >
              <Text style={{
                color: value === ruleset ? colors.primaryForeground : colors.mutedForeground,
                fontSize: 11,
                fontWeight: "bold",
              }}>
                {value.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.localBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={() => {
            if (!hasDecks) {
              router.push("/(tabs)/decks");
              return;
            }
            openPicker("local-host", "Your Deck (Player 1)");
          }}
          disabled={busy}
        >
          <Feather name="monitor" size={18} color={colors.foreground} />
          <Text style={[styles.localBtnText, { color: colors.foreground }]}>Local</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (!hasDecks) {
              router.push("/(tabs)/decks");
              return;
            }
            openPicker("create", "Pick Your Deck");
          }}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <>
              <Feather name="plus" size={20} color={colors.primaryForeground} />
              <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>Room</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {renderHeader()}

      {isLoading ? (
        <View style={styles.loadingList}>
          {Array(4).fill(0).map((_, i) => (
            <SkeletonLoader key={i} height={100} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={waitingGames}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <GameRoomItem
              game={item}
              onJoin={() => {
                if (!hasDecks) {
                  router.push("/(tabs)/decks");
                  return;
                }
                openPicker("join", "Pick Your Deck", item.id);
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="search" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No open rooms</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Create a room or start a local game to battle.
              </Text>
            </View>
          }
        />
      )}

      <DeckPickerModal
        visible={pickerVisible}
        title={pickerTitle}
        decks={decks || []}
        loading={decksLoading}
        onSelect={handleDeckSelected}
        onClose={() => setPickerVisible(false)}
        colors={colors}
        insets={insets}
      />
    </View>
  );
}

interface DeckPickerModalProps {
  visible: boolean;
  title: string;
  decks: Deck[];
  loading: boolean;
  onSelect: (deckId: number) => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  insets: { bottom: number; top: number };
}

function DeckPickerModal({
  visible,
  title,
  decks,
  loading,
  onSelect,
  onClose,
  colors,
  insets,
}: DeckPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          onPress={() => {}}
        >
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : decks.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Feather name="layers" size={40} color={colors.mutedForeground} />
              <Text style={[styles.modalEmptyText, { color: colors.mutedForeground }]}>
                No decks found. Create one first.
              </Text>
            </View>
          ) : (
            <FlatList
              data={decks}
              keyExtractor={(item) => item.id.toString()}
              style={styles.deckList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.deckOption,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => onSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.deckOptionInfo}>
                    <Text
                      style={[styles.deckOptionName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={[styles.deckOptionMeta, { color: colors.mutedForeground }]}>
                      {item.leaderName ?? "No Leader"} · {item.cardCount} cards
                      {item.isValid ? "" : " · Incomplete"}
                    </Text>
                    {!item.isValid && item.validationErrors?.[0] && (
                      <Text
                        style={[styles.deckError, { color: colors.destructive }]}
                        numberOfLines={2}
                      >
                        {item.validationErrors[0]}
                      </Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            />
          )}

          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  title: { fontSize: 28, fontWeight: "bold" },
  headerBtns: { flexDirection: "row", gap: 8 },
  rulesetSwitch: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 8,
    padding: 2,
    alignItems: "center",
  },
  rulesetOption: { paddingHorizontal: 7, paddingVertical: 7, borderRadius: 6 },
  localBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  localBtnText: { fontWeight: "bold", fontSize: 14 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  createBtnText: { fontWeight: "bold" },
  loadingList: { padding: 16 },
  listContent: { padding: 16 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 100 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: "70%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
  modalEmpty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  modalEmptyText: { fontSize: 14, textAlign: "center" },
  deckList: { maxHeight: 400 },
  deckOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  deckOptionInfo: { flex: 1 },
  deckOptionName: { fontSize: 16, fontWeight: "bold", marginBottom: 2 },
  deckOptionMeta: { fontSize: 13 },
  deckError: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 16, fontWeight: "600" },
});
