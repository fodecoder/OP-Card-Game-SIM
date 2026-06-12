import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { UpdateUserProfileBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    gamesPlayed: user.gamesPlayed,
    wins: user.wins,
    losses: user.losses,
    createdAt: user.createdAt.toISOString(),
  });
});

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;

  const parsed = UpdateUserProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({
      username: parsed.data.username ?? undefined,
      avatarUrl: parsed.data.avatarUrl ?? undefined,
    })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    gamesPlayed: user.gamesPlayed,
    wins: user.wins,
    losses: user.losses,
    createdAt: user.createdAt.toISOString(),
  });
});

router.get("/users/me/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthRequest).userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const winRate = user.gamesPlayed > 0 ? user.wins / user.gamesPlayed : 0;

  res.json({
    gamesPlayed: user.gamesPlayed,
    wins: user.wins,
    losses: user.losses,
    winRate: Math.round(winRate * 100) / 100,
  });
});

export default router;
