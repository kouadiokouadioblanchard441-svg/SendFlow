import { getSignInAdminUrl } from "@workspace/api-client-react";

const generatedSignInUrl = getSignInAdminUrl();
export const ADMIN_API_PATH_PREFIX = generatedSignInUrl.replace(/\/sign-in$/u, "");
const generatedAdminApiPrefix = ADMIN_API_PATH_PREFIX
  .replace(/^\/api/u, "")

export const ADMIN_ROUTE_PATH = "";

export function adminRoute<Suffix extends string = "">(suffix: Suffix = "" as Suffix) {
  if (!suffix) return "/" as `${typeof ADMIN_ROUTE_PATH}${Suffix}`;
  return (suffix.startsWith("/") ? suffix : `/${suffix}`) as `${typeof ADMIN_ROUTE_PATH}${Suffix}`;
}

export function adminApiRoute<Suffix extends string = "">(suffix: Suffix = "" as Suffix) {
  const normalized = suffix
    ? suffix.startsWith("/") ? suffix : `/${suffix}`
    : "";
  return `${generatedAdminApiPrefix}${normalized}`;
}
