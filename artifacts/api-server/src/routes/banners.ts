import { Router, type IRouter, type Response } from "express";
import {
  and,
  asc,
  bannersTable,
  db,
  eq,
  gte,
  isNull,
  lte,
  or,
} from "@workspace/db";
import {
  CreateAdminBannerBody,
  CreateAdminBannerResponse,
  DeleteAdminBannerParams,
  DeleteAdminBannerResponse,
  ListAdminBannersResponse,
  ListPublishedBannersResponse,
  ReorderAdminBannersBody,
  UpdateAdminBannerBody,
  UpdateAdminBannerParams,
  UpdateAdminBannerResponse,
} from "@workspace/api-zod";
import { recordAdminAudit } from "../lib/admin-audit";
import { respondAdminAuthError } from "./admin";

const router: IRouter = Router();

function isSecureImageUrl(value: string | null | undefined): boolean {
  if (value == null) return true;
  if (/^\/banners\/[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isSafeTargetUrl(value: string | null | undefined): boolean {
  if (value == null) return true;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/[\u0000-\u001f]/.test(value)) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function hasValidSchedule(startsAt: Date | null | undefined, endsAt: Date | null | undefined) {
  return !startsAt || !endsAt || startsAt.getTime() <= endsAt.getTime();
}

function validateBannerFields(
  res: Response,
  fields: {
    imageUrl?: string;
    mobileImageUrl?: string | null;
    targetUrl?: string | null;
    ctaLabel?: string | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
  },
): boolean {
  if (!isSecureImageUrl(fields.imageUrl) || !isSecureImageUrl(fields.mobileImageUrl)) {
    res.status(400).json({ error: "Banner images must use HTTPS or a local /banners/ asset path" });
    return false;
  }
  if (!isSafeTargetUrl(fields.targetUrl)) {
    res.status(400).json({ error: "Banner destination must be an internal path or an HTTPS URL" });
    return false;
  }
  if (!hasValidSchedule(fields.startsAt, fields.endsAt)) {
    res.status(400).json({ error: "Banner end date must be after its start date" });
    return false;
  }
  return true;
}

router.get("/banners", async (req, res): Promise<void> => {
  const now = new Date();
  try {
    const rows = await db
      .select({
        id: bannersTable.id,
        title: bannersTable.title,
        description: bannersTable.description,
        imageUrl: bannersTable.imageUrl,
        mobileImageUrl: bannersTable.mobileImageUrl,
        imageAlt: bannersTable.imageAlt,
        ctaLabel: bannersTable.ctaLabel,
        targetUrl: bannersTable.targetUrl,
        sortOrder: bannersTable.sortOrder,
      })
      .from(bannersTable)
      .where(and(
        eq(bannersTable.isActive, true),
        or(isNull(bannersTable.startsAt), lte(bannersTable.startsAt, now)),
        or(isNull(bannersTable.endsAt), gte(bannersTable.endsAt, now)),
      ))
      .orderBy(asc(bannersTable.sortOrder), asc(bannersTable.createdAt));

    res.json(ListPublishedBannersResponse.parse({ items: rows }));
  } catch (error) {
    req.log.error({ err: error }, "Published banner lookup failed");
    res.status(503).json({ error: "Banner storage unavailable" });
  }
});

router.get("/admin/banners", async (req, res): Promise<void> => {
  if (!respondAdminAuthError(req, res)) return;

  try {
    const items = await db
      .select()
      .from(bannersTable)
      .orderBy(asc(bannersTable.sortOrder), asc(bannersTable.createdAt));

    res.json(ListAdminBannersResponse.parse({ items }));
  } catch (error) {
    req.log.error({ err: error }, "Admin banner list lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.post("/admin/banners", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const parsed = CreateAdminBannerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid banner data" });
    return;
  }
  if (!parsed.data.title.trim() || !parsed.data.imageAlt.trim()) {
    res.status(400).json({ error: "Banner title and alternative text cannot be blank" });
    return;
  }
  if (!validateBannerFields(res, parsed.data)) return;
  if (parsed.data.ctaLabel && !parsed.data.targetUrl) {
    res.status(400).json({ error: "A banner call to action requires a destination URL" });
    return;
  }

  try {
    const banner = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(bannersTable)
        .values({
          title: parsed.data.title.trim(),
          description: parsed.data.description?.trim() || null,
          imageUrl: parsed.data.imageUrl,
          mobileImageUrl: parsed.data.mobileImageUrl ?? null,
          imageAlt: parsed.data.imageAlt.trim(),
          ctaLabel: parsed.data.ctaLabel?.trim() || null,
          targetUrl: parsed.data.targetUrl ?? null,
          sortOrder: parsed.data.sortOrder,
          isActive: parsed.data.isActive,
          startsAt: parsed.data.startsAt ?? null,
          endsAt: parsed.data.endsAt ?? null,
          createdBy: adminUserId,
          updatedBy: adminUserId,
        })
        .returning();

      if (!created) throw new Error("Banner was not created");
      await recordAdminAudit({
        adminUserId,
        action: "create_banner",
        resourceType: "banner",
        resourceId: created.id,
      }, tx);
      return created;
    });

    res.status(201).json(CreateAdminBannerResponse.parse(banner));
  } catch (error) {
    req.log.error({ err: error }, "Admin banner creation failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.patch("/admin/banners/reorder", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const parsed = ReorderAdminBannersBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid banner order" });
    return;
  }

  const { expectedOrder, orderedIds } = parsed.data;
  const expectedIds = new Set(expectedOrder);
  const orderedIdSet = new Set(orderedIds);
  if (
    expectedIds.size !== expectedOrder.length
    || orderedIdSet.size !== orderedIds.length
    || expectedIds.size !== orderedIdSet.size
    || [...orderedIdSet].some((id) => !expectedIds.has(id))
  ) {
    res.status(400).json({ error: "The new order must contain every banner exactly once" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const current = await tx
        .select({ id: bannersTable.id, sortOrder: bannersTable.sortOrder })
        .from(bannersTable)
        .orderBy(asc(bannersTable.sortOrder), asc(bannersTable.createdAt))
        .for("update");
      const currentOrder = current.map((item) => item.id);

      if (
        currentOrder.length !== expectedOrder.length
        || currentOrder.some((id, index) => id !== expectedOrder[index])
      ) {
        return { conflict: true as const };
      }

      const currentById = new Map(current.map((item) => [item.id, item]));
      for (const [sortOrder, id] of orderedIds.entries()) {
        const existing = currentById.get(id);
        if (!existing) throw new Error("Banner disappeared during reorder");
        if (existing.sortOrder === sortOrder) continue;

        const [updated] = await tx
          .update(bannersTable)
          .set({ sortOrder, updatedBy: adminUserId, updatedAt: new Date() })
          .where(eq(bannersTable.id, id))
          .returning({ id: bannersTable.id });
        if (!updated) throw new Error("Banner order was not updated");

        await recordAdminAudit({
          adminUserId,
          action: "update_banner",
          resourceType: "banner",
          resourceId: id,
        }, tx);
      }

      const items = await tx
        .select()
        .from(bannersTable)
        .orderBy(asc(bannersTable.sortOrder), asc(bannersTable.createdAt));
      return { items };
    });

    if ("conflict" in result) {
      res.status(409).json({ error: "Banner order changed. Refresh the list and try again." });
      return;
    }
    res.json(ListAdminBannersResponse.parse({ items: result.items }));
  } catch (error) {
    req.log.error({ err: error }, "Admin banner reorder failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.patch("/admin/banners/:bannerId", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const params = UpdateAdminBannerParams.safeParse(req.params);
  const parsed = UpdateAdminBannerBody.safeParse(req.body);
  if (!params.success || !parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    res.status(400).json({ error: "Invalid banner update" });
    return;
  }
  if (
    (parsed.data.title !== undefined && !parsed.data.title.trim())
    || (parsed.data.imageAlt !== undefined && !parsed.data.imageAlt.trim())
  ) {
    res.status(400).json({ error: "Banner title and alternative text cannot be blank" });
    return;
  }
  if (!validateBannerFields(res, parsed.data)) return;

  try {
    const banner = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(bannersTable)
        .where(eq(bannersTable.id, params.data.bannerId))
        .for("update");

      if (!existing) return null;
      const startsAt = parsed.data.startsAt === undefined ? existing.startsAt : parsed.data.startsAt;
      const endsAt = parsed.data.endsAt === undefined ? existing.endsAt : parsed.data.endsAt;
      const ctaLabel = parsed.data.ctaLabel === undefined ? existing.ctaLabel : parsed.data.ctaLabel;
      const targetUrl = parsed.data.targetUrl === undefined ? existing.targetUrl : parsed.data.targetUrl;
      if (!hasValidSchedule(startsAt, endsAt) || (ctaLabel && !targetUrl)) {
        return { invalid: true as const };
      }

      const [updated] = await tx
        .update(bannersTable)
        .set({
          ...parsed.data,
          title: parsed.data.title?.trim(),
          description: parsed.data.description == null ? parsed.data.description : parsed.data.description.trim() || null,
          imageAlt: parsed.data.imageAlt?.trim(),
          ctaLabel: parsed.data.ctaLabel == null ? parsed.data.ctaLabel : parsed.data.ctaLabel.trim() || null,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        })
        .where(eq(bannersTable.id, params.data.bannerId))
        .returning();

      if (!updated) throw new Error("Banner was not updated");
      await recordAdminAudit({
        adminUserId,
        action: "update_banner",
        resourceType: "banner",
        resourceId: updated.id,
      }, tx);
      return updated;
    });

    if (!banner) {
      res.status(404).json({ error: "Banner not found" });
      return;
    }
    if ("invalid" in banner) {
      res.status(400).json({ error: "Banner dates or call to action are inconsistent" });
      return;
    }
    res.json(UpdateAdminBannerResponse.parse(banner));
  } catch (error) {
    req.log.error({ err: error, bannerId: params.data.bannerId }, "Admin banner update failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.delete("/admin/banners/:bannerId", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const params = DeleteAdminBannerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid banner identifier" });
    return;
  }

  try {
    const deleted = await db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(bannersTable)
        .where(eq(bannersTable.id, params.data.bannerId))
        .returning({ id: bannersTable.id });

      if (!removed) return null;
      await recordAdminAudit({
        adminUserId,
        action: "delete_banner",
        resourceType: "banner",
        resourceId: removed.id,
      }, tx);
      return removed;
    });

    if (!deleted) {
      res.status(404).json({ error: "Banner not found" });
      return;
    }
    res.json(DeleteAdminBannerResponse.parse({ id: deleted.id, deleted: true }));
  } catch (error) {
    req.log.error({ err: error, bannerId: params.data.bannerId }, "Admin banner deletion failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

export default router;