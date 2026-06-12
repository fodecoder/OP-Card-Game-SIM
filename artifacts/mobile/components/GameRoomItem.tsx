import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Game } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";

interface GameRoomItemProps {
  game: Game;
  onJoin?: () => void;
  style?: any;
}

export function GameRoomItem({ game, onJoin, style }: GameRoomItemProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <View style={styles.header}>
        <View style={styles.hostInfo}>
          <Feather name="user" size={16} color={colors.primary} />
          <Text style={[styles.hostName, { color: colors.foreground }]}>{game.hostUsername}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: game.status === "waiting" ? colors.success + "20" : colors.muted }]}>
          <Text style={[styles.statusText, { color: game.status === "waiting" ? colors.success : colors.mutedForeground }]}>
            {game.status.toUpperCase()}
          </Text>
        </View>
      </View>
      
      {game.isPrivate && (
        <View style={styles.privateTag}>
          <Feather name="lock" size={12} color={colors.warning} />
          <Text style={[styles.privateText, { color: colors.warning }]}>Private</Text>
        </View>
      )}

      {onJoin && game.status === "waiting" && (
        <TouchableOpacity 
          style={[styles.joinBtn, { backgroundColor: colors.primary }]} 
          onPress={onJoin}
        >
          <Text style={[styles.joinBtnText, { color: colors.primaryForeground }]}>Join Game</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  hostInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hostName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  privateTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  privateText: {
    fontSize: 12,
    fontWeight: "500",
  },
  joinBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  joinBtnText: {
    fontWeight: "bold",
    fontSize: 14,
  },
});
