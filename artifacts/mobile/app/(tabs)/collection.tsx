import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from "react-native";
import { useState } from "react";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetCollection } from "@workspace/api-client-react";
import { CardImage } from "@/components/CardImage";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";

export default function CollectionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const { data, isLoading } = useGetCollection({
    search: debouncedSearch || undefined,
    limit: 50
  });

  const handleSearch = () => {
    setDebouncedSearch(search);
  };

  const clearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.foreground }]}>My Collection</Text>
      
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={20} color={colors.mutedForeground} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search collection..."
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
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {renderHeader()}
      
      {isLoading ? (
        <View style={styles.loadingGrid}>
          {Array(6).fill(0).map((_, i) => (
            <View key={i} style={styles.cardWrapper}>
              <SkeletonLoader height={140} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={data?.cards || []}
          keyExtractor={(item) => item.cardId.toString()}
          numColumns={4}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.cardWrapper}
              onPress={() => router.push(`/cards/${item.cardId}`)}
            >
              <CardImage card={item.card} />
              <View style={[styles.quantityBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.quantityText, { color: colors.primaryForeground }]}>x{item.quantity}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No cards found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Add cards to your collection from the Card Browser.
              </Text>
              <TouchableOpacity
                style={[styles.browseBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push("/(tabs)/cards")}
              >
                <Text style={[styles.browseBtnText, { color: colors.foreground }]}>Browse Cards</Text>
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
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 16,
  },
  clearBtn: {
    padding: 4,
  },
  loadingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  cardWrapper: {
    width: "23%",
    aspectRatio: 2.5 / 3.5,
    marginBottom: 16,
    position: "relative",
  },
  quantityBadge: {
    position: "absolute",
    bottom: -6,
    right: -6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: "#000",
  },
  quantityText: {
    fontSize: 12,
    fontWeight: "bold",
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
  browseBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  browseBtnText: {
    fontWeight: "bold",
    fontSize: 16,
  },
});
