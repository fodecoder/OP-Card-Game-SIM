import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

const ACCESS_SECRET = process.env["SESSION_SECRET"] ?? "access-secret";
const REFRESH_SECRET = (process.env["SESSION_SECRET"] ?? "refresh-secret") + "-refresh";
const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "7d";

export function signAccessToken(userId: number): string {
  return jwt.sign({ sub: userId }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function signRefreshToken(userId: number): string {
  return jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

export function verifyAccessToken(token: string): { sub: number } {
  return jwt.verify(token, ACCESS_SECRET) as unknown as { sub: number };
}

export function verifyRefreshToken(token: string): { sub: number } {
  return jwt.verify(token, REFRESH_SECRET) as unknown as { sub: number };
}

export function getRefreshExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}

export interface AuthRequest extends Request {
  userId: number;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization header" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub));
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    (req as unknown as AuthRequest).userId = user.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
