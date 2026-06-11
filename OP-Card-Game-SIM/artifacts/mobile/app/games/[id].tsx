import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetGame, getGetGameQueryKey, useDeleteGame } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import * as Haptics from "expo-haptics";
import { getApiBaseUrl } from "@/lib/url";

function apiBase(): string {
  return getApiBaseUrl();
}

export default function GameRoomScreen() {
  const { id } = useLocalSearchParams();
  const gameId = parseInt(id as string, 10);

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const [initializing, setInitializing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const deleteGameMutation = useDeleteGame();

  const { data: game, isLoading, refetch } = useGetGame(gameId, {
    query: { refetchInterval: 2000, queryKey: getGetGameQueryKey(gameId) },
  });

  if (isLoading || !game) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const isHost = game.hostId === user?.id;
  const isActive = game.status === "active";
  const isWaiting = game.status === "waiting";

  async function handleInitialize() {
    setInitializing(true);
    try {
      const res = await fetch(`${apiBase()}/api/games/${gameId}/initialize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        Alert.alert("Error", err.error ?? "Could not initialize game");
        return;
      }
      router.push(`/game-board/${gameId}`);
    } catch {
      Alert.alert("Error", "Network error initializing game");
    } finally {
      setInitializing(false);
    }
  }

  async function handleCheckStateAndEnter() {
    try {
      const res = await fetch(`${apiBase()}/api/games/${gameId}/state`);
      if (res.ok) {
        router.push(`/game-board/${gameId}`);
      } else {
        if (isHost) {
          await handleInitialize();
        } else {
          Alert.alert("Not Ready", "Waiting for the host to start the game.");
        }
      }
    } catch {
      router.push(`/game-board/${gameId}`);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Room #{game.id}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.statusBadge, { backgroundColor: isWaiting ? colors.warning + "20" : colors.success + "20" }]}>
          <Text style={[styles.statusText, { color: isWaiting ? colors.warning : colors.success }]}>
            {isWaiting ? "WAITING FOR OPPONENT" : isActive ? "GAME ACTIVE" : game.status.toUpperCase()}
          </Text>
        </View>

        <View style={styles.versusArea}>
          <View style={[styles.playerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
              <Feather name="user" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.playerName, { color: colors.foreground }]}>{game.hostUsername}</Text>
            <Text style={[styles.playerRole, { color: colors.mutedForeground }]}>Host</Text>
          </View>

          <View style={styles.vsBadge}>
            <Text style={[styles.vsText, { color: colors.primary }]}>VS</Text>
          </View>

          <View style={[styles.playerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {game.guestId ? (
              <>
                <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                  <Feather name="user" size={32} color={colors.accent} />
                </View>
                <Text style={[styles.playerName, { color: colors.foreground }]}>{game.guestUsername}</Text>
                <Text style={[styles.playerRole, { color: colors.mutedForeground }]}>Guest</Text>
              </>
            ) : (
              <>
                <View style={[styles.avatar, { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border }]}>
                  <ActivityIndicator color={colors.mutedForeground} />
                </View>
                <Text style={[styles.playerName, { color: colors.mutedForeground }]}>Waiting...</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          {isActive && (
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: colors.primary }]}
              onPress={handleCheckStateAndEnter}
              disabled={initializing}
            >
              {initializing ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.startBtnText, { color: colors.primaryForeground }]}>
                  {isHost ? "Start / Enter Match" : "Enter Match"}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {isWaiting && isHost && (
            <>
              <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>
                Share Room #{game.id} with a friend so they can join.
              </Text>
              {!confirmingClose ? (
                <TouchableOpacity
                  style={[styles.closeBtn, { borderColor: colors.destructive }]}
                  onPress={() => setConfirmingClose(true)}
                >
                  <Text style={[styles.closeBtnText, { color: colors.destructive }]}>
                    Close Room
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmText, { color: colors.mutedForeground }]}>
                    Close and delete this room?
                  </Text>
                  <View style={styles.confirmBtns}>
                    <TouchableOpacity
                      style={[styles.confirmCancelBtn, { borderColor: colors.border }]}
                      onPress={() => setConfirmingClose(false)}
                      disabled={closing}
                    >
                      <Text style={[styles.confirmCancelText, { color: colors.foreground }]}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.confirmDeleteBtn, { backgroundColor: colors.destructive }]}
                      onPress={async () => {
                        setClosing(true);
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          await deleteGameMutation.mutateAsync({ id: gameId });
                          router.replace("/(tabs)/lobby");
                        } catch (e: unknown) {
                          setConfirmingClose(false);
                          const msg = (e as { message?: string })?.message ?? "Could not close the room.";
                          Alert.alert("Error", msg);
                        } finally {
                          setClosing(false);
                        }
                      }}
                      disabled={closing}
                    >
                      {closing ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.confirmDeleteText}>Confirm Delete</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {isWaiting && !isHost && (
            <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>
              Waiting for the host to start...
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "bold", flex: 1, textAlign: "center" },
  content: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 40 },
  statusText: { fontWeight: "bold", fontSize: 14, letterSpacing: 1 },
  versusArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 60,
  },
  playerCard: { flex: 1, alignItems: "center", padding: 24, borderRadius: 16, borderWidth: 1 },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  playerName: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  playerRole: { fontSize: 14 },
  vsBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#000", borderWidth: 2, borderColor: "#333",
    justifyContent: "center", alignItems: "center",
    marginHorizontal: -24, zIndex: 10,
  },
  vsText: { fontSize: 16, fontWeight: "bold", fontStyle: "italic" },
  actions: { width: "100%", alignItems: "center", gap: 16 },
  startBtn: { width: "100%", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  startBtnText: { fontSize: 18, fontWeight: "bold" },
  waitingText: { fontSize: 16, fontStyle: "italic", textAlign: "center" },
  closeBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  closeBtnText: { fontSize: 16, fontWeight: "bold" },
  confirmRow: { width: "100%", gap: 10, alignItems: "center" },
  confirmText: { fontSize: 14, fontStyle: "italic" },
  confirmBtns: { flexDirection: "row", gap: 10, width: "100%" },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  confirmCancelText: { fontSize: 15, fontWeight: "600" },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmDeleteText: { fontSize: 15, fontWeight: "bold", color: "#fff" },
});
