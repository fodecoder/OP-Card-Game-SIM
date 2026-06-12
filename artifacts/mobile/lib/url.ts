export function getApiBaseUrl(): string {
  const expoDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (!expoDomain) {
    if (process.env.NODE_ENV === "production") {
      return "";
    }
    return "http://localhost:3000";
  }

  if (expoDomain.startsWith("http://") || expoDomain.startsWith("https://")) {
    return expoDomain;
  }

  if (expoDomain.startsWith("localhost") || expoDomain.startsWith("127.0.0.1")) {
    return `http://${expoDomain}`;
  }

  return `https://${expoDomain}`;
}
