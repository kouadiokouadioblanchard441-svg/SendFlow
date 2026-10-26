import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCustomerBiometricStatusQueryKey,
  useGetCustomerBiometricStatus,
  useRemoveCustomerBiometricCredentials,
  useStartCustomerBiometricRegistration,
  useVerifyCustomerBiometricRegistration,
} from "@workspace/api-client-react";
import { ArrowLeft, Fingerprint, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useSeo } from "@/lib/seo";
import {
  createPlatformBiometricCredential,
  hasPlatformBiometricAuthenticator,
} from "@/lib/customer-biometric";

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: { error?: unknown } }).data;
    if (typeof data?.error === "string") return data.error;
  }
  return fallback;
}

export default function BiometricSettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const statusQuery = useGetCustomerBiometricStatus();
  const startRegistration = useStartCustomerBiometricRegistration();
  const verifyRegistration = useVerifyCustomerBiometricRegistration();
  const removeCredentials = useRemoveCustomerBiometricCredentials();
  const [platformAvailable, setPlatformAvailable] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useSeo({
    path: "/biometric",
    locale: "fr",
    title: "Déverrouillage biométrique · SendFlow",
    description: "Activez ou désactivez le déverrouillage biométrique SendFlow sur cet appareil.",
    robots: "noindex,nofollow",
  });

  useEffect(() => {
    let active = true;
    void hasPlatformBiometricAuthenticator().then((available) => {
      if (active) setPlatformAvailable(available);
    });
    return () => { active = false; };
  }, []);

  const enableBiometric = async () => {
    setWorking(true);
    setMessage("");
    try {
      const registration = await startRegistration.mutateAsync();
      const credential = await createPlatformBiometricCredential(registration.options);
      if (!credential) throw new Error("L’appareil n’a pas renvoyé de preuve biométrique.");
      const status = await verifyRegistration.mutateAsync({
        data: { challengeId: registration.challengeId, credential },
      });
      queryClient.setQueryData(getGetCustomerBiometricStatusQueryKey(), status);
      setMessage("Le déverrouillage biométrique est activé sur cet appareil.");
    } catch (error) {
      setMessage(errorMessage(error, "Impossible d’activer la biométrie. Vérifiez le verrouillage de votre appareil et réessayez."));
    } finally {
      setWorking(false);
    }
  };

  const disableBiometric = async () => {
    if (!window.confirm("Désactiver le déverrouillage biométrique sur tous vos appareils ?")) return;
    setWorking(true);
    setMessage("");
    try {
      const status = await removeCredentials.mutateAsync();
      queryClient.setQueryData(getGetCustomerBiometricStatusQueryKey(), status);
      setMessage("Le déverrouillage biométrique a été désactivé.");
    } catch (error) {
      setMessage(errorMessage(error, "Impossible de désactiver la biométrie pour le moment."));
    } finally {
      setWorking(false);
    }
  };

  const enabled = Boolean(statusQuery.data?.enabled);

  return (
    <main className="sendflow-biometric-page">
      <button type="button" className="sendflow-biometric-back" onClick={() => setLocation("/account")}>
        <ArrowLeft size={20} aria-hidden="true" />
        Retour au compte
      </button>
      <section className="sendflow-biometric-card" aria-labelledby="biometric-title">
        <span className="sendflow-biometric-icon" aria-hidden="true">
          {enabled ? <ShieldCheck size={35} /> : <Fingerprint size={38} />}
        </span>
        <h1 id="biometric-title">Déverrouillage biométrique</h1>
        <p className="sendflow-biometric-description">
          Utilisez l’empreinte ou la biométrie de votre téléphone pour ouvrir votre session SendFlow sans saisir votre PIN.
        </p>

        {statusQuery.isLoading && <p role="status">Vérification de l’appareil…</p>}
        {statusQuery.isError && (
          <p className="sendflow-biometric-message" role="alert">
            Le statut biométrique n’a pas pu être chargé. Réessayez.
            <button type="button" onClick={() => void statusQuery.refetch()}>Réessayer</button>
          </p>
        )}
        {!statusQuery.isLoading && !statusQuery.isError && !platformAvailable && (
          <p className="sendflow-biometric-message">
            Cet appareil, ce navigateur ou cette application ne prend pas en charge l’authentification biométrique sécurisée. Vous pouvez toujours utiliser votre code PIN.
          </p>
        )}
        {!statusQuery.isLoading && !statusQuery.isError && platformAvailable && (
          <>
            <p className={`sendflow-biometric-status${enabled ? " is-enabled" : ""}`}>
              {enabled
                ? `Activé · ${statusQuery.data?.credentialCount ?? 0} appareil(s) associé(s)`
                : "Désactivé"}
            </p>
            <p className="sendflow-biometric-note">
              L’activation nécessite votre session PIN déjà déverrouillée et une validation biométrique sur cet appareil. Votre PIN restera disponible en secours.
            </p>
            {enabled ? (
              <button type="button" className="sendflow-biometric-action is-secondary" onClick={() => void disableBiometric()} disabled={working}>
                {working ? "Traitement…" : "Désactiver la biométrie"}
              </button>
            ) : (
              <button type="button" className="sendflow-biometric-action" onClick={() => void enableBiometric()} disabled={working}>
                <Fingerprint size={20} aria-hidden="true" />
                {working ? "Activation…" : "Activer la biométrie"}
              </button>
            )}
          </>
        )}
        {message && <p className="sendflow-biometric-message" role="status">{message}</p>}
      </section>
    </main>
  );
}
