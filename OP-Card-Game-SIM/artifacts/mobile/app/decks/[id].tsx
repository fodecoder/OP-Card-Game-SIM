import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetDeck, useUpdateDeck, useAddCardToDeck } from "@workspace/api-client-react";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "";
  return `${base}${url}`;
}

export default function DeckBuilderScreen() {
  const { id } = useLocalSearchParams();
  const deckId = parseInt(id as string, 10);

  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: deck, isLoading, refetch } = useGetDeck(deckId);
  const updateDeckMutation = useUpdateDeck();
  const removeCardMutation = useAddCardToDeck();

  const [name, setName] = useState("");

  useEffect(() => {
    if (deck?.name) {
      setName(deck.name);
    }
  }, [deck]);

  const handleSaveName = async () => {
    if (name === deck?.name) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateDeckMutation.mutateAsync({ id: deckId, data: { name } });
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveCard = async (cardId: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await removeCardMutation.mutateAsync({ id: deckId, data: { cardId, quantity: 0 } });
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading || !deck) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const leaderImageUrl = resolveUrl(deck.leaderImageUrl);
  const hasLeader = !!deck.leaderId;

  const getColorDot = (color: string | null | undefined) => {
    if (!color) return null;
    const colorMap: Record<string, string> = {
      Red: "#ef4444",
      Green: "#22c55e",
      Blue: "#3b82f6",
      Purple: "#a855f7",
      Black: "#6b7280",
      Yellow: "#eab308",
    };
    return colorMap[color.split("/")[0]] ?? colors.primary;
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push("/(tabs)/decks")}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <TextInput
          style={[styles.nameInput, { color: colors.foreground }]}
          value={name}
          onChangeText={setName}
          onBlur={handleSaveName}
          placeholder="Deck Name"
          placeholderTextColor={colors.mutedForeground}
        />
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={[styles.statusBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statusHeader}>
            <Text style={[styles.statusTitle, { color: colors.foreground }]}>Validation</Text>
            {deck.isValid ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.success + "20", borderColor: colors.success },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.success }]}>Valid</Text>
              </View>
            ) : (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.destructive + "20",
                    borderColor: colors.destructive,
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.destructive }]}>Incomplete</Text>
              </View>
            )}
          </View>

          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Cards</Text>
            <Text
              style={[
                styles.statValue,
                { color: deck.cardCount === 50 ? colors.success : colors.warning },
              ]}
            >
              {deck.cardCount} / 50
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Leader</Text>
            {hasLeader && (
              <TouchableOpacity
                style={styles.changeBtn}
                onPress={() =>
                  router.push(`/(tabs)/cards?deckId=${deckId}&selectLeader=true`)
                }
              >
                <Text style={[styles.changeBtnText, { color: colors.primary }]}>Change</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasLeader ? (
            <View
              style={[
                styles.leaderBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {leaderImageUrl ? (
                <Image
                  source={leaderImageUrl}
                  style={styles.leaderImage}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.leaderImagePlaceholder,
                    { backgroundColor: colors.secondary, borderRadius: 8 },
                  ]}
                />
              )}
              <View style={styles.leaderInfo}>
                <Text style={[styles.leaderName, { color: colors.foreground }]}>
                  {deck.leaderName}
                </Text>
                {deck.leaderColor && (
                  <View style={styles.leaderColorRow}>
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: getColorDot(deck.leaderColor) ?? undefined },
                      ]}
                    />
                    <Text style={[styles.leaderColor, { color: colors.mutedForeground }]}>
                      {deck.leaderColor}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.emptyLeader,
                { backgroundColor: colors.card, borderColor: colors.primary },
              ]}
              onPress={() =>
                router.push(`/(tabs)/cards?deckId=${deckId}&selectLeader=true`)
              }
            >
              <Feather
                name="plus-circle"
                size={28}
                color={colors.primary}
                style={{ marginBottom: 8 }}
              />
              <Text style={[styles.emptyLeaderText, { color: colors.primary }]}>
                Select Leader
              </Text>
              <Text style={[styles.emptyLeaderSub, { color: colors.mutedForeground }]}>
                Choose first to filter card colors
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Deck List
            </Text>
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={() => router.push(`/(tabs)/cards?deckId=${deckId}`)}
            >
              <Text style={[styles.changeBtnText, { color: colors.primary }]}>+ Add Cards</Text>
            </TouchableOpacity>
          </View>

          {deck.cards && deck.cards.length > 0 ? (
            deck.cards.map((deckCard) => (
              <View
                key={deckCard.cardId}
                style={[
                  styles.cardItem,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <TouchableOpacity
                  style={styles.infoBtn}
                  onPress={() => router.push(`/cards/${deckCard.cardId}`)}
                >
                  <Feather name="info" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
                <View style={styles.cardItemMiddle}>
                  <Text
                    style={[styles.cardItemName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {deckCard.card?.name ?? `Card #${deckCard.cardId}`}
                  </Text>
                  <View style={styles.cardItemMeta}>
                    {deckCard.card?.cost != null && (
                      <Text style={[styles.cardMetaTag, { color: colors.mutedForeground }]}>
                        Cost {deckCard.card.cost}
                      </Text>
                    )}
                    {deckCard.card?.counter != null && (
                      <Text style={[styles.cardMetaTag, { color: colors.accent }]}>
                        CTR +{deckCard.card.counter}
                      </Text>
                    )}
                    {deckCard.card?.power != null && (
                      <Text style={[styles.cardMetaTag, { color: colors.mutedForeground }]}>
                        {deckCard.card.power.toLocaleString()}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.cardItemRight}>
                  <View style={[styles.quantityBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.quantityText, { color: colors.foreground }]}>
                      x{deckCard.quantity}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveCard(deckCard.cardId)}
                  >
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <TouchableOpacity
              style={[
                styles.emptyState,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => router.push(`/(tabs)/cards?deckId=${deckId}`)}
            >
              <Feather
                name="plus"
                size={32}
                color={colors.primary}
                style={{ marginBottom: 12 }}
              />
              <Text style={[styles.emptyStateText, { color: colors.primary }]}>Add cards</Text>
              <Text style={[styles.emptyStateSub, { color: colors.mutedForeground }]}>
                Tap a card to add it to the deck
              </Text>
            </TouchableOpacity>
          )}
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
  nameInput: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
    paddingVertical: 8,
  },
  scrollContent: { padding: 16, gap: 24 },
  statusBox: { padding: 16, borderRadius: 12, borderWidth: 1 },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statusTitle: { fontSize: 18, fontWeight: "bold" },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: "bold" },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: { fontSize: 16 },
  statValue: { fontSize: 16, fontWeight: "bold" },
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold" },
  changeBtn: { padding: 4 },
  changeBtnText: { fontSize: 14, fontWeight: "bold" },
  leaderBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  leaderImage: {
    width: 72,
    height: 100,
    borderRadius: 8,
  },
  leaderImagePlaceholder: {
    width: 72,
    height: 100,
  },
  leaderInfo: { flex: 1, gap: 6 },
  leaderName: { fontSize: 17, fontWeight: "bold" },
  leaderColorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  leaderColor: { fontSize: 14 },
  emptyLeader: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  emptyLeaderText: { fontSize: 16, fontWeight: "bold" },
  emptyLeaderSub: { fontSize: 13, textAlign: "center" },
  cardItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  infoBtn: { padding: 4 },
  cardItemMiddle: { flex: 1, gap: 2 },
  cardItemName: { fontSize: 14, fontWeight: "500" },
  cardItemMeta: { flexDirection: "row", gap: 8 },
  cardMetaTag: { fontSize: 11 },
  cardItemRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  quantityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  quantityText: { fontSize: 14, fontWeight: "bold" },
  removeBtn: { padding: 4 },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: { fontSize: 16, fontWeight: "bold" },
  emptyStateSub: { fontSize: 13, marginTop: 4, textAlign: "center" },
});
