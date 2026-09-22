import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import databaseRouter from "./database";
import accountRouter from "./account";
import identityVerificationRouter from "./identity-verification";
import adminRouter from "./admin";
import adminActionsRouter from "./admin-actions";

const router: IRouter = Router();
router.use(healthRouter);
router.use(storageRouter);
router.use(databaseRouter);
router.use(accountRouter);
router.use(identityVerificationRouter);
router.use(adminRouter);
router.use(adminActionsRouter);
export default router;
