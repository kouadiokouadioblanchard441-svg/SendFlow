import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminIpBlocklistRouter from "./admin-ip-blocklist";
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
import operatorPricingRouter, { adminRoutes as adminOperatorPricingRoutes } from "./operator-pricing";
import bannersRouter, { adminRoutes as adminBannersRoutes } from "./banners";
import phoneOtpRouter from "./phone-otp";
import customerAuthRouter from "./customer-auth";
import customerRecoveryRouter from "./customer-recovery";
import registrationSettingsRouter, { adminRoutes as adminRegistrationSettingsRoutes } from "./registration-settings";
import transferQuoteRouter from "./transfer-quote";
import { ADMIN_ROUTE_PREFIX } from "../lib/admin-route-prefix";

const router: IRouter = Router();
const adminHandlers: IRouter = Router();
const adminSurface: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(databaseRouter);
router.use(accountRouter);
router.use(transferQuoteRouter);
router.use(identityVerificationRouter);
router.use(operatorPricingRouter);
router.use(bannersRouter);
router.use(registrationSettingsRouter);

adminHandlers.use(adminRouter);
adminHandlers.use(adminIpBlocklistRouter);
adminHandlers.use(adminActionsRouter);
adminHandlers.use(adminLoginActivityRouter);
adminHandlers.use(adminOtpActivityRouter);
adminHandlers.use(adminOtpPoliciesRouter);
adminHandlers.use(adminAggregatorsRouter);
adminHandlers.use(adminOperatorPricingRoutes);
adminHandlers.use(adminBannersRoutes);
adminHandlers.use(adminRegistrationSettingsRoutes);

adminSurface.use(adminAccessRouter);
adminSurface.use(adminHandlers);

router.use(ADMIN_ROUTE_PREFIX, adminSurface);
router.use(customerAuthRouter);
router.use(customerRecoveryRouter);
router.use(phoneOtpRouter);
export default router;
