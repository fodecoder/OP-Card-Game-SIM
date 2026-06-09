import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useColors } from "@/hooks/useColors";
import { Card } from "@workspace/api-client-react";

interface CardImageProps {
  card: Card;
  width?: number | string;
  height?: number | string;
  style?: any;
}

function getBaseUrl() {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

export function CardImage({ card, width = "100%", height = "100%", style }: CardImageProps) {
  const colors = useColors();

  const resolveImageUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${getBaseUrl()}${url}`;
  };

  const resolvedImageUrl = resolveImageUrl(card.imageUrl);
  
  const getFallbackColor = () => {
    const colorMap: Record<string, string> = {
      Red: colors.cardGlow.red,
      Green: colors.cardGlow.green,
      Blue: colors.cardGlow.blue,
      Purple: colors.cardGlow.purple,
      Black: colors.cardGlow.black,
      Yellow: colors.cardGlow.yellow,
    };
    
    // Some cards have multiple colors like "Red/Green"
    const primaryColor = card.color?.split("/")[0] || "";
    return colorMap[primaryColor] || colors.muted;
  };

  if (!resolvedImageUrl) {
    return (
      <View
        style={[
          styles.fallback,
          {
            width,
            height,
            backgroundColor: colors.card,
            borderColor: getFallbackColor(),
            borderWidth: 2,
            borderRadius: colors.radius,
          },
          style,
        ]}
      />
    );
  }

  return (
    <Image
      source={resolvedImageUrl}
      style={[
        {
          width,
          height,
          borderRadius: colors.radius,
        },
        style,
      ]}
      contentFit="cover"
      transition={200}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    justifyContent: "center",
    alignItems: "center",
  },
});
