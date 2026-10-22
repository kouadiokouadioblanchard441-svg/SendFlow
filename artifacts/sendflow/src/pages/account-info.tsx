import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminAccessStatusQueryKey,
  getGetCurrentAccountQueryKey,
  getGetCustomerProfileQueryKey,
  useGetAdminAccessStatus,
  useGetCurrentAccount,
  useGetCustomerProfile,
  useUpdateCustomerProfile,
} from '@workspace/api-client-react';
import { ArrowLeft, CalendarDays, Check, ShieldCheck } from 'lucide-react';
import { Redirect, useLocation } from 'wouter';
import { AdminPinDialog } from '@/components/admin-pin-dialog';
import { getAdultBirthDateLimit, MIN_BIRTH_DATE } from '@/lib/auth-validation';
import { readAccountCountry } from '@/lib/account-country';
import { clearLegacyAccountProfile, type AccountProfile } from '@/lib/account-profile';
import { ADMIN_ROUTE_PATH } from '@/lib/admin-route';
import { useSeo } from '@/lib/seo';
import accountInfoIllustration from '@assets/generated_images/sendflow-account-info-profile-3d-transparent.png';

type AccountProfileField = keyof AccountProfile;
type AccountProfileErrors = Partial<Record<AccountProfileField, string>>;

function validateProfile(profile: AccountProfile): AccountProfileErrors {
  const errors: AccountProfileErrors = {};
  const lastName = profile.lastName.trim().replace(/\s+/g, ' ');
  const firstName = profile.firstName.trim().replace(/\s+/g, ' ');

  if (!lastName) {
    errors.lastName = 'Le nom est requis.';
  } else if (lastName.length < 2 || !/\p{L}/u.test(lastName)) {
    errors.lastName = 'Saisissez un nom valide.';
  }

  if (!firstName) {
    errors.firstName = 'Le prénom est requis.';
  } else if (firstName.length < 2 || !/\p{L}/u.test(firstName)) {
    errors.firstName = 'Saisissez un prénom valide.';
  }
  if (`${firstName} ${lastName}`.length > 120) {
    errors.lastName = 'Le nom complet ne peut pas dépasser 120 caractères.';
  }

  if (!profile.birthDate) {
    errors.birthDate = 'La date de naissance est requise.';
  } else if (
    !/^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate)
    || profile.birthDate < MIN_BIRTH_DATE
    || profile.birthDate > getAdultBirthDateLimit()
  ) {
    errors.birthDate = profile.birthDate > getAdultBirthDateLimit()
      ? 'Vous devez avoir au moins 18 ans.'
      : 'Saisissez une date de naissance valide.';
  } else {
    const [year, month, day] = profile.birthDate.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    if (
      parsedDate.getFullYear() !== year
      || parsedDate.getMonth() !== month - 1
      || parsedDate.getDate() !== day
    ) {
      errors.birthDate = 'Saisissez une date de naissance valide.';
    }
  }

  return errors;
}

function ProfileField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  autoComplete: string;
}) {
  return (
    <div className="sendflow-account-info-control">
      <span className="sendflow-account-info-field-label">{label}</span>
      <label className={`sendflow-account-info-field${error ? ' has-error' : ''}`} htmlFor={id}>
        <span className="sr-only">{label}</span>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={label}
          autoComplete={autoComplete}
          maxLength={80}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          required
        />
      </label>
      {error && <p id={`${id}-error`} className="sendflow-account-info-error" role="alert">{error}</p>}
    </div>
  );
}

