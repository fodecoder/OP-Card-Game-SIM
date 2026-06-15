import type { ErrorRequestHandler } from "express";
import { logger } from "./logger";

type ErrorWithStatus = Error & {
  status?: number;
  statusCode?: number;
  code?: string;
  cause?: unknown;
};

function getErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function getCause(err: unknown): unknown {
  if (!err || typeof err !== "object") return undefined;
  return (err as { cause?: unknown }).cause;
}

function isDatabaseConnectionError(err: unknown): boolean {
  const code = getErrorCode(err) ?? getErrorCode(getCause(err));
  return (
    code === "28P01" ||
    code === "3D000" ||
    code === "08001" ||
    code === "08006" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND"
  );
}

function getStatus(err: ErrorWithStatus): number {
  if (isDatabaseConnectionError(err)) return 503;
  const status = err.status ?? err.statusCode;
  return typeof status === "number" && status >= 400 && status < 600 ? status : 500;
}

function getPublicMessage(err: ErrorWithStatus, status: number): string {
  if (isDatabaseConnectionError(err)) {
    return "Database connection failed. Check DATABASE_URL and database credentials.";
  }
  if (status >= 500) {
    return "Internal server error.";
  }
  return err.message || "Request failed.";
}

export const apiErrorHandler: ErrorRequestHandler = (err: ErrorWithStatus, req, res, _next) => {
  const status = getStatus(err);

  logger.error(
    {
      err,
      status,
      method: req.method,
      path: req.path,
    },
    "API request failed",
  );

  res.status(status).json({
    error: getPublicMessage(err, status),
  });
};

