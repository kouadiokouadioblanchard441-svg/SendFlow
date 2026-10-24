import { PORTAL_ROUTE_PATH } from "../../server/portal-route-path";

export const ADMIN_ROUTE_PATH = PORTAL_ROUTE_PATH;

export function adminRoute<Suffix extends string = "">(suffix: Suffix = "" as Suffix) {
  return `${ADMIN_ROUTE_PATH}${suffix}` as `${typeof ADMIN_ROUTE_PATH}${Suffix}`;
}
