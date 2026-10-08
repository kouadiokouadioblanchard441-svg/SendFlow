import { Router, type IRouter } from "express";
import {
  and,
  customerCredentialsTable,
  customerSessionsTable,
  db,
  eq,
  isNull,
  phoneOtpChallengesTable,
  usersTable,
} from "@workspace/db";
import {
  ResetCustomerPasswordBody,
  ResetCustomerPasswordResponse,
  ResetCustomerPinBody,
  ResetCustomerPinResponse,
} from "@workspace/api-zod";
import {
  clearAuthFailures,
  getCustomerAccessPhoneAttemptBucket,
} from "../lib/customer-auth-rate-limit";
import { hashCustomerSecret } from "../lib/customer-auth-crypto";
import { verifiedCustomerOtpCondition } from "../lib/customer-auth-otp";
import { fingerprint, isTrustedOrigin } from "../lib/request-security";

const router: IRouter = Router();

function safeErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
}

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }

  const parsed = ResetCustomerPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Vérifiez les informations de récupération." });
    return;
  }

  const now = new Date();
  try {
    const [availableChallenge] = await db
      .select({ id: phoneOtpChallengesTable.id })
      .from(phoneOtpChallengesTable)
      .where(
        verifiedCustomerOtpCondition(
          parsed.data.challengeId,
          parsed.data.phone,
          "password_reset",
          now,
        ),
      )
      .limit(1);
    if (!availableChallenge) {
      res.status(409).json({ error: "La vérification a expiré ou a déjà été utilisée. Demandez un nouveau code." });
      return;
    }

    const passwordHash = await hashCustomerSecret(parsed.data.newPassword);
    const result = await db.transaction(async (tx) => {
      const [challenge] = await tx
        .select({ id: phoneOtpChallengesTable.id })
        .from(phoneOtpChallengesTable)
        .where(
          verifiedCustomerOtpCondition(
            parsed.data.challengeId,
            parsed.data.phone,
            "password_reset",
            now,
          ),
        )
        .for("update");
      if (!challenge) return { kind: "invalid" } as const;

      const [user] = await tx
        .select({ id: usersTable.id, status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.phone, parsed.data.phone))
        .for("update");

      await tx
        .update(phoneOtpChallengesTable)
        .set({ consumedAt: now })
        .where(eq(phoneOtpChallengesTable.id, challenge.id));

      if (!user || user.status !== "active") return { kind: "processed", userId: null } as const;

      const [credential] = await tx
        .update(customerCredentialsTable)
        .set({
          passwordHash,
          passwordUpdatedAt: now,
          updatedAt: now,
        })
        .where(eq(customerCredentialsTable.userId, user.id))
        .returning({ userId: customerCredentialsTable.userId });

      if (!credential) return { kind: "processed", userId: null } as const;

      await tx
        .update(customerSessionsTable)
        .set({ revokedAt: now, pinVerifiedUntil: null })
        .where(
          and(
            eq(customerSessionsTable.userId, user.id),
            isNull(customerSessionsTable.revokedAt),
          ),
        );

      return { kind: "processed", userId: user.id } as const;
    });

    if (result.kind === "invalid") {
      res.status(409).json({ error: "La vérification a expiré ou a déjà été utilisée. Demandez un nouveau code." });
      return;
    }

    if (result.userId) {
      await clearAuthFailures([
        getCustomerAccessPhoneAttemptBucket(fingerprint(`phone:${parsed.data.phone}`)),
        fingerprint(`customer-login-phone:${parsed.data.phone}`),
      ]);
    }
    res.json(ResetCustomerPasswordResponse.parse({ success: true }));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer password recovery failed");
    res.status(503).json({ error: "La récupération du compte est momentanément indisponible." });
  }
});

router.post("/auth/reset-pin", async (req, res): Promise<void> => {
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de requête non autorisée." });
    return;
  }

  const parsed = ResetCustomerPinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Vérifiez les informations de récupération." });
    return;
  }

  const now = new Date();
  try {
    const [availableChallenge] = await db
      .select({ id: phoneOtpChallengesTable.id })
      .from(phoneOtpChallengesTable)
      .where(
        verifiedCustomerOtpCondition(
          parsed.data.challengeId,
          parsed.data.phone,
          "pin_reset",
          now,
        ),
      )
      .limit(1);
    if (!availableChallenge) {
      res.status(409).json({ error: "La vérification a expiré ou a déjà été utilisée. Demandez un nouveau code." });
      return;
    }

    const pinHash = await hashCustomerSecret(parsed.data.newPin);
    const result = await db.transaction(async (tx) => {
      const [challenge] = await tx
        .select({ id: phoneOtpChallengesTable.id })
        .from(phoneOtpChallengesTable)
        .where(
          verifiedCustomerOtpCondition(
            parsed.data.challengeId,
            parsed.data.phone,
            "pin_reset",
            now,
          ),
        )
        .for("update");
      if (!challenge) return { kind: "invalid" } as const;

      const [user] = await tx
        .select({ id: usersTable.id, status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.phone, parsed.data.phone))
        .for("update");

      await tx
        .update(phoneOtpChallengesTable)
        .set({ consumedAt: now })
        .where(eq(phoneOtpChallengesTable.id, challenge.id));

      if (!user || user.status !== "active") return { kind: "processed", userId: null } as const;

      const [credential] = await tx
        .update(customerCredentialsTable)
        .set({
          pinHash,
          pinUpdatedAt: now,
          updatedAt: now,
        })
        .where(eq(customerCredentialsTable.userId, user.id))
        .returning({ userId: customerCredentialsTable.userId });

      if (!credential) return { kind: "processed", userId: null } as const;

      await tx
        .update(customerSessionsTable)
        .set({ revokedAt: now, pinVerifiedUntil: null })
        .where(
          and(
            eq(customerSessionsTable.userId, user.id),
            isNull(customerSessionsTable.revokedAt),
          ),
        );

      return { kind: "processed", userId: user.id } as const;
    });

    if (result.kind === "invalid") {
      res.status(409).json({ error: "La vérification a expiré ou a déjà été utilisée. Demandez un nouveau code." });
      return;
    }

    if (result.userId) {
      await clearAuthFailures([
        fingerprint(`customer-pin-user:${result.userId}`),
      ]);
    }
    res.json(ResetCustomerPinResponse.parse({ success: true }));
  } catch (error) {
    req.log.error({ errorCode: safeErrorCode(error) }, "Customer PIN recovery failed");
    res.status(503).json({ error: "La récupération du compte est momentanément indisponible." });
  }
});

export default router;