import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { StatCard } from "@/components/StatCard";
import { GameRoomItem } from "@/components/GameRoomItem";
import { useGetUserStats, useListGames } from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SkeletonLoader } from "@/components/SkeletonLoader";

export default function DashboardScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetUserStats();
  const { data: games, isLoading: gamesLoading, refetch: refetchGames } = useListGames();
  
  const refreshing = statsLoading || gamesLoading;
  
  const onRefresh = () => {
    refetchStats();
    refetchGames();
  };

  const recentGames = games?.filter(g => g.status === "finished").slice(0, 3) || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Welcome back,</Text>
          <Text style={[styles.username, { color: colors.foreground }]}>{user?.username}</Text>
        </View>
        <TouchableOpacity style={[styles.profileBtn, { backgroundColor: colors.card }]}>
          <Feather name="user" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.statsGrid}>
          {statsLoading ? (
            <>
              <SkeletonLoader height={80} style={styles.statFlex} />
              <SkeletonLoader height={80} style={styles.statFlex} />
              <SkeletonLoader height={80} style={styles.statFlex} />
            </>
          ) : (
            <>
              <StatCard title="Win Rate" value={`${Math.round((stats?.winRate || 0) * 100)}%`} icon="percent" style={styles.statFlex} color={colors.primary} />
              <StatCard title="Wins" value={stats?.wins || 0} icon="award" style={styles.statFlex} color={colors.success} />
              <StatCard title="Losses" value={stats?.losses || 0} icon="x-circle" style={styles.statFlex} color={colors.destructive} />
            </>
          )}
        </View>

        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.playBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/lobby")}
            activeOpacity={0.8}
          >
            <Feather name="play" size={24} color={colors.primaryForeground} />
            <Text style={[styles.playBtnText, { color: colors.primaryForeground }]}>Find a Match</Text>
          </TouchableOpacity>
          
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={[styles.secBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/decks")}
              activeOpacity={0.8}
            >
              <Feather name="layers" size={20} color={colors.foreground} />
              <Text style={[styles.secBtnText, { color: colors.foreground }]}>My Decks</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/collection")}
              activeOpacity={0.8}
            >
              <Feather name="grid" size={20} color={colors.foreground} />
              <Text style={[styles.secBtnText, { color: colors.foreground }]}>Collection</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Matches</Text>
          {gamesLoading ? (
            <SkeletonLoader height={100} />
          ) : recentGames.length > 0 ? (
            recentGames.map(game => (
              <GameRoomItem key={game.id} game={game} />
            ))
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="activity" size={32} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyText, { color: colors.foreground }]}>No recent matches</Text>
              <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>Play some games to see your history.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: {
    fontSize: 14,
  },
  username: {
    fontSize: 24,
    fontWeight: "bold",
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100, // For tab bar
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statFlex: {
    flex: 1,
  },
  actionSection: {
    gap: 12,
    marginBottom: 32,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  playBtnText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  secondaryActions: {
    flexDirection: "row",
    gap: 12,
  },
  secBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  secBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 14,
  },
});
