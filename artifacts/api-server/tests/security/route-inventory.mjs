import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const routesDirectory = join(apiRoot, "src/routes");
const prefixSource = readFileSync(join(apiRoot, "src/lib/admin-route-prefix.ts"), "utf8");
export const adminPrefix = prefixSource.match(/ADMIN_ROUTE_PREFIX\s*=\s*"([^"]+)"/)[1];

/** Source-derived declarations, not a hand-maintained list of endpoints. */
export function routeInventory() {
  const routes = [];
  for (const name of readdirSync(routesDirectory).filter((name) => name.endsWith(".ts"))) {
    const source = ts.createSourceFile(name, readFileSync(join(routesDirectory, name), "utf8"),
      ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const receiver = node.expression.expression.getText(source);
        const method = node.expression.name.text.toUpperCase();
        const arg = node.arguments[0];
        if (["router", "adminRoutes"].includes(receiver)
          && ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)
          && arg && ts.isStringLiteralLike(arg) && arg.text.startsWith("/")) {
          const admin = name.startsWith("admin") || receiver === "adminRoutes";
          const path = `/api${admin ? adminPrefix : ""}${arg.text}`;
          const category = admin ? "admin"
            : arg.text.startsWith("/me") || arg.text === "/auth/session" ? "customer"
            : arg.text.startsWith("/webhooks/") ? "webhook"
            : method === "GET" ? "public-read" : "authentication";
          routes.push({ method, path, category, file: `src/routes/${name}`,
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const keys = routes.map((route) => `${route.method} ${route.path}`);
  if (new Set(keys).size !== routes.length) throw new Error("Duplicate route declaration in audit inventory");
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export function frontendPaths() {
  const source = ts.createSourceFile("App.tsx",
    readFileSync(join(apiRoot, "../sendflow/src/App.tsx"), "utf8"),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const paths = new Set(["/", adminPrefix, `${adminPrefix}/sign-in`]);
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === "path"
      && node.initializer && ts.isStringLiteral(node.initializer)) {
      paths.add(node.initializer.text.replace(/\/\*\?$/, "").replace(/:[A-Za-z]+/g, "audit-id"));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...paths].sort();
}
