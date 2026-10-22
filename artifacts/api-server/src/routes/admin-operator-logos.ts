import express, { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { mutationAllowed } from "./admin-ip-blocklist";
import { respondAdminAuthError } from "./admin";
import { OperatorLogoError, deleteOperatorLogo, uploadOperatorLogo } from "../services/operator-logo";

const supportedImageTypes = ["image/png", "image/jpeg", "image/webp"];

type AdminLogoRequest = Request & { adminActorId?: string };
type Authorize = typeof respondAdminAuthError;

function operatorIdFromRequest(req: Request): string {
  const value = req.params.operatorId;
  return typeof value === "string" ? value : "";
}

function expectedVersionFromRequest(req: Request): number | null {
  const value = typeof req.params.expectedVersion === "string"
    ? req.params.expectedVersion.trim()
    : "";
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function authorizeAndLimit(authorize: Authorize) {
  return async (req: AdminLogoRequest, res: Response, next: NextFunction): Promise<void> => {
    const actor = authorize(req, res, "mutate");
    if (!actor) return;
    if (!await mutationAllowed(req, res, actor)) return;
    req.adminActorId = actor;
    next();
  };
}

function respondLogoError(req: Request, res: Response, error: unknown): void {
  if (error instanceof OperatorLogoError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  req.log?.error({ err: error }, "Admin operator logo operation failed");
  res.status(503).json({ error: "Le logo n’a pas pu être enregistré." });
}

export function createAdminOperatorLogoRoutes(
  authorize: Authorize = respondAdminAuthError,
): IRouter {
  const router: IRouter = Router();
  const authorizeMutation = authorizeAndLimit(authorize);

  router.put(
    "/operators/:operatorId/logo/:expectedVersion",
    authorizeMutation,
    express.raw({ type: supportedImageTypes, limit: "512kb" }),
    async (req: AdminLogoRequest, res): Promise<void> => {
      const actor = req.adminActorId;
      const expectedVersion = expectedVersionFromRequest(req);
      const contentType = req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";

      if (!actor) {
        res.status(503).json({ error: "La session administrateur est indisponible." });
        return;
      }
      if (!expectedVersion) {
        res.status(400).json({ error: "Version d’opérateur invalide." });
        return;
      }
      if (!supportedImageTypes.includes(contentType)) {
        res.status(415).json({ error: "Seuls les fichiers PNG, JPEG et WebP sont acceptés." });
        return;
      }
      if (!Buffer.isBuffer(req.body)) {
        res.status(400).json({ error: "Le fichier image est manquant ou invalide." });
        return;
      }

      try {
        const result = await uploadOperatorLogo(
          actor,
          operatorIdFromRequest(req),
          expectedVersion,
          "Logo ajouté ou remplacé depuis le panel administrateur",
          req.body,
          contentType,
        );
        res.json(result);
      } catch (error) {
        respondLogoError(req, res, error);
      }
    },
  );

  router.delete(
    "/operators/:operatorId/logo/:expectedVersion",
    authorizeMutation,
    async (req: AdminLogoRequest, res): Promise<void> => {
      const actor = req.adminActorId;
      const expectedVersion = expectedVersionFromRequest(req);
      if (!actor) {
        res.status(503).json({ error: "La session administrateur est indisponible." });
        return;
      }
      if (!expectedVersion) {
        res.status(400).json({ error: "Version d’opérateur invalide." });
        return;
      }
      try {
        const result = await deleteOperatorLogo(
          actor,
          operatorIdFromRequest(req),
          expectedVersion,
          "Logo retiré depuis le panel administrateur",
        );
        res.json(result);
      } catch (error) {
        respondLogoError(req, res, error);
      }
    },
  );

  return router;
}

export const adminOperatorLogoRoutes = createAdminOperatorLogoRoutes();
