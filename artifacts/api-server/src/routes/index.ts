import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import databaseRouter from "./database";
import accountRouter from "./account";
import identityVerificationRouter from "./identity-verification";
import adminAccessRouter from "./admin-access";
import adminRouter from "./admin";
import adminActionsRouter from "./admin-actions";
import adminLoginActivityRouter from "./admin-login-activity";
import adminOtpActivityRouter from "./admin-otp-activity";
import adminOtpPoliciesRouter from "./admin-otp-policies";
import adminAggregatorsRouter from "./admin-aggregators";
import operatorPricingRouter from "./operator-pricing";
import bannersRouter from "./banners";
import phoneOtpRouter from "./phone-otp";
import customerAuthRouter from "./customer-auth";
import customerRecoveryRouter from "./customer-recovery";
import registrationSettingsRouter from "./registration-settings";
import { ADMIN_ROUTE_PREFIX } from "../lib/admin-route-prefix";

const router: IRouter = Router();
const adminHandlers: IRouter = Router();
const adminSurface: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(databaseRouter);
router.use(accountRouter);
router.use(identityVerificationRouter);
router.use("/admin", (_req, res) => {
  res.sendStatus(404);
});
router.use(adminRouter);
router.use(adminActionsRouter);
router.use(adminLoginActivityRouter);
router.use(adminOtpActivityRouter);
router.use(adminOtpPoliciesRouter);
router.use(adminAggregatorsRouter);
router.use(operatorPricingRouter);
router.use(bannersRouter);
router.use(registrationSettingsRouter);

adminHandlers.use(adminRouter);
adminHandlers.use(adminActionsRouter);
adminHandlers.use(adminLoginActivityRouter);
adminHandlers.use(adminOtpActivityRouter);
adminHandlers.use(adminOtpPoliciesRouter);
adminHandlers.use(adminAggregatorsRouter);
adminHandlers.use(operatorPricingRouter);
adminHandlers.use(bannersRouter);
adminHandlers.use(registrationSettingsRouter);

adminSurface.use(adminAccessRouter);
adminSurface.use((req, _res, next) => {
  req.url = `/admin${req.url === "/" ? "" : req.url}`;
  next();
});
adminSurface.use(adminHandlers);

router.use(ADMIN_ROUTE_PREFIX, adminSurface);
router.use(customerAuthRouter);
router.use(customerRecoveryRouter);
router.use(phoneOtpRouter);
export default router;
