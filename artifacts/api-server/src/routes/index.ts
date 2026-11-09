import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminIpBlocklistRouter from "./admin-ip-blocklist";
import adminNetworkDefenseRouter from "./admin-network-defense";
import storageRouter from "./storage";
import databaseRouter from "./database";
import accountRouter from "./account";
import accountLimitRouter from "./account-limit";
import adminAccessRouter from "./admin-access";
import adminSessionsRouter from "./admin-sessions";
import adminRouter, {
  respondAdminAuthError,
  respondAdminTransactionReadAuthError,
  respondAdminUserReadAuthError,
} from "./admin";
import adminActionsRouter from "./admin-actions";
import adminLoginActivityRouter from "./admin-login-activity";
import adminOtpActivityRouter from "./admin-otp-activity";
import adminOtpPoliciesRouter from "./admin-otp-policies";
import adminAggregatorsRouter from "./admin-aggregators";
import operatorPricingRouter, { adminRoutes as adminOperatorPricingRoutes } from "./operator-pricing";
import { adminOperatorLogoRoutes } from "./admin-operator-logos";
import bannersRouter, { adminRoutes as adminBannersRoutes } from "./banners";
import authOtpRouter from "./auth-otp";
import customerAuthRouter from "./customer-auth";
import customerRecoveryRouter from "./customer-recovery";
import registrationSettingsRouter, { adminRoutes as adminRegistrationSettingsRoutes } from "./registration-settings";
import customerServiceSettingsRouter, { adminRoutes as adminCustomerServiceSettingsRoutes } from "./customer-service-settings";
import paymentLimitsRouter, { adminRoutes as adminPaymentLimitsRoutes } from "./payment-limits";
import countryManagementRouter, { adminRoutes as adminCountryRoutes } from "./country-management";
import emailCampaignRoutes from "./email-campaigns";
import emailCampaignWebhookRouter from "./email-campaign-webhook";
import identityVerificationRouter, {
  adminRoutes as adminIdentityVerificationRoutes,
} from "./identity-verification";
import transferQuoteRouter from "./transfer-quote";
import paymentLinksRouter from "./payment-links";
import publicPaymentLinksRouter from "./public-payment-links";
import developerRouter from "./developer";
import developerPayoutsRouter from "./developer-payouts";
import adminPayoutsRouter from "./admin-payouts";
import { ADMIN_ROUTE_PREFIX } from "../lib/admin-route-prefix";
import { loadAdminSession } from "../lib/admin-session";
import { requireAdminStepUp } from "../lib/admin-step-up";
import { adminAuditContextMiddleware } from "../lib/admin-audit-context";
import { adminNetworkGuard } from "../lib/admin-network-policy";

const router: IRouter = Router();
const adminHandlers: IRouter = Router();
const adminSurface: IRouter = Router();

// Defense in depth: administrative routes cannot omit server-session checks,
// the existing narrow mutation scope, or action-bound TOTP confirmation.
// Authentication endpoints are mounted before the mutation gate.
adminHandlers.use((req, res, next) => {
  if (req.method === "GET" && /^\/(?:users(?:\/[^/]+)?|developer-webhooks)\/?$/.test(req.path)) {
    if (respondAdminUserReadAuthError(req, res)) next();
    return;
  }
  if (req.method === "GET" && /^\/transactions(?:\/[^/]+)?\/?$/.test(req.path)) {
    if (respondAdminTransactionReadAuthError(req, res)) next();
    return;
  }
  const permission = ["GET", "HEAD", "OPTIONS"].includes(req.method) ? "read" : "mutate";
  if (respondAdminAuthError(req, res, permission)) next();
});

router.use(healthRouter);
router.use(storageRouter);
router.use(databaseRouter);
router.use(accountRouter);
router.use(transferQuoteRouter);
router.use(paymentLinksRouter);
router.use(publicPaymentLinksRouter);
router.use(developerRouter);
router.use(developerPayoutsRouter);
router.use(emailCampaignWebhookRouter);
router.use(accountLimitRouter);
router.use(identityVerificationRouter);
router.use(operatorPricingRouter);
router.use(bannersRouter);
router.use(registrationSettingsRouter);
router.use(customerServiceSettingsRouter);
router.use(paymentLimitsRouter);
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
adminHandlers.use(adminCustomerServiceSettingsRoutes);
adminHandlers.use(adminPaymentLimitsRoutes);
adminHandlers.use(adminCountryRoutes);
adminHandlers.use(emailCampaignRoutes);
adminHandlers.use(adminIdentityVerificationRoutes);
adminHandlers.use(adminPayoutsRouter);

adminSurface.use(adminNetworkGuard);
adminSurface.use(loadAdminSession);
adminSurface.use(adminAuditContextMiddleware);
adminSurface.use(adminAccessRouter);
adminSurface.use(requireAdminStepUp);
adminSurface.use(adminSessionsRouter);
adminSurface.use(adminHandlers);

router.use(ADMIN_ROUTE_PREFIX, adminSurface);
router.use(customerAuthRouter);
router.use(customerRecoveryRouter);
router.use(authOtpRouter);
export default router;
