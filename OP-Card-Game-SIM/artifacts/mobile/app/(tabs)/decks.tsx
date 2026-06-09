import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useListDecks, useCreateDeck, useClaimStarterDecks } from "@workspace/api-client-react";
import { DeckItem } from "@/components/DeckItem";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

export default function DecksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const { data: decks, isLoading, refetch, isRefetching } = useListDecks();
  const createDeckMutation = useCreateDeck();
  const claimStartersMutation = useClaimStarterDecks();

  const handleClaimStarters = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await claimStartersMutation.mutateAsync(undefined as any);
      refetch();
    } catch (e) {
      console.error(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleCreateDeck = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newDeck = await createDeckMutation.mutateAsync({
        data: { name: "New Deck" }
      });
      router.push(`/decks/${newDeck.id}`);
    } catch (e) {
      console.error(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.foreground }]}>My Decks</Text>
      <TouchableOpacity 
        style={[styles.createBtn, { backgroundColor: colors.primary }]}
        onPress={handleCreateDeck}
        disabled={createDeckMutation.isPending}
      >
        {createDeckMutation.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} size="small" />
        ) : (
          <>
            <Feather name="plus" size={20} color={colors.primaryForeground} />
            <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>New Deck</Text>
          </>
        )}
      </TouchableOpacity>
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
          data={decks || []}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <DeckItem deck={item} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="layers" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No decks yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Get starter decks to begin playing right away, or build your own.
              </Text>
              <TouchableOpacity
                style={[styles.emptyCreateBtn, { backgroundColor: colors.primary }]}
                onPress={handleClaimStarters}
                disabled={claimStartersMutation.isPending}
              >
                {claimStartersMutation.isPending ? (
                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                ) : (
                  <Text style={[styles.emptyCreateBtnText, { color: colors.primaryForeground }]}>
                    Get Starter Decks
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptySecondaryBtn, { borderColor: colors.border }]}
                onPress={handleCreateDeck}
                disabled={createDeckMutation.isPending}
              >
                <Text style={[styles.emptySecondaryBtnText, { color: colors.foreground }]}>
                  Create Empty Deck
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
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
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  createBtnText: {
    fontWeight: "bold",
  },
  loadingList: {
    padding: 16,
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: "center",
  },
  emptyCreateBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyCreateBtnText: {
    fontWeight: "bold",
    fontSize: 16,
  },
  emptySecondaryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  emptySecondaryBtnText: {
    fontWeight: "600",
    fontSize: 15,
  },
});
