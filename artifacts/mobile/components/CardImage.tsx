import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { getApiBaseUrl } from "@/lib/url";

export interface CardVisualData {
  cardNumber: string;
  color: string;
  cardType: string;
  cost?: number | null;
  power?: number | null;
  counter?: number | null;
  life?: number | null;
  imageUrl?: string | null;
}

interface CardImageProps {
  card: CardVisualData;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
}

const COLOR_MAP: Record<string, string> = {
  red: "#dc2626",
  green: "#16a34a",
  blue: "#2563eb",
  purple: "#9333ea",
  black: "#374151",
  yellow: "#eab308",
};

export function getCardColors(color: string | null | undefined): string[] {
  const parsed = (color ?? "")
    .split("/")
    .map((value) => COLOR_MAP[value.trim().toLowerCase()])
    .filter((value): value is string => Boolean(value));
  return parsed.length > 0 ? parsed : ["#64748b"];
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${getApiBaseUrl()}${url}`;
}

export function CardImage({ card, width = "100%", height = "100%", style }: CardImageProps) {
  const colors = useColors();
  const resolvedImageUrl = resolveImageUrl(card.imageUrl);
  const [failed, setFailed] = useState(false);
  const borderColors = useMemo(() => getCardColors(card.color), [card.color]);

  useEffect(() => {
    setFailed(false);
  }, [resolvedImageUrl]);

  return (
    <LinearGradient
      colors={
        borderColors.length > 1
          ? [borderColors[0], borderColors[0], borderColors[1], borderColors[1]]
          : [borderColors[0], borderColors[0]]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.border, { width, height }, style]}
    >
      {resolvedImageUrl && !failed ? (
        <Image
          source={resolvedImageUrl}
          style={styles.image}
          contentFit="cover"
          transition={180}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[styles.fallback, { backgroundColor: colors.card }]}>
          {card.cost != null && (
            <View style={[styles.statTop, { backgroundColor: borderColors[0] }]}>
              <Text style={styles.statText}>{card.cost}</Text>
            </View>
          )}
          {card.cardType.toLowerCase() === "leader" && card.life != null && (
            <View style={[styles.lifeBadge, { backgroundColor: "#b91c1c" }]}>
              <Text style={styles.statText}>L {card.life}</Text>
            </View>
          )}
          <Text style={[styles.code, { color: colors.foreground }]} numberOfLines={2}>
            {card.cardNumber}
          </Text>
          <View style={styles.bottomStats}>
            {card.counter != null && (
              <Text style={[styles.bottomStat, { color: "#60a5fa" }]}>CTR {card.counter}</Text>
            )}
            {card.power != null && (
              <Text style={[styles.bottomStat, { color: colors.foreground }]}>
                {card.power.toLocaleString()}
              </Text>
            )}
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  border: {
    padding: 3,
    borderRadius: 9,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
    backgroundColor: "#111827",
  },
  fallback: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: 6,
  },
  code: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  statTop: {
    position: "absolute",
    top: 5,
    left: 5,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  lifeBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    minWidth: 30,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  statText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  bottomStats: {
    position: "absolute",
    left: 7,
    right: 7,
    bottom: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  bottomStat: { fontSize: 9, fontWeight: "800" },
});
