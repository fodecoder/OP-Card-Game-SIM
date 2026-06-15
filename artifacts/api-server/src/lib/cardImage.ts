export const OFFICIAL_CARD_HOST = "en.onepiece-cardgame.com";

export function proxyCardImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  return imageUrl.startsWith(`https://${OFFICIAL_CARD_HOST}/images/cardlist/card/`)
    ? `/api/card-images?src=${encodeURIComponent(imageUrl)}`
    : imageUrl;
}
