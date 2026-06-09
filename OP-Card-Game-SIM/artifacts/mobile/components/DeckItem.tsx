import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Deck } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

interface DeckItemProps {
  deck: Deck;
  onPress?: () => void;
  style?: any;
}

export function DeckItem({ deck, onPress, style }: DeckItemProps) {
  const colors = useColors();

  const getFallbackColor = () => {
    if (!deck.leaderColor) return colors.muted;
    const colorMap: Record<string, string> = {
      Red: colors.cardGlow.red,
      Green: colors.cardGlow.green,
      Blue: colors.cardGlow.blue,
      Purple: colors.cardGlow.purple,
      Black: colors.cardGlow.black,
      Yellow: colors.cardGlow.yellow,
    };
    const primaryColor = deck.leaderColor.split("/")[0] || "";
    return colorMap[primaryColor] || colors.muted;
  };

  const Content = () => (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <View style={[styles.imageContainer, { backgroundColor: getFallbackColor() }]}>
        {deck.leaderImageUrl && (
          <Image source={deck.leaderImageUrl} style={styles.image} contentFit="cover" />
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {deck.name}
        </Text>
        <Text style={[styles.leaderName, { color: colors.mutedForeground }]} numberOfLines={1}>
          {deck.leaderName || "No Leader"}
        </Text>
        
        <View style={styles.footer}>
          <Text style={[styles.count, { color: colors.secondaryForeground }]}>
            {deck.cardCount} Cards
          </Text>
          {deck.isValid ? (
            <View style={[styles.badge, { backgroundColor: colors.success + "20", borderColor: colors.success }]}>
              <Text style={[styles.badgeText, { color: colors.success }]}>Valid</Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: colors.destructive + "20", borderColor: colors.destructive }]}>
              <Text style={[styles.badgeText, { color: colors.destructive }]}>Invalid</Text>
            </View>
          )}
        </View>
      </View>
      
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <Content />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/decks/${deck.id}`)}>
      <Content />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  imageContainer: {
    width: 60,
    height: 84,
    borderRadius: 6,
    overflow: "hidden",
    marginRight: 16,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  leaderName: {
    fontSize: 14,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  count: {
    fontSize: 12,
    fontWeight: "500",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "bold",
  },
});
