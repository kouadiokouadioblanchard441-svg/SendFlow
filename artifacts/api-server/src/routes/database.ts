import { Router, type IRouter } from "express";
import { db, sql } from "@workspace/db";
import { DatabaseHealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/db-status", async (req, res): Promise<void> => {
  try {
    await db.execute(sql`select 1`);
    res.json(DatabaseHealthCheckResponse.parse({ status: "healthy" }));
  } catch (error) {
    req.log.error({ err: error }, "Database health check failed");
    res.status(503).json({ error: "Database unavailable" });
  }
});

export default router;