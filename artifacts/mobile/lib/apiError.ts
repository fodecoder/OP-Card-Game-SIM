import { ApiError } from "@workspace/api-client-react";

type ErrorPayload = {
  error?: string;
  message?: string;
  detail?: string;
};

function getPayloadMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const data = payload as ErrorPayload;
  return data.error ?? data.message ?? data.detail ?? null;
}

function looksLikeHtml(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("<!doctype html") || normalized.startsWith("<html");
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const payloadMessage = getPayloadMessage(error.data);
    if (payloadMessage) return payloadMessage;

    if (error.status >= 500) {
      return "The server is temporarily unavailable. Please try again shortly.";
    }
  }

  if (error instanceof Error && error.message && !looksLikeHtml(error.message)) {
    return error.message;
  }

  return fallback;
}

