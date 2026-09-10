import { Router, type IRouter } from "express";
import { and, eq, lt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { adminSessions, adminUsers, db } from "@workspace/db";
import {
  clearAdminSessionCookie,
  getAdminUser,
  hashAdminPanelToken,
  hashAdminPassword,
  hashSessionToken,
  setAdminSessionCookie,
  verifyAdminPassword,
} from "../middlewares/adminAuth";

const router: IRouter = Router();
const SESSION_DAYS = 7;

router.post("/admin/auth/login", async (req, res): Promise<void> => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const panelToken = typeof req.body?.panelToken === "string" ? req.body.panelToken : "";
  if (!email || !password || !panelToken) {
    res.status(400).json({ error: "Panel URL, email and password are required" });
    return;
  }

  const [user] = await db.select().from(adminUsers).where(and(eq(adminUsers.email, email), eq(adminUsers.isActive, true))).limit(1);
  if (!user || !user.panelTokenHash || hashAdminPanelToken(panelToken) !== user.panelTokenHash || !(await verifyAdminPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid panel URL, email or password" });
    return;
  }

  const token = randomBytes(32).toString("base64url");
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  await db.insert(adminSessions).values({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
  });
  await db.update(adminUsers).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(adminUsers.id, user.id));
  setAdminSessionCookie(res, token);
  res.json({ user: { id: user.id, email: user.email } });
});

router.get("/admin/auth/panel/:token/:email", async (req, res): Promise<void> => {
  const token = typeof req.params.token === "string" ? req.params.token : "";
  const email = typeof req.params.email === "string" ? decodeURIComponent(req.params.email).trim().toLowerCase() : "";
  if (!token || !email) {
    res.status(404).json({ error: "Panel not found" });
    return;
  }

  const [user] = await db
    .select({ id: adminUsers.id, email: adminUsers.email })
    .from(adminUsers)
    .where(and(eq(adminUsers.email, email), eq(adminUsers.panelTokenHash, hashAdminPanelToken(token)), eq(adminUsers.isActive, true)))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Panel not found" });
    return;
  }
  res.json({ user });
});

router.get("/admin/auth/me", async (req, res): Promise<void> => {
  const user = await getAdminUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.json({ user: { id: user.id, email: user.email } });
});

router.post("/admin/auth/logout", async (req, res): Promise<void> => {
  const user = await getAdminUser(req);
  if (user) {
    const token = req.headers.cookie?.match(/(?:^|;\s*)sendflow_admin_session=([^;]+)/)?.[1];
    if (token) await db.delete(adminSessions).where(eq(adminSessions.tokenHash, hashSessionToken(decodeURIComponent(token))));
  }
  clearAdminSessionCookie(res);
  res.sendStatus(204);
});

export default router;