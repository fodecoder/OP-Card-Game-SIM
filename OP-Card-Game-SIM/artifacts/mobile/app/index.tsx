import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Redirect, router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LandingScreen() {
  const { isAuthenticated, isLoading } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.hero}>
        <View style={[styles.logoContainer, { borderColor: colors.primary }]}>
          <Feather name="anchor" size={64} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>ONE PIECE</Text>
        <Text style={[styles.subtitle, { color: colors.primary }]}>TCG SIMULATOR</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          Build decks, test strategies, and conquer the Grand Line.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/auth/login")}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={() => router.push("/auth/register")}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, { color: colors.foreground }]}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "space-between",
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    letterSpacing: 2,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "bold",
    letterSpacing: 4,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    maxWidth: "80%",
  },
  actions: {
    gap: 16,
    paddingBottom: 24,
  },
  btn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
