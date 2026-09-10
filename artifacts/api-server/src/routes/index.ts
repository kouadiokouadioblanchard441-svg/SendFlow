import { Router, type IRouter } from "express";
import healthRouter from "./health";
import landingRouter from "./landing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(landingRouter);

export default router;
