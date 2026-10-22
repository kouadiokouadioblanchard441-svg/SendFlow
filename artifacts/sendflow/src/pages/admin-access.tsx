import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocation } from "wouter";
import {
  getGetAdminAccessStatusQueryKey,
  useGetAdminAccessStatus,
  useSendPhoneOtp,
  useVerifyPhoneOtp,
  useSignInAdmin,
  useSignOutAdmin,
} from "@workspace/api-client-react";
import { AdminPinDialog } from "@/components/admin-pin-dialog";
import { Button } from "@/components/ui/button";
import { ADMIN_ROUTE_PATH, adminRoute } from "@/lib/admin-route";
import { useSeo } from "@/lib/seo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function authErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "data" in error
    && error.data && typeof error.data === "object" && "error" in error.data
    && typeof error.data.error === "string") return error.data.error;
  return "La connexion administrateur est momentanément indisponible.";
}

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
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const sendOtp = useSendPhoneOtp();
  const verifyOtp = useVerifyPhoneOtp();
  const signIn = useSignInAdmin();
  const busy = sendOtp.isPending || verifyOtp.isPending || signIn.isPending;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  async function sendCode() {
    setMessage("");
    try {
      const result = await sendOtp.mutateAsync({ data: { phone, purpose: "admin_login" } });
      setChallengeId(result.challengeId);
      setCode("");
      setResendAt(Date.now() + result.resendAfterSeconds * 1000);
    } catch (error) { setMessage(authErrorMessage(error)); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!challengeId) { await sendCode(); return; }
    setMessage("");
    try {
      await verifyOtp.mutateAsync({ data: { challengeId, code, purpose: "admin_login" } });
      await signIn.mutateAsync({ data: { phone, challengeId } });
      queryClient.clear();
      setLocation(adminRoute("/operator-pricing"));
    } catch (error) { setMessage(authErrorMessage(error)); }
  }
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
        <h1 className="text-xl font-semibold">Connexion administrateur</h1>
        <p className="text-sm text-muted-foreground">
          Accès réservé aux comptes autorisés par SendFlow. Après le code SMS, votre PIN administrateur sera demandé.
        </p>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-phone">Numéro de téléphone international</Label>
            <Input id="admin-phone" type="tel" autoComplete="tel" placeholder="+225…"
              value={phone} onChange={(event) => setPhone(event.target.value)}
              disabled={busy || !!challengeId} required pattern={"\\+[1-9][0-9]{7,14}"}
              data-testid="input-admin-phone" />
          </div>
          {challengeId && <div className="space-y-2">
            <Label htmlFor="admin-otp">Code reçu par SMS</Label>
            <Input id="admin-otp" inputMode="numeric" autoComplete="one-time-code"
              value={code} onChange={(event) => setCode(event.target.value)} required
              pattern="[0-9]{4,8}" maxLength={8} disabled={busy} data-testid="input-admin-otp" />
            <Button type="button" variant="ghost" disabled={busy || now < resendAt} onClick={() => void sendCode()}>
              {now < resendAt ? `Renvoyer dans ${Math.ceil((resendAt - now) / 1000)} s` : "Renvoyer le code"}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => {
              setChallengeId(null); setCode(""); setMessage("");
            }}>Changer de numéro</Button>
          </div>}
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <Button type="submit" className="w-full" disabled={busy} data-testid="button-admin-sign-in">
            {busy ? "Vérification…" : challengeId ? "Vérifier et continuer" : "Recevoir un code SMS"}
          </Button>
        </form>
      </section>
    </main>
  );
}

export default function AdminAccessPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const signOut = useSignOutAdmin();
  const [signOutError, setSignOutError] = useState("");
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
    <>
      <div className="flex items-center justify-end gap-3 border-b bg-background p-2">
        {accessQuery.data.canMutate === false && <span className="text-sm text-muted-foreground">Lecture seule</span>}
        {signOutError && <span role="alert" className="text-sm text-destructive">{signOutError}</span>}
        <Button size="sm" variant="outline" disabled={signOut.isPending} onClick={async () => {
          try {
            await signOut.mutateAsync();
            queryClient.clear();
            setLocation(adminRoute("/sign-in"));
          } catch (error) { setSignOutError(authErrorMessage(error)); }
        }}>Déconnexion administrateur</Button>
      </div>
      <Suspense fallback={<AdminPageLoading />}>
        <AdminRouter />
      </Suspense>
    </>
  );
}
