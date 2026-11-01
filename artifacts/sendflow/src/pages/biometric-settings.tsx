import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCustomerBiometricStatusQueryKey,
  useGetCustomerBiometricStatus,
  useRemoveCustomerBiometricCredentials,
} from "@workspace/api-client-react";
import { ArrowLeft, Fingerprint, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useSeo } from "@/lib/seo";
import { hasPlatformBiometricAuthenticator } from "@/lib/customer-biometric";
import biometricIllustration from "@/assets/sendflow-biometric-3d.webp";
import { getSafeApiErrorCopy } from "@/lib/safe-api-error";

function errorMessage(error: unknown, fallback: string) {
  return error ? getSafeApiErrorCopy(error).message : fallback;
}

export default function BiometricSettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const statusQuery = useGetCustomerBiometricStatus();
  const removeCredentials = useRemoveCustomerBiometricCredentials();
  const [platformAvailable, setPlatformAvailable] = useState(false);
  const [platformDetectionComplete, setPlatformDetectionComplete] = useState(false);
  const [illustrationFailed, setIllustrationFailed] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useSeo({
    path: "/biometric",
    locale: "fr",
    title: "Sécurité biométrique · SendFlow",
    description: "Consultez et désactivez le déverrouillage biométrique SendFlow.",
    robots: "noindex,nofollow",
  });

  useEffect(() => {
    let active = true;
    void hasPlatformBiometricAuthenticator().then((available) => {
      if (active) {
        setPlatformAvailable(available);
        setPlatformDetectionComplete(true);
      }
    }).catch(() => {
      if (active) {
        setPlatformAvailable(false);
        setPlatformDetectionComplete(true);
      }
    });
    return () => { active = false; };
  }, []);

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
  const checkingStatus = statusQuery.isLoading || statusQuery.isFetching;
  const canRenderDeviceState = !checkingStatus
    && !statusQuery.isError
    && platformDetectionComplete
    && statusQuery.data !== undefined;

  return (
    <main className="sendflow-biometric-page">
      <button type="button" className="sendflow-biometric-back" onClick={() => setLocation("/account")}>
        <ArrowLeft size={20} aria-hidden="true" />
        Retour au compte
      </button>
      <section className="sendflow-biometric-card" aria-labelledby="biometric-title">
        <div className="sendflow-biometric-hero" aria-hidden="true">
          <span className="sendflow-biometric-hero-glow" />
          {!illustrationFailed ? (
            <img
              className="sendflow-biometric-illustration"
              src={biometricIllustration}
              alt=""
              decoding="async"
              fetchPriority="high"
              onError={() => setIllustrationFailed(true)}
            />
          ) : (
            <span className="sendflow-biometric-hero-fallback">
              {enabled ? <ShieldCheck size={52} /> : <Fingerprint size={52} />}
            </span>
          )}
          <span className="sendflow-biometric-hero-badge">
            <ShieldCheck size={16} aria-hidden="true" />
            Protection biométrique
          </span>
        </div>
        <h1 id="biometric-title">Sécurité biométrique</h1>
        <p className="sendflow-biometric-description">
          Consultez l’état du déverrouillage biométrique associé à votre compte. Votre code PIN reste toujours disponible.
        </p>

        {(checkingStatus || (!statusQuery.isError && !platformDetectionComplete)) && (
          <p role="status">Vérification de l’appareil…</p>
        )}
        {statusQuery.isError && !checkingStatus && (
          <p className="sendflow-biometric-message" role="alert">
            Le statut biométrique n’a pas pu être chargé. Réessayez.
            <button type="button" onClick={() => void statusQuery.refetch()}>Réessayer</button>
          </p>
        )}
        {canRenderDeviceState && enabled && (
          <>
            <p className="sendflow-biometric-status is-enabled">
              Activé · {statusQuery.data?.credentialCount ?? 0} appareil(s) associé(s)
            </p>
            <p className="sendflow-biometric-note">
              Votre appareil vérifie la biométrie. SendFlow reçoit uniquement une preuve cryptographique, jamais votre empreinte.
            </p>
            <button type="button" className="sendflow-biometric-action is-secondary" onClick={() => void disableBiometric()} disabled={working}>
              {working ? "Traitement…" : "Désactiver sur tous les appareils"}
            </button>
          </>
        )}
        {canRenderDeviceState && !enabled && !platformAvailable && (
          <p className="sendflow-biometric-message">
            Cet appareil, ce navigateur ou cette application ne prend pas en charge l’authentification biométrique sécurisée. Vous pouvez toujours utiliser votre code PIN.
          </p>
        )}
        {canRenderDeviceState && !enabled && platformAvailable && (
          <>
            <p className="sendflow-biometric-status">Désactivé</p>
            <p className="sendflow-biometric-note">
              L’activation vous sera proposée après chaque déverrouillage PIN réussi sur un appareil compatible. Vous pourrez choisir « Plus tard » sans bloquer la connexion.
            </p>
          </>
        )}
        {message && <p className="sendflow-biometric-message" role="status">{message}</p>}
      </section>
    </main>
  );
}
