import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminIpBlocklistRouter from "./admin-ip-blocklist";
import adminNetworkDefenseRouter from "./admin-network-defense";
import storageRouter from "./storage";
import databaseRouter from "./database";
import accountRouter from "./account";
import identityVerificationRouter from "./identity-verification";
import adminAccessRouter from "./admin-access";
import adminRouter, { respondAdminAuthError } from "./admin";
import adminActionsRouter from "./admin-actions";
import adminLoginActivityRouter from "./admin-login-activity";
import adminOtpActivityRouter from "./admin-otp-activity";
import adminOtpPoliciesRouter from "./admin-otp-policies";
import adminAggregatorsRouter from "./admin-aggregators";
import operatorPricingRouter, { adminRoutes as adminOperatorPricingRoutes } from "./operator-pricing";
import { adminOperatorLogoRoutes } from "./admin-operator-logos";
import bannersRouter, { adminRoutes as adminBannersRoutes } from "./banners";
import phoneOtpRouter from "./phone-otp";
import customerAuthRouter from "./customer-auth";
import customerRecoveryRouter from "./customer-recovery";
import registrationSettingsRouter, { adminRoutes as adminRegistrationSettingsRoutes } from "./registration-settings";
import countryManagementRouter, { adminRoutes as adminCountryRoutes } from "./country-management";
import transferQuoteRouter from "./transfer-quote";
import { ADMIN_ROUTE_PREFIX } from "../lib/admin-route-prefix";
import { loadAdminSession } from "../lib/admin-session";

const router: IRouter = Router();
const adminHandlers: IRouter = Router();
const adminSurface: IRouter = Router();

// Defense in depth: new administrative routes cannot accidentally omit the
// server session, current grant, scope, mutation right and PIN checks.
// The access/sign-in/PIN/sign-out router remains outside this protected group.
adminHandlers.use((req, res, next) => {
  const permission = ["GET", "HEAD", "OPTIONS"].includes(req.method) ? "read" : "mutate";
  if (respondAdminAuthError(req, res, permission)) next();
});

router.use(healthRouter);
router.use(storageRouter);
router.use(databaseRouter);
router.use(accountRouter);
router.use(transferQuoteRouter);
router.use(identityVerificationRouter);
router.use(operatorPricingRouter);
router.use(bannersRouter);
router.use(registrationSettingsRouter);
router.use(countryManagementRouter);

adminHandlers.use(adminRouter);
adminHandlers.use(adminIpBlocklistRouter);
adminHandlers.use(adminNetworkDefenseRouter);
adminHandlers.use(adminActionsRouter);
adminHandlers.use(adminLoginActivityRouter);
adminHandlers.use(adminOtpActivityRouter);
adminHandlers.use(adminOtpPoliciesRouter);
adminHandlers.use(adminAggregatorsRouter);
adminHandlers.use(adminOperatorPricingRoutes);
adminHandlers.use(adminOperatorLogoRoutes);
adminHandlers.use(adminBannersRoutes);
adminHandlers.use(adminRegistrationSettingsRoutes);
adminHandlers.use(adminCountryRoutes);

adminSurface.use(loadAdminSession);
adminSurface.use(adminAccessRouter);
adminSurface.use(adminHandlers);

router.use(ADMIN_ROUTE_PREFIX, adminSurface);
router.use(customerAuthRouter);
router.use(customerRecoveryRouter);
router.use(phoneOtpRouter);
export default router;
