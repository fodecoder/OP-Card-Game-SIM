import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetCard,
  useAddToCollection,
  useRemoveFromCollection,
  useGetCollection,
  useAddCardToDeck,
  useRemoveCardFromDeck,
  useGetDeck,
  getGetDeckQueryKey,
} from "@workspace/api-client-react";
import { CardImage } from "@/components/CardImage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export default function CardDetailScreen() {
  const { id, deckId: deckIdParam } = useLocalSearchParams<{ id: string; deckId?: string }>();
  const cardId = parseInt(id as string, 10);
  const deckId = deckIdParam ? parseInt(deckIdParam, 10) : undefined;

  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: card, isLoading } = useGetCard(cardId);
  const { data: collection, refetch: refetchCollection } = useGetCollection();
  const { data: deck, refetch: refetchDeck } = useGetDeck(deckId ?? 0, {
    query: { enabled: deckId !== undefined, queryKey: getGetDeckQueryKey(deckId ?? 0) },
  });

  const addToCollectionMutation = useAddToCollection();
  const removeFromCollectionMutation = useRemoveFromCollection();
  const addToDeckMutation = useAddCardToDeck();
  const removeFromDeckMutation = useRemoveCardFromDeck();

  // Collection quantity
  const collectionItem = collection?.cards?.find((c) => c.cardId === cardId);
  const collectionQty = collectionItem?.quantity || 0;

  // Deck quantity
  const deckCard = deck?.cards?.find((c) => c.cardId === cardId);
  const deckQty = deckCard?.quantity || 0;

  const handleAddToCollection = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await addToCollectionMutation.mutateAsync({ data: { cardId, quantity: collectionQty + 1 } });
      refetchCollection();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFromCollection = async () => {
    if (collectionQty === 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (collectionQty <= 1) {
        await removeFromCollectionMutation.mutateAsync({ cardId });
      } else {
        await addToCollectionMutation.mutateAsync({ data: { cardId, quantity: collectionQty - 1 } });
      }
      refetchCollection();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddToDeck = async () => {
    if (!deckId) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await addToDeckMutation.mutateAsync({ id: deckId, data: { cardId, quantity: deckQty + 1 } });
      refetchDeck();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFromDeck = async () => {
    if (!deckId || deckQty === 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (deckQty <= 1) {
        await removeFromDeckMutation.mutateAsync({ id: deckId, cardId });
      } else {
        await addToDeckMutation.mutateAsync({ id: deckId, data: { cardId, quantity: deckQty - 1 } });
      }
      refetchDeck();
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading || !card) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const getGlowColor = () => {
    const colorMap: Record<string, string> = {
      Red: colors.cardGlow.red,
      Green: colors.cardGlow.green,
      Blue: colors.cardGlow.blue,
      Purple: colors.cardGlow.purple,
      Black: colors.cardGlow.black,
      Yellow: colors.cardGlow.yellow,
    };
    const primaryColor = card.color?.split("/")[0] || "";
    return colorMap[primaryColor] || colors.muted;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {card.name}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
        {/* Card image */}
        <View style={styles.imageSection}>
          <View style={[styles.imageGlow, { backgroundColor: getGlowColor() }]} />
          <View style={styles.imageWrapper}>
            <CardImage card={card} />
          </View>
        </View>

        {/* Deck controls — only when coming from deck builder */}
        {deckId !== undefined && (
          <View style={[styles.actionSection, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <View style={styles.actionLabelRow}>
              <Feather name="layers" size={16} color={colors.primary} />
              <Text style={[styles.actionLabel, { color: colors.primary }]}>In questo Deck</Text>
            </View>
            <View style={styles.controls}>
              <TouchableOpacity
                style={[styles.ctrlBtn, { borderColor: colors.border }]}
                onPress={handleRemoveFromDeck}
                disabled={deckQty === 0 || removeFromDeckMutation.isPending || addToDeckMutation.isPending}
              >
                <Feather name="minus" size={20} color={deckQty === 0 ? colors.mutedForeground : colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.qtyText, { color: colors.foreground }]}>{deckQty}</Text>
              <TouchableOpacity
                style={[styles.ctrlBtn, { borderColor: colors.border }]}
                onPress={handleAddToDeck}
                disabled={addToDeckMutation.isPending || deckQty >= 4}
              >
                <Feather name="plus" size={20} color={deckQty >= 4 ? colors.mutedForeground : colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Collection controls — always visible */}
        <View style={[styles.actionSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.actionLabelRow}>
            <Feather name="archive" size={16} color={colors.mutedForeground} />
            <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>Nella Collezione</Text>
          </View>
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.ctrlBtn, { borderColor: colors.border }]}
              onPress={handleRemoveFromCollection}
              disabled={collectionQty === 0 || removeFromCollectionMutation.isPending}
            >
              <Feather name="minus" size={20} color={collectionQty === 0 ? colors.mutedForeground : colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.qtyText, { color: colors.foreground }]}>{collectionQty}</Text>
            <TouchableOpacity
              style={[styles.ctrlBtn, { borderColor: colors.border }]}
              onPress={handleAddToCollection}
              disabled={addToCollectionMutation.isPending || collectionQty >= 4}
            >
              <Feather name="plus" size={20} color={collectionQty >= 4 ? colors.mutedForeground : colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Card details */}
        <View style={styles.detailsSection}>
          <Text style={[styles.cardName, { color: colors.foreground }]}>{card.name}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{card.cardNumber}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{card.cardType}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.badgeText, { color: getGlowColor() }]}>{card.color}</Text>
            </View>
          </View>

          <View style={[styles.statsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statRow}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Cost</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{card.cost ?? "-"}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statRow}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Power</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{card.power ?? "-"}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statRow}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Counter</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{card.counter ?? "-"}</Text>
            </View>
          </View>

          {card.effectText && (
            <View style={styles.infoBlock}>
              <Text style={[styles.infoLabel, { color: colors.primary }]}>Effect</Text>
              <Text style={[styles.infoText, { color: colors.foreground }]}>{card.effectText}</Text>
            </View>
          )}

          {card.triggerEffect && (
            <View style={styles.infoBlock}>
              <Text style={[styles.infoLabel, { color: colors.warning }]}>Trigger</Text>
              <Text style={[styles.infoText, { color: colors.foreground }]}>{card.triggerEffect}</Text>
            </View>
          )}

          <View style={styles.infoBlock}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Types</Text>
            <Text style={[styles.infoText, { color: colors.foreground }]}>{card.cardTypes || "-"}</Text>
          </View>
        </View>
      </ScrollView>
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
  scrollContent: { padding: 24, gap: 20 },
  imageSection: {
    alignItems: "center",
    position: "relative",
    marginBottom: 8,
  },
  imageGlow: {
    position: "absolute",
    width: "70%",
    height: "80%",
    top: "10%",
    borderRadius: 20,
    opacity: 0.25,
  },
  imageWrapper: { width: "80%", aspectRatio: 2.5 / 3.5 },
  actionSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionLabel: { fontSize: 15, fontWeight: "600" },
  controls: { flexDirection: "row", alignItems: "center", gap: 4 },
  ctrlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: { fontSize: 18, fontWeight: "bold", width: 36, textAlign: "center" },
  detailsSection: { gap: 20 },
  cardName: { fontSize: 26, fontWeight: "bold" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: "bold" },
  statsBox: { flexDirection: "row", borderWidth: 1, borderRadius: 12, padding: 16 },
  statRow: { flex: 1, alignItems: "center" },
  statLabel: { fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "bold" },
  divider: { width: 1, height: "100%" },
  infoBlock: { gap: 8 },
  infoLabel: { fontSize: 14, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1 },
  infoText: { fontSize: 16, lineHeight: 24 },
});
