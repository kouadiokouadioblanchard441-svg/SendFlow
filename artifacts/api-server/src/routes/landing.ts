import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import {
  landingContent,
  landingCountryOperators,
  landingCountries,
  landingFaqs,
  landingFeatures,
  landingFounderProfile,
  landingGlobeBadges,
  landingMedia,
  landingOperators,
  landingSections,
  legalPages,
  legalSections,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/adminAuth";
import {
  getPublicObjectSearchPaths,
  getSignedObjectUrl,
  parseStoragePath,
} from "../lib/publicObjectStorage";

const router: IRouter = Router();

const resources = {
  media: { table: landingMedia, editable: ["slug", "kind", "sourcePath", "storagePath", "publicUrl", "mimeType", "altFr", "altEn", "width", "height", "isVisible"] },
  content: { table: landingContent, editable: ["contentKey", "locale", "group", "contentType", "value", "orderIndex", "isVisible"] },
  sections: { table: landingSections, editable: ["slug", "kind", "orderIndex", "eyebrowFr", "eyebrowEn", "titleFr", "titleEn", "bodyFr", "bodyEn", "imageKey", "isVisible"] },
  features: { table: landingFeatures, editable: ["slug", "group", "orderIndex", "titleFr", "titleEn", "bodyFr", "bodyEn", "iconKey", "imageKey", "isVisible"] },
  faqs: { table: landingFaqs, editable: ["orderIndex", "questionFr", "questionEn", "answerFr", "answerEn", "isVisible"] },
  countries: { table: landingCountries, editable: ["code", "nameFr", "nameEn", "flag", "tone", "orderIndex", "isVisible"] },
  operators: { table: landingOperators, editable: ["slug", "name", "logoKey", "background", "foreground", "isVisible"] },
  badges: { table: landingGlobeBadges, editable: ["operatorId", "positionX", "positionY", "orderIndex", "isVisible"] },
  legalPages: { table: legalPages, editable: ["slug", "titleFr", "titleEn", "introFr", "introEn", "isVisible"] },
  legalSections: { table: legalSections, editable: ["pageId", "sectionNumber", "titleFr", "titleEn", "bodyFr", "bodyEn", "orderIndex"] },
} as const;

const founderEditableFields = [
  "name", "roleFr", "roleEn", "shortBioFr", "shortBioEn", "storyFr", "storyEn",
  "visionFr", "visionEn", "educationFr", "educationEn", "missionFr", "missionEn",
  "photoKey", "linkedinUrl", "email", "isVisible",
] as const;

type ResourceName = keyof typeof resources;

function resourceConfig(name: string) {
  return Object.prototype.hasOwnProperty.call(resources, name)
    ? resources[name as ResourceName]
    : undefined;
}

function editablePayload(name: ResourceName, body: unknown): Record<string, unknown> {
  const source = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const allowed = resources[name].editable as readonly string[];
  return Object.fromEntries(Object.entries(source).filter(([key, value]) => allowed.includes(key) && value !== undefined));
}

async function getLandingBundle() {
  const [
    media,
    content,
    sections,
    features,
    faqs,
    countries,
    operators,
    countryOperators,
    globeBadges,
    pages,
    pageSections,
    founderProfiles,
  ] = await Promise.all([
    db.select().from(landingMedia).orderBy(asc(landingMedia.id)),
    db.select().from(landingContent).orderBy(asc(landingContent.orderIndex), asc(landingContent.id)),
    db.select().from(landingSections).orderBy(asc(landingSections.orderIndex)),
    db.select().from(landingFeatures).orderBy(asc(landingFeatures.orderIndex)),
    db.select().from(landingFaqs).orderBy(asc(landingFaqs.orderIndex)),
    db.select().from(landingCountries).orderBy(asc(landingCountries.orderIndex)),
    db.select().from(landingOperators).orderBy(asc(landingOperators.id)),
    db.select().from(landingCountryOperators).orderBy(asc(landingCountryOperators.countryId), asc(landingCountryOperators.orderIndex)),
    db.select().from(landingGlobeBadges).orderBy(asc(landingGlobeBadges.orderIndex)),
    db.select().from(legalPages).orderBy(asc(legalPages.id)),
    db.select().from(legalSections).orderBy(asc(legalSections.pageId), asc(legalSections.orderIndex)),
    db.select().from(landingFounderProfile).orderBy(asc(landingFounderProfile.id)),
  ]);

  return { media, content, sections, features, faqs, countries, operators, countryOperators, globeBadges, legalPages: pages, legalSections: pageSections, founder: founderProfiles[0] ?? null };
}

router.get("/landing", async (_req, res): Promise<void> => {
  res.json(await getLandingBundle());
});

router.get("/admin/landing", requireAdmin, async (_req, res): Promise<void> => {
  res.json(await getLandingBundle());
});

router.put("/admin/landing/founder", requireAdmin, async (req, res): Promise<void> => {
  const source = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const values = Object.fromEntries(
    Object.entries(source).filter(([key, value]) => founderEditableFields.includes(key as (typeof founderEditableFields)[number]) && value !== undefined),
  );
  if (!values.name || !values.roleFr || !values.roleEn || !values.shortBioFr || !values.shortBioEn || !values.storyFr || !values.storyEn || !values.visionFr || !values.visionEn || !values.educationFr || !values.educationEn || !values.missionFr || !values.missionEn) {
    res.status(400).json({ error: "Le nom, les rôles, les biographies, le parcours, la vision et la mission sont requis en français et en anglais." });
    return;
  }
  const existing = await db.select({ id: landingFounderProfile.id }).from(landingFounderProfile).orderBy(asc(landingFounderProfile.id)).limit(1);
  const [saved] = existing[0]
    ? await db.update(landingFounderProfile).set(values).where(eq(landingFounderProfile.id, existing[0].id)).returning()
    : await db.insert(landingFounderProfile).values(values as typeof landingFounderProfile.$inferInsert).returning();
  res.json(saved);
});

router.post("/admin/landing/media/upload-url", requireAdmin, async (req, res): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const contentType = typeof req.body?.contentType === "string" ? req.body.contentType.trim().toLowerCase() : "";
  const size = Number(req.body?.size);
  if (!name || !contentType.startsWith("image/") || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) {
    res.status(400).json({ error: "Un fichier image valide de 10 Mo maximum est requis." });
    return;
  }

  try {
    const publicRoot = getPublicObjectSearchPaths()[0];
    const { bucketName, objectName: publicObjectRoot } = parseStoragePath(publicRoot);
    const safeName = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
    const relativePath = `landing/admin/${randomUUID()}-${safeName}`;
    const objectName = `${publicObjectRoot.replace(/\/+$/, "")}/${relativePath}`;
    const uploadURL = await getSignedObjectUrl({ bucketName, objectName, method: "PUT" });
    res.json({
      uploadURL,
      storagePath: `${publicRoot.replace(/\/+$/, "")}/${relativePath}`,
      publicUrl: `/api/storage/public-objects/${relativePath}`,
    });
  } catch (error) {
    req.log.error({ err: error }, "Unable to prepare admin media upload");
    res.status(503).json({ error: "Le stockage des images est indisponible pour le moment. Réessaie lorsque le service sera disponible." });
  }
});

