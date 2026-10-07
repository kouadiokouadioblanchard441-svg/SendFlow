export const ADMIN_ROUTE_PATH = "/DMgrgmt-1np5g23g12bGFtMwh";

export function adminRoute<Suffix extends string = "">(suffix: Suffix = "" as Suffix) {
  return `${ADMIN_ROUTE_PATH}${suffix}` as `${typeof ADMIN_ROUTE_PATH}${Suffix}`;
}
