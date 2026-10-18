import { Router, type IRouter } from "express";
import {
  GetAdminAccessStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/access", (req, res): void => {
  const response = GetAdminAccessStatusResponse.parse({
    isAdmin: false,
    pinUnlocked: false,
  });
  res.json(response);
});

router.post("/pin/unlock", async (req, res): Promise<void> => {
  res.status(503).json({ error: "L’accès administrateur SendFlow n’est pas encore configuré." });
});

export default router;