router.patch("/admin/landing/:resource/:id", requireAdmin, async (req, res): Promise<void> => {
  const name = req.params.resource as string;
  const config = resourceConfig(name);
  if (!config || name === "countryOperators") {
    res.status(404).json({ error: "Unknown landing resource" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid resource id" });
    return;
  }
  const values = editablePayload(name as ResourceName, req.body);
  if (Object.keys(values).length === 0) {
    res.status(400).json({ error: "No editable fields supplied" });
    return;
  }
  const table = config.table as any;
  const [updated] = await db.update(table).set(values).where(eq(table.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }
  res.json(updated);
});

router.post("/admin/landing/:resource", requireAdmin, async (req, res): Promise<void> => {
  const name = req.params.resource as string;
  const config = resourceConfig(name);
  if (!config) {
    res.status(404).json({ error: "Unknown landing resource" });
    return;
  }
  const values = editablePayload(name as ResourceName, req.body);
  if (Object.keys(values).length === 0) {
    res.status(400).json({ error: "No editable fields supplied" });
    return;
  }
  const createdRows = (await db.insert(config.table as any).values(values).returning()) as any[];
  const created = createdRows[0];
  res.status(201).json(created);
});

router.delete("/admin/landing/:resource/:id", requireAdmin, async (req, res): Promise<void> => {
  const name = req.params.resource as string;
  const config = resourceConfig(name);
  if (!config) {
    res.status(404).json({ error: "Unknown landing resource" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid resource id" });
    return;
  }
  const table = config.table as any;
  const deletedRows = (await db.delete(table).where(eq(table.id, id)).returning()) as any[];
  const deleted = deletedRows[0];
  if (!deleted) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }
  res.sendStatus(204);
});

router.put("/admin/landing/countries/:countryId/operators", requireAdmin, async (req, res): Promise<void> => {
  const countryId = Number(req.params.countryId);
  const operatorIds = Array.isArray(req.body?.operatorIds)
    ? req.body.operatorIds.map(Number).filter(Number.isInteger)
    : [];
  if (!Number.isInteger(countryId)) {
    res.status(400).json({ error: "Invalid country id" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(landingCountryOperators).where(eq(landingCountryOperators.countryId, countryId));
    if (operatorIds.length > 0) {
      await tx.insert(landingCountryOperators).values(
        operatorIds.map((operatorId: number, orderIndex: number) => ({ countryId, operatorId, orderIndex })),
      );
    }
  });
  res.json({ countryId, operatorIds });
});

export { getLandingBundle };
export default router;