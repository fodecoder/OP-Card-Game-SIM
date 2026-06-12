import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Card } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { CardImage } from "./CardImage";
import { router } from "expo-router";

interface CardItemProps {
  card: Card;
  onPress?: () => void;
  deckId?: number;
  style?: any;
}

export function CardItem({ card, onPress, deckId, style }: CardItemProps) {
  const colors = useColors();

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
    return colorMap[primaryColor] || "transparent";
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (deckId !== undefined) {
      router.push(`/cards/${card.id}?deckId=${deckId}`);
    } else {
      router.push(`/cards/${card.id}`);
    }
  };

  return (
    <TouchableOpacity activeOpacity={0.8} style={style} onPress={handlePress}>
      <View style={styles.container}>
        <View style={styles.imageContainer}>
          <CardImage card={card} width="100%" height="100%" />
        </View>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1} ellipsizeMode="tail">
          {card.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  imageContainer: {
    aspectRatio: 2.5 / 3.5,
    width: "100%",
    position: "relative",
    marginBottom: 8,
  },
  costBadge: {
    position: "absolute",
    top: -4,
    left: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#000",
  },
  costText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  name: { fontSize: 12, fontWeight: "600", textAlign: "center" },
});