export default function AccountInfoPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const isUnlocked = window.sessionStorage.getItem('sendflow.pin.unlocked') === 'true';
  const adminAccessQuery = useGetAdminAccessStatus({
    query: {
      queryKey: getGetAdminAccessStatusQueryKey(),
      enabled: isUnlocked,
      retry: false,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    },
  });
  const accountQuery = useGetCurrentAccount({
    query: {
      queryKey: getGetCurrentAccountQueryKey(),
      enabled: isUnlocked,
      retry: false,
    },
  });
  const profileQuery = useGetCustomerProfile({
    query: {
      queryKey: getGetCustomerProfileQueryKey(),
      enabled: isUnlocked,
      retry: false,
      refetchOnMount: 'always',
    },
  });
  const updateProfileMutation = useUpdateCustomerProfile();
  const [adminPinOpen, setAdminPinOpen] = useState(false);
  const accountCountry = readAccountCountry();
  const [form, setForm] = useState<AccountProfile>({
    lastName: '',
    firstName: '',
    birthDate: '',
  });
  const hasEditedProfile = useRef(false);
  const [touched, setTouched] = useState<Partial<Record<AccountProfileField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [requestError, setRequestError] = useState('');

  useEffect(() => {
    clearLegacyAccountProfile();
  }, []);

  useEffect(() => {
    if (!profileQuery.data || hasEditedProfile.current) return;
    setForm({
      firstName: profileQuery.data.firstName,
      lastName: profileQuery.data.lastName,
      birthDate: profileQuery.data.birthDate ?? '',
    });
  }, [profileQuery.data]);

  useSeo({
    path: '/account-info',
    locale: 'fr',
    title: 'Informations du compte · SendFlow',
    description: 'Modifiez les informations de votre compte SendFlow.',
    robots: 'noindex,nofollow',
  });

  const errors = useMemo(() => validateProfile(form), [form]);
  const canSubmit = Object.keys(errors).length === 0
    && Boolean(accountQuery.data?.userId)
    && profileQuery.isSuccess
    && !updateProfileMutation.isPending;
  const visibleError = (field: AccountProfileField) =>
    (submitAttempted || touched[field]) ? errors[field] : undefined;

  if (!isUnlocked) return <Redirect to="/sign-in" />;

  const update = <K extends AccountProfileField>(key: K, value: AccountProfile[K]) => {
    hasEditedProfile.current = true;
    setSaved(false);
    setRequestError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (!canSubmit) return;

    const normalizedProfile: AccountProfile = {
      lastName: form.lastName.trim().replace(/\s+/g, ' '),
      firstName: form.firstName.trim().replace(/\s+/g, ' '),
      birthDate: form.birthDate,
    };
    setRequestError('');
    try {
      const savedProfile = await updateProfileMutation.mutateAsync({
        data: normalizedProfile,
      });
      const updatedForm = {
        firstName: savedProfile.firstName,
        lastName: savedProfile.lastName,
        birthDate: savedProfile.birthDate ?? '',
      };
      queryClient.setQueryData(getGetCustomerProfileQueryKey(), savedProfile);
      await queryClient.invalidateQueries({
        queryKey: getGetCurrentAccountQueryKey(),
      });
      hasEditedProfile.current = false;
      setForm(updatedForm);
      setSaved(true);
    } catch {
      setRequestError('Impossible d’enregistrer vos informations. Réessayez.');
    }
  };

  return (
    <main className="sendflow-account-info-shell">
      <section className="sendflow-account-info-page" aria-labelledby="account-info-title">
        <div className="sendflow-account-info-illustration" aria-hidden="true">
          <img src={accountInfoIllustration} alt="" />
        </div>
        <header className="sendflow-account-info-header">
          <button
            type="button"
            className="sendflow-account-info-back"
            onClick={() => setLocation('/account')}
            aria-label="Retour au compte"
            data-testid="button-account-info-back"
          >
            <ArrowLeft size={23} strokeWidth={2} aria-hidden="true" />
          </button>
          <h1 id="account-info-title">Information de compte</h1>
        </header>

        <div className="sendflow-account-info-content">
          <h2>Modifier vos informations</h2>

          <form onSubmit={handleSubmit} noValidate>
            {profileQuery.isLoading && (
              <p className="sendflow-account-info-hint" role="status">Chargement de vos informations…</p>
            )}
            {profileQuery.isError && (
              <p className="sendflow-account-info-error" role="alert">
                Vos informations ne sont pas disponibles. Actualisez la page pour réessayer.
              </p>
            )}
            <ProfileField
              id="account-info-last-name"
              label="Nom"
              value={form.lastName}
              onChange={(value) => update('lastName', value)}
              onBlur={() => setTouched((current) => ({ ...current, lastName: true }))}
              error={visibleError('lastName')}
              autoComplete="family-name"
            />

            <ProfileField
              id="account-info-first-name"
              label="Prénom"
              value={form.firstName}
              onChange={(value) => update('firstName', value)}
              onBlur={() => setTouched((current) => ({ ...current, firstName: true }))}
              error={visibleError('firstName')}
              autoComplete="given-name"
            />

            <div className="sendflow-account-info-control">
              <span className="sendflow-account-info-field-label">Pays</span>
              <div className="sendflow-account-info-field sendflow-account-info-country" aria-label={`Pays : ${accountCountry.name}`}>
                <span className="sendflow-account-info-country-flag" aria-hidden="true">{accountCountry.flag}</span>
                <span>{accountCountry.name}</span>
              </div>
              <p className="sendflow-account-info-hint">Pays associé à votre compte</p>
            </div>

            <div className="sendflow-account-info-control">
              <span className="sendflow-account-info-field-label">Quelle est votre date de naissance ?</span>
              <label className={`sendflow-account-info-field sendflow-account-info-date${visibleError('birthDate') ? ' has-error' : ''}`} htmlFor="account-info-birth-date">
                <span className="sr-only">Quelle est votre date de naissance ?</span>
                <input
                  id="account-info-birth-date"
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => update('birthDate', event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, birthDate: true }))}
                  min={MIN_BIRTH_DATE}
                  max={getAdultBirthDateLimit()}
                  autoComplete="bday"
                  aria-label="Quelle est votre date de naissance ?"
                  aria-invalid={Boolean(visibleError('birthDate'))}
                  aria-describedby={visibleError('birthDate') ? 'account-info-birth-date-error' : undefined}
                  required
                />
                <CalendarDays size={20} aria-hidden="true" />
              </label>
              {visibleError('birthDate') && <p id="account-info-birth-date-error" className="sendflow-account-info-error" role="alert">{visibleError('birthDate')}</p>}
            </div>

            <button
              type="submit"
              className="sendflow-account-info-submit"
              disabled={!canSubmit}
              aria-busy={updateProfileMutation.isPending}
              data-testid="button-account-info-update"
            >
              {updateProfileMutation.isPending
                ? 'Enregistrement…'
                : saved
                  ? <><Check size={19} strokeWidth={2.4} /> Informations mises à jour</>
                  : 'Mettre à jour'}
            </button>
            <p className={`sendflow-account-info-status${saved ? ' is-visible' : ''}`} role="status" aria-live="polite">
              {saved ? 'Vos informations sont enregistrées sur votre compte.' : ''}
            </p>
            {requestError && <p className="sendflow-account-info-error" role="alert">{requestError}</p>}
          </form>
          {adminAccessQuery.data?.isAdmin === true && (
            <section className="mt-6 space-y-2" aria-label="Accès administrateur">
              <button
                type="button"
                className="sendflow-account-info-submit"
                onClick={() => setAdminPinOpen(true)}
                data-testid="button-open-admin"
              >
                <ShieldCheck size={18} aria-hidden="true" />
                Espace administrateur
              </button>
              <p className="sendflow-account-info-hint">
                Accès réservé au compte administrateur.
              </p>
              <AdminPinDialog
                open={adminPinOpen}
                onOpenChange={setAdminPinOpen}
                onUnlocked={async () => {
                  await queryClient.invalidateQueries({
                    queryKey: getGetAdminAccessStatusQueryKey(),
                  });
                  setLocation(ADMIN_ROUTE_PATH);
                }}
              />
            </section>
          )}
        </div>
      </section>
    </main>
  );
}