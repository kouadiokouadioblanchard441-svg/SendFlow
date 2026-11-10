import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminAccessStatusQueryKey,
  useGetAdminAccessStatus,
} from "@workspace/api-client-react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageLoadingScreen from "@/components/page-loading-screen";
import { ADMIN_API_PATH_PREFIX, adminApiRoute } from "@/lib/admin-route";
import { setAdminApiPathPrefix, setAdminStepUpHandler } from "@/lib/admin-step-up";
import { resolveApiUrl, fetchWithCsrf } from "@workspace/api-client-react";
import { useSeo } from "@/lib/seo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const AdminRouter = lazy(() => import("@/pages/admin").then((module) => ({
  default: module.AdminRouter,
})));

const genericLoginError = "Connexion impossible. Vérifiez vos informations et réessayez.";

async function postAdminAuthAction(path: string, body?: unknown) {
  return fetchWithCsrf(resolveApiUrl(adminApiRoute(path)), {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function AdministratorSetup({ onComplete }: { onComplete: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const startEnrollment = async () => {
    setMessage("");
    setSubmitting(true);
    try {
      const response = await postAdminAuthAction("/setup/start", {});
      const result = await response.json() as {
        challengeId?: unknown;
        totpSecret?: unknown;
      };
      if (!response.ok || typeof result.challengeId !== "string"
        || typeof result.totpSecret !== "string" || !/^[A-Z2-7]{32}$/u.test(result.totpSecret)) {
        setMessage(response.status === 409
          ? "Le compte administrateur a déjà été initialisé."
          : response.status === 429
            ? "Trop de demandes. Réessayez plus tard."
            : "Impossible de démarrer l’enrôlement sécurisé.");
        return;
      }
      setChallengeId(result.challengeId);
      setTotpSecret(result.totpSecret);
      setCopied(false);
    } catch {
      setMessage("Le service d’initialisation est momentanément indisponible.");
    } finally {
      setSubmitting(false);
    }
  };

  const completeEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    if (password.length < 12 || password !== repeatPassword) {
      setMessage("Utilisez un mot de passe d’au moins 12 caractères et confirmez-le correctement.");
      return;
    }
    if (!challengeId || !/^[0-9]{6}$/u.test(totpCode)) {
      setMessage("Scannez le QR code puis saisissez le code à six chiffres affiché.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await postAdminAuthAction("/setup/complete", {
        challengeId,
        email,
        password,
        totpCode,
      });
      const result = await response.json() as { recoveryCodes?: unknown };
      if (!response.ok || !Array.isArray(result.recoveryCodes)
        || !result.recoveryCodes.every((code) => typeof code === "string")) {
        setTotpCode("");
        setMessage(response.status === 409
          ? "L’initialisation n’est plus disponible."
          : response.status === 429
            ? "Trop de tentatives. Recommencez l’enrôlement plus tard."
            : "Le code n’a pas été accepté. Vérifiez l’heure de votre téléphone puis réessayez.");
        return;
      }
      setPassword("");
      setRepeatPassword("");
      setTotpCode("");
      setRecoveryCodes(result.recoveryCodes as string[]);
      setChallengeId("");
      setTotpSecret("");
      setCopied(false);
    } catch {
      setMessage("Le service d’initialisation est momentanément indisponible.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyTotpSecret = async () => {
    try {
      await navigator.clipboard.writeText(totpSecret);
      setCopied(true);
    } catch {
      setMessage("La copie automatique est indisponible. Sélectionnez et copiez la clé affichée.");
    }
  };

  if (recoveryCodes.length > 0) {
    return (
      <main className="min-h-screen bg-[#f7f7fb] px-4 py-10 sm:grid sm:place-items-center">
        <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold text-slate-950">Compte administrateur créé</h1>
          <p className="my-4 text-sm leading-6 text-slate-700">
            Enregistrez ces codes de récupération hors ligne. Ils ne seront affichés qu’une seule fois.
          </p>
          <ul className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-4 font-mono text-sm">
            {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
          </ul>
          <Button className="mt-6 w-full bg-violet-700 hover:bg-violet-800" onClick={onComplete}>
            J’ai enregistré les codes
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-10 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-xl bg-violet-100 text-violet-700">
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">SendFlow</p>
            <h1 className="text-xl font-semibold text-slate-950">Initialiser le compte unique</h1>
          </div>
        </div>
        <p className="mb-5 text-sm leading-6 text-slate-600">
          Cette étape n’est disponible que tant qu’aucun compte administrateur n’existe.
          Le mot de passe et le premier code Google Authenticator sont envoyés directement au serveur.
        </p>
        <form onSubmit={completeEnrollment} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="setup-admin-email">Adresse e-mail</Label>
            <Input id="setup-admin-email" type="email" autoComplete="email" maxLength={254}
              value={email} onChange={(event) => setEmail(event.target.value)} required disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-admin-password">Mot de passe (12 caractères minimum)</Label>
            <Input id="setup-admin-password" type="password" autoComplete="new-password" minLength={12}
              maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)}
              required disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-admin-password-repeat">Confirmer le mot de passe</Label>
            <Input id="setup-admin-password-repeat" type="password" autoComplete="new-password"
              maxLength={1024} value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)} required disabled={submitting} />
          </div>
          {!challengeId ? (
            <Button type="button" className="w-full bg-violet-700 hover:bg-violet-800"
              disabled={submitting || !email || password.length < 12 || password !== repeatPassword}
              onClick={() => void startEnrollment()}>
              {submitting ? "Préparation…" : "Configurer Google Authenticator"}
            </Button>
          ) : (
            <>
              <div className="rounded-lg border border-slate-200 p-4 text-center">
                <p className="mb-3 text-sm text-slate-700">
                  Dans Google Authenticator, choisissez l’ajout par clé de configuration, puis copiez cette clé.
                </p>
                <code className="block select-all break-all rounded-md bg-slate-100 p-3 text-left font-mono text-sm text-slate-900">
                  {totpSecret}
                </code>
                <Button type="button" variant="outline" className="mt-3"
                  onClick={() => void copyTotpSecret()}>
                  {copied ? "Clé copiée" : "Copier la clé"}
                </Button>
                <p className="mt-3 text-xs text-slate-500">
                  Cette clé temporaire disparaît après validation ou expiration de l’enrôlement.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-admin-totp">Code à six chiffres</Label>
                <Input id="setup-admin-totp" inputMode="numeric" autoComplete="one-time-code"
                  pattern="[0-9]{6}" maxLength={6} value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/gu, "").slice(0, 6))}
                  required disabled={submitting} />
              </div>
              <Button type="submit" className="w-full bg-violet-700 hover:bg-violet-800"
                disabled={submitting || totpCode.length !== 6}>
                {submitting ? "Vérification…" : "Créer le compte"}
              </Button>
            </>
          )}
          {message && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {message}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}

function AdministratorLogin() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stepUpRequest, setStepUpRequest] = useState<{
    action: string;
    query: Record<string, unknown>;
    payload: unknown;
  } | null>(null);
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpMessage, setStepUpMessage] = useState("");
  const [stepUpSubmitting, setStepUpSubmitting] = useState(false);
  const [setupAvailable, setSetupAvailable] = useState<boolean | null>(null);
  const [setupStatusError, setSetupStatusError] = useState(false);
  const stepUpResolver = useRef<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  } | null>(null);

  useSeo({
    path: "/",
    locale: "fr",
    title: "Connexion administrateur",
    description: "Connexion sécurisée à l’espace administrateur.",
    robots: "noindex,nofollow",
  });

  const accessQuery = useGetAdminAccessStatus({
    query: {
      queryKey: getGetAdminAccessStatusQueryKey(),
      enabled: true,
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
    },
  });
  const authenticated = accessQuery.data?.isAdmin === true
    && accessQuery.data?.sessionAuthenticated === true;

  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const response = await fetch(resolveApiUrl(adminApiRoute("/setup-status")), {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Setup status unavailable");
        const result = await response.json() as { setupAvailable?: unknown };
        if (!stopped && typeof result.setupAvailable === "boolean") {
          setSetupAvailable(result.setupAvailable);
        } else if (!stopped) {
          setSetupStatusError(true);
        }
      } catch {
        if (!stopped) setSetupStatusError(true);
      }
    })();
    return () => { stopped = true; };
  }, []);

  useEffect(() => {
    setAdminApiPathPrefix(ADMIN_API_PATH_PREFIX);
    setAdminStepUpHandler((request) => new Promise((resolve, reject) => {
      if (stepUpResolver.current) {
        reject(new Error("Another administrator confirmation is pending."));
        return;
      }
      stepUpResolver.current = { resolve, reject };
      setStepUpRequest(request);
      setStepUpCode("");
      setStepUpMessage("");
    }));
    return () => {
      setAdminStepUpHandler(null);
      setAdminApiPathPrefix(null);
      stepUpResolver.current?.reject(new Error("Administrator confirmation was cancelled."));
      stepUpResolver.current = null;
    };
  }, []);

  const refreshSession = async () => {
    const response = await postAdminAuthAction("/refresh");
    if (!response.ok) {
      await queryClient.invalidateQueries({ queryKey: getGetAdminAccessStatusQueryKey() });
      return false;
    }
    await queryClient.invalidateQueries({ queryKey: getGetAdminAccessStatusQueryKey() });
    return true;
  };

  useEffect(() => {
    if (!authenticated) return;
    let stopped = false;
    const refreshIfVisible = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        await refreshSession();
      } catch {
        if (!stopped) await queryClient.invalidateQueries({ queryKey: getGetAdminAccessStatusQueryKey() });
      }
    };
    const interval = window.setInterval(() => void refreshIfVisible(), 4 * 60 * 1000);
    const onUserActivity = (event: Event) => {
      if (!event.isTrusted || stopped) return;
      const now = Date.now();
      if (now - lastActivityAt.current < 60_000) return;
      lastActivityAt.current = now;
      void (async () => {
        try {
          let response = await postAdminAuthAction("/activity");
          if (response.status === 401) {
            const refreshed = await refreshSession();
            if (refreshed) response = await postAdminAuthAction("/activity");
          }
          if (!response.ok) {
            await queryClient.invalidateQueries({ queryKey: getGetAdminAccessStatusQueryKey() });
          }
        } catch {
          await queryClient.invalidateQueries({ queryKey: getGetAdminAccessStatusQueryKey() });
        }
      })();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshIfVisible();
    };
    document.addEventListener("pointerdown", onUserActivity, { passive: true });
    document.addEventListener("keydown", onUserActivity);
    document.addEventListener("touchstart", onUserActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("pointerdown", onUserActivity);
      document.removeEventListener("keydown", onUserActivity);
      document.removeEventListener("touchstart", onUserActivity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authenticated, queryClient]);

  const lastActivityAt = useRef(0);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    try {
      const response = await postAdminAuthAction("/sign-in", { email, password, totpCode });
      if (!response.ok) {
        setPassword("");
        setTotpCode("");
        setMessage(response.status === 429
          ? "Trop de tentatives. Attendez avant de réessayer."
          : genericLoginError);
        return;
      }
      setPassword("");
      setTotpCode("");
      lastActivityAt.current = Date.now();
      await queryClient.invalidateQueries({ queryKey: getGetAdminAccessStatusQueryKey() });
    } catch {
      setMessage("Service indisponible. Réessayez dans quelques instants.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmStepUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stepUpRequest || !/^[0-9]{6}$/u.test(stepUpCode)) {
      setStepUpMessage("Saisissez un code valide à six chiffres.");
      return;
    }
    setStepUpSubmitting(true);
    setStepUpMessage("");
    try {
      const response = await postAdminAuthAction("/step-up", {
        totpCode: stepUpCode,
        action: stepUpRequest.action,
        query: stepUpRequest.query,
        payload: stepUpRequest.payload,
      });
      if (!response.ok) {
        setStepUpCode("");
        setStepUpMessage(response.status === 429
          ? "Trop de tentatives. Attendez avant de réessayer."
          : "Le code n’a pas été accepté. Vérifiez-le puis réessayez.");
        return;
      }
      const result = await response.json() as { stepUpToken?: unknown };
      if (typeof result.stepUpToken !== "string") {
        throw new Error("Invalid administrator confirmation response.");
      }
      const resolver = stepUpResolver.current;
      stepUpResolver.current = null;
      setStepUpRequest(null);
      setStepUpCode("");
      resolver?.resolve(result.stepUpToken);
    } catch {
      setStepUpCode("");
      setStepUpMessage("La confirmation de sécurité est indisponible. Réessayez.");
    } finally {
      setStepUpSubmitting(false);
    }
  };

  const cancelStepUp = () => {
    const resolver = stepUpResolver.current;
    stepUpResolver.current = null;
    setStepUpRequest(null);
    setStepUpCode("");
    resolver?.reject(new Error("Administrator confirmation was cancelled."));
  };

  if (accessQuery.isLoading || (authenticated && accessQuery.isFetching)
    || (!authenticated && setupAvailable === null && !setupStatusError)) {
    return <PageLoadingScreen label="Vérification de la session administrateur" />;
  }

  if (!authenticated && setupStatusError) {
    return (
      <main className="min-h-screen bg-[#f7f7fb] px-4 py-10 sm:grid sm:place-items-center">
        <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold text-slate-950">Service indisponible</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Impossible de vérifier l’état du compte administrateur. Réessayez plus tard.
          </p>
        </section>
      </main>
    );
  }

  return (
    <>
    {authenticated ? (
      <Suspense fallback={<PageLoadingScreen label="Chargement du panel administrateur" />}>
        <AdminRouter />
      </Suspense>
    ) : setupAvailable ? (
      <AdministratorSetup onComplete={() => setSetupAvailable(false)} />
    ) : (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-10 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-xl bg-violet-100 text-violet-700">
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">SendFlow</p>
            <h1 className="text-xl font-semibold text-slate-950">Connexion administrateur</h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-6 text-slate-600">
          Saisissez votre adresse administrateur, votre mot de passe et le code à six chiffres de votre application d’authentification.
        </p>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Adresse e-mail</Label>
            <Input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Mot de passe</Label>
            <Input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={1024}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-totp">Code Google Authenticator</Label>
            <Input
              id="admin-totp"
              name="totpCode"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value.replace(/\D/gu, "").slice(0, 6))}
              required
              disabled={submitting}
            />
          </div>

          {message && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {message}
            </p>
          )}
          {accessQuery.isError && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
              Le service de connexion est momentanément indisponible.
            </p>
          )}

          <Button type="submit" className="w-full bg-violet-700 hover:bg-violet-800" disabled={submitting}>
            {submitting ? "Vérification…" : "Connexion sécurisée"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          L’accès est réservé au compte administrateur autorisé.
        </p>
      </section>
    </main>
    )}
    <Dialog open={Boolean(stepUpRequest)} onOpenChange={(open) => { if (!open && !stepUpSubmitting) cancelStepUp(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmer l’action</DialogTitle>
          <DialogDescription>
            Saisissez un nouveau code Google Authenticator. Le code sera lié à cette action précise et utilisé une seule fois.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={confirmStepUp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-step-up-code">Code à six chiffres</Label>
            <Input
              id="admin-step-up-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={stepUpCode}
              onChange={(event) => setStepUpCode(event.target.value.replace(/\D/gu, "").slice(0, 6))}
              disabled={stepUpSubmitting}
              required
            />
          </div>
          {stepUpMessage && <p className="text-sm text-destructive" role="alert">{stepUpMessage}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelStepUp} disabled={stepUpSubmitting}>Annuler</Button>
            <Button type="submit" disabled={stepUpSubmitting || stepUpCode.length !== 6}>
              {stepUpSubmitting ? "Vérification…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default function AdminAccessPage() {
  return <AdministratorLogin />;
}
