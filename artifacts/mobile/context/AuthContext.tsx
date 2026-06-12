import { setAuthTokenGetter, setTokenRefresher } from "@workspace/api-client-react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/url";

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (tokens: { accessToken: string; refreshToken: string }, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function doLogout() {
  await AsyncStorage.multiRemove(["accessToken", "refreshToken", "user"]);
  setAuthTokenGetter(null);
  setTokenRefresher(null);
}

async function callRefreshEndpoint(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data as { accessToken: string; refreshToken: string };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = async () => {
    try {
      await doLogout();
      setUser(null);
      setAccessToken(null);
    } catch (e) {
      console.error("Failed to clear auth state", e);
    }
  };

  const registerRefresher = (currentRefreshToken: string) => {
    setTokenRefresher(async () => {
      const stored = await AsyncStorage.getItem("refreshToken");
      const tokenToUse = stored ?? currentRefreshToken;
      const result = await callRefreshEndpoint(tokenToUse);
      if (!result) {
        await logout();
        return null;
      }
      await AsyncStorage.setItem("accessToken", result.accessToken);
      await AsyncStorage.setItem("refreshToken", result.refreshToken);
      setAuthTokenGetter(() => result.accessToken);
      setAccessToken(result.accessToken);
      registerRefresher(result.refreshToken);
      return result.accessToken;
    });
  };

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("accessToken");
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        const storedUser = await AsyncStorage.getItem("user");

        if (storedToken && storedUser) {
          setAuthTokenGetter(() => storedToken);
          setAccessToken(storedToken);
          setUser(JSON.parse(storedUser));
          if (refreshToken) {
            registerRefresher(refreshToken);
          }
        }
      } catch (e) {
        console.error("Failed to load auth state", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuth();
  }, []);

  const login = async (tokens: { accessToken: string; refreshToken: string }, userData: User) => {
    try {
      await AsyncStorage.setItem("accessToken", tokens.accessToken);
      await AsyncStorage.setItem("refreshToken", tokens.refreshToken);
      await AsyncStorage.setItem("user", JSON.stringify(userData));

      setAuthTokenGetter(() => tokens.accessToken);
      setAccessToken(tokens.accessToken);
      registerRefresher(tokens.refreshToken);
      setUser(userData);
    } catch (e) {
      console.error("Failed to save auth state", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
