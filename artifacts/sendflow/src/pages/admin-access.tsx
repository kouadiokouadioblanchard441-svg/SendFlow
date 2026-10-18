import { lazy, Suspense, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocation } from "wouter";
import {
  getGetAdminAccessStatusQueryKey,
  useGetAdminAccessStatus,
} from "@workspace/api-client-react";
import { AdminPinDialog } from "@/components/admin-pin-dialog";
import { Button } from "@/components/ui/button";
import { ADMIN_ROUTE_PATH, adminRoute } from "@/lib/admin-route";
import { useSeo } from "@/lib/seo";

const AdminRouter = lazy(() => import("@/pages/admin").then((module) => ({
  default: module.AdminRouter,
})));

function AdminPageLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] items-center justify-center text-muted-foreground"
    >
      Chargement de l’espace administrateur…
    </div>
  );
}

export function AdminSignInPage() {
  useSeo({
    path: adminRoute("/sign-in"),
    locale: "fr",
    title: "Connexion administrateur · SendFlow",
    description: "Connexion réservée aux administrateurs SendFlow.",
    robots: "noindex,nofollow",
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-xl font-semibold">Connexion administrateur indisponible</h1>
        <p className="text-sm text-muted-foreground">
          Le compte administrateur SendFlow sera configuré séparément. Aucun accès administrateur n’est actif pour le moment.
        </p>
      </section>
    </main>
  );
}

export default function AdminAccessPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const accessQuery = useGetAdminAccessStatus({
    query: {
      queryKey: getGetAdminAccessStatusQueryKey(),
      enabled: true,
      retry: false,
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });
  const wasPinUnlocked = useRef(false);

  useEffect(() => {
    const pinUnlocked = accessQuery.data?.pinUnlocked === true;
    if (wasPinUnlocked.current && !pinUnlocked) queryClient.clear();
    wasPinUnlocked.current = pinUnlocked;
  }, [accessQuery.data?.pinUnlocked, queryClient]);

  useSeo({
    path: ADMIN_ROUTE_PATH,
    locale: "fr",
    title: "Espace administrateur · SendFlow",
    description: "Espace réservé aux administrateurs SendFlow.",
    robots: "noindex,nofollow",
  });

  if (accessQuery.isLoading) return <AdminPageLoading />;

  if (accessQuery.isError) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-6">
        <section className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-xl font-semibold">Espace temporairement indisponible</h1>
          <p className="text-sm text-muted-foreground">
            La vérification des droits administrateur n’a pas abouti.
          </p>
          <Button onClick={() => void accessQuery.refetch()} disabled={accessQuery.isFetching}>
            {accessQuery.isFetching ? "Vérification…" : "Réessayer"}
          </Button>
        </section>
      </main>
    );
  }

  if (!accessQuery.data?.isAdmin) {
    return <Redirect to={adminRoute("/sign-in")} />;
  }

  if (!accessQuery.data.pinUnlocked) {
    return (
      <AdminPinDialog
        open
        cancelLabel="Retour au profil"
        onOpenChange={(open) => {
          if (!open) setLocation("/account-info");
        }}
        onUnlocked={async () => {
          await accessQuery.refetch();
        }}
      />
    );
  }

  return (
    <Suspense fallback={<AdminPageLoading />}>
      <AdminRouter />
    </Suspense>
  );
}
