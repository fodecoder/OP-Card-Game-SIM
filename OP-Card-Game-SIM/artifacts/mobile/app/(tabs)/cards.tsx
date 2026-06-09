import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useState, useCallback, useMemo } from "react";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useListCards,
  useAddCardToDeck,
  useGetDeck,
  useUpdateDeck,
  useAddToCollection,
  useRemoveFromCollection,
  useGetCollection,
  getGetDeckQueryKey,
} from "@workspace/api-client-react";
import { CardItem } from "@/components/CardItem";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

const COLORS = ["Red", "Green", "Blue", "Purple", "Black", "Yellow"];

export default function CardsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { deckId: deckIdParam, selectLeader } = useLocalSearchParams<{
    deckId?: string;
    selectLeader?: string;
  }>();
  const deckId = deckIdParam ? parseInt(deckIdParam, 10) : undefined;
  const isLeaderPicker = selectLeader === "true";
  const isDeckMode = deckId !== undefined;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | undefined>();
  const [addingCardId, setAddingCardId] = useState<number | null>(null);
  const [removingCardId, setRemovingCardId] = useState<number | null>(null);

  const { data, isLoading } = useListCards({
    search: debouncedSearch || undefined,
    color: selectedColor,
    type: isLeaderPicker ? "Leader" : undefined,
    limit: 50,
  });

  const { data: deck, refetch: refetchDeck } = useGetDeck(deckId ?? 0, {
    query: {
      enabled: isDeckMode && !isLeaderPicker,
      queryKey: getGetDeckQueryKey(deckId ?? 0),
    },
  });

  const { data: collection, refetch: refetchCollection } = useGetCollection();

  const addCardToDeckMutation = useAddCardToDeck();
  const updateDeckMutation = useUpdateDeck();
  const addToCollectionMutation = useAddToCollection();
  const removeFromCollectionMutation = useRemoveFromCollection();

  const deckCardMap = useMemo(
    () => new Map<number, number>(deck?.cards?.map((c) => [c.cardId, c.quantity]) ?? []),
    [deck?.cards]
  );

  const collectionMap = useMemo(
    () => new Map<number, number>(collection?.cards?.map((c) => [c.cardId, c.quantity]) ?? []),
    [collection?.cards]
  );

  const handleSearch = () => setDebouncedSearch(search);
  const clearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
  };

  const handleGoBack = () => {
    if (isDeckMode) {
      router.push(`/decks/${deckId}`);
    } else {
      router.back();
    }
  };

  const handleCardPress = useCallback(
    async (cardId: number) => {
      if (isLeaderPicker && deckId !== undefined) {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await updateDeckMutation.mutateAsync({ id: deckId, data: { leaderId: cardId } });
          router.push(`/decks/${deckId}`);
        } catch (e) {
          console.error(e);
        }
        return;
      }

      if (isDeckMode && deckId !== undefined) {
        const currentQty = deckCardMap.get(cardId) ?? 0;
        if (currentQty >= 4) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }
        try {
          setAddingCardId(cardId);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await addCardToDeckMutation.mutateAsync({
            id: deckId,
            data: { cardId, quantity: currentQty + 1 },
          });
          refetchDeck();
        } catch (e) {
          console.error(e);
        } finally {
          setAddingCardId(null);
        }
        return;
      }

      router.push(`/cards/${cardId}`);
    },
    [
      isLeaderPicker,
      isDeckMode,
      deckId,
      deckCardMap,
      updateDeckMutation,
      addCardToDeckMutation,
      refetchDeck,
    ]
  );

  const handleRemoveFromDeck = useCallback(
    async (cardId: number) => {
      if (deckId === undefined) return;
      const currentQty = deckCardMap.get(cardId) ?? 0;
      if (currentQty === 0) return;
      try {
        setRemovingCardId(cardId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await addCardToDeckMutation.mutateAsync({
          id: deckId,
          data: { cardId, quantity: currentQty - 1 },
        });
        refetchDeck();
      } catch (e) {
        console.error(e);
      } finally {
        setRemovingCardId(null);
      }
    },
    [deckId, deckCardMap, addCardToDeckMutation, refetchDeck]
  );

  const handleAddToCollection = useCallback(
    async (cardId: number) => {
      const currentQty = collectionMap.get(cardId) ?? 0;
      if (currentQty >= 4) return;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await addToCollectionMutation.mutateAsync({
          data: { cardId, quantity: currentQty + 1 },
        });
        refetchCollection();
      } catch (e) {
        console.error(e);
      }
    },
    [collectionMap, addToCollectionMutation, refetchCollection]
  );

  const handleRemoveFromCollection = useCallback(
    async (cardId: number) => {
      const currentQty = collectionMap.get(cardId) ?? 0;
      if (currentQty === 0) return;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (currentQty <= 1) {
          await removeFromCollectionMutation.mutateAsync({ cardId });
        } else {
          await addToCollectionMutation.mutateAsync({
            data: { cardId, quantity: currentQty - 1 },
          });
        }
        refetchCollection();
      } catch (e) {
        console.error(e);
      }
    },
    [collectionMap, removeFromCollectionMutation, addToCollectionMutation, refetchCollection]
  );

  const renderHeader = () => (
    <View style={styles.header}>
      {isDeckMode ? (
        <View style={styles.deckBanner}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
            <Feather name="arrow-left" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
          <Text style={[styles.deckBannerText, { color: colors.primaryForeground }]}>
            {isLeaderPicker ? "Scegli il Leader" : "Aggiungi carte al deck"}
          </Text>
          {!isLeaderPicker && (
            <View style={[styles.deckCountBadge, { backgroundColor: colors.primaryForeground + "30" }]}>
              <Text style={[styles.deckCountText, { color: colors.primaryForeground }]}>
                {deck?.cardCount ?? 0} / 50
              </Text>
            </View>
          )}
        </View>
      ) : (
        <Text style={[styles.title, { color: colors.foreground }]}>Card Browser</Text>
      )}

      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={20} color={colors.mutedForeground} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search cards..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      {!isLeaderPicker && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={COLORS}
          style={styles.filterList}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedColor === item ? colors.primary : colors.card,
                  borderColor: selectedColor === item ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedColor(selectedColor === item ? undefined : item)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: selectedColor === item ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item}
        />
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {renderHeader()}

      {isLoading ? (
        <View style={styles.loadingGrid}>
          {Array(6).fill(0).map((_, i) => (
            <View key={i} style={styles.loadingCard}>
              <SkeletonLoader height={200} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={data?.cards || []}
          keyExtractor={(item) => item.id.toString()}
          numColumns={3}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item }) => {
            const deckQty = deckCardMap.get(item.id) ?? 0;
            const collQty = collectionMap.get(item.id) ?? 0;
            const isAdding = addingCardId === item.id;
            const isRemoving = removingCardId === item.id;

            return (
              <View style={[styles.cardWrapper, { opacity: isAdding || isRemoving ? 0.6 : 1 }]}>
                <CardItem
                  card={item}
                  onPress={() => handleCardPress(item.id)}
                />

                {isDeckMode && deckQty > 0 && (
                  <View style={[styles.qtyBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.qtyText, { color: colors.primaryForeground }]}>
                      x{deckQty}
                    </Text>
                  </View>
                )}

                {isDeckMode && deckQty > 0 && (
                  <TouchableOpacity
                    style={[styles.removeBtn, { backgroundColor: colors.destructive }]}
                    onPress={() => handleRemoveFromDeck(item.id)}
                  >
                    <Feather name="minus" size={10} color="#fff" />
                  </TouchableOpacity>
                )}

                {!isDeckMode && (
                  <TouchableOpacity
                    style={[
                      styles.collectionBtn,
                      {
                        backgroundColor: collQty > 0 ? colors.primary : colors.card,
                        borderColor: collQty > 0 ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => handleAddToCollection(item.id)}
                  >
                    {collQty > 0 ? (
                      <Text style={[styles.collectionBtnText, { color: colors.primaryForeground }]}>
                        {collQty}
                      </Text>
                    ) : (
                      <Feather name="plus" size={12} color={colors.mutedForeground} />
                    )}
                  </TouchableOpacity>
                )}

                {!isDeckMode && collQty > 0 && (
                  <TouchableOpacity
                    style={[styles.removeBtn, { backgroundColor: colors.destructive }]}
                    onPress={() => handleRemoveFromCollection(item.id)}
                  >
                    <Feather name="minus" size={10} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No cards found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Try adjusting your search or filters.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, gap: 16 },
  title: { fontSize: 28, fontWeight: "bold" },
  deckBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#c9a84c",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backBtn: { padding: 2 },
  deckBannerText: { fontSize: 15, fontWeight: "700", flex: 1 },
  deckCountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  deckCountText: { fontSize: 12, fontWeight: "bold" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: "100%", fontSize: 16 },
  clearBtn: { padding: 4 },
  filterList: { flexGrow: 0 },
  filterContent: { gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 14, fontWeight: "500" },
  loadingGrid: { flexDirection: "row", flexWrap: "wrap", padding: 16, gap: 12 },
  loadingCard: { width: "31%" },
  listContent: { padding: 16, gap: 16 },
  columnWrapper: { justifyContent: "space-between" },
  cardWrapper: { width: "31%", position: "relative" },
  qtyBadge: {
    position: "absolute",
    bottom: 22,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: "#000",
  },
  qtyText: { fontSize: 11, fontWeight: "bold" },
  removeBtn: {
    position: "absolute",
    bottom: 22,
    left: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#000",
  },
  collectionBtn: {
    position: "absolute",
    bottom: 22,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  collectionBtnText: { fontSize: 11, fontWeight: "bold" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 100 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14 },
});
