import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminCountriesQueryKey, getGetAdminOperatorPricingQueryKey,
  getGetAdminPaymentRoutingQueryKey, getGetAuthCountriesQueryKey,
  getGetAuthRegistrationCountriesQueryKey, getGetPublicPricingQueryKey,
  getGetRegistrationSettingsQueryKey,
  useCreateAdminCountry, useDeleteAdminCountry, useGetAdminAccessStatus, useGetAdminCountries,
  useUpdateAdminCountry, type AdminCountry, type CountryOperationFlags, type ManagedOperatorBrand,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const operationLabels = [
  ['deposit', 'Dépôt'], ['interNetwork', 'Inter réseau'], ['international', 'International / retrait'],
] as const;
type InitialOperatorDraft = { name: string; brand: ManagedOperatorBrand };
const emptyForm = {
  countryCode: '', countryName: '', phonePrefix: '+', minPhoneDigits: '', maxPhoneDigits: '',
  enabled: false, signupEnabled: false,
  operations: { deposit: false, interNetwork: false, international: false } as CountryOperationFlags,
  initialOperators: [] as InitialOperatorDraft[], reason: '',
};

export function AdminCountriesSection() {
  const access = useGetAdminAccessStatus();
  const canMutate = access.data?.canMutate === true;
  const query = useGetAdminCountries();
  const cache = useQueryClient();
  const create = useCreateAdminCountry();
  const update = useUpdateAdminCountry();
  const remove = useDeleteAdminCountry();
  const [open, setOpen] = useState(false);
  const [countryToDelete, setCountryToDelete] = useState<AdminCountry | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [countryToToggleSignup, setCountryToToggleSignup] = useState<AdminCountry | null>(null);
  const [signupReason, setSignupReason] = useState('');
  const [signupError, setSignupError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminCountry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const busy = create.isPending || update.isPending || remove.isPending;

  const openForm = (country: AdminCountry | null) => {
    setSelected(country);
    setError('');
    setForm(country ? {
      countryCode: country.countryCode, countryName: country.countryName, phonePrefix: country.phonePrefix,
      minPhoneDigits: String(country.minPhoneDigits), maxPhoneDigits: String(country.maxPhoneDigits),
      enabled: country.enabled, signupEnabled: country.signupEnabled,
      operations: { ...country.operations }, initialOperators: [], reason: '',
    } : { ...emptyForm, operations: { ...emptyForm.operations } });
    setOpen(true);
  };

  const save = async () => {
    const min = Number(form.minPhoneDigits), max = Number(form.maxPhoneDigits);
    if (!/^[a-z]{2}$/.test(form.countryCode) || !/^\+[1-9][0-9]{0,3}$/.test(form.phonePrefix)
      || form.countryName.trim().length < 2 || form.reason.trim().length < 3
      || !form.minPhoneDigits || !form.maxPhoneDigits
      || !Number.isInteger(min) || !Number.isInteger(max) || min < 4 || max < min
      || max + form.phonePrefix.length - 1 > 15) {
      setError('Vérifiez le code pays, l’indicatif, les longueurs de numéro et le motif.');
      return;
    }
    const initialOperators = form.initialOperators
      .filter((operator) => operator.name.trim().length > 0)
      .map((operator) => ({ name: operator.name.trim(), brand: operator.brand }));
    if (form.initialOperators.some((operator) => operator.name.trim().length > 0
      && operator.name.trim().length < 2)) {
      setError('Chaque nom d’opérateur doit contenir au moins deux caractères.');
      return;
    }
    setError('');
    const common = {
      countryName: form.countryName.trim(), phonePrefix: form.phonePrefix,
      minPhoneDigits: min, maxPhoneDigits: max, enabled: form.enabled, reason: form.reason.trim(),
    };
    try {
      if (selected) {
        await update.mutateAsync({ countryCode: selected.countryCode, data: {
          ...common, signupEnabled: form.signupEnabled, operations: form.operations, expectedVersion: selected.version,
        } });
      } else {
        await create.mutateAsync({ data: {
          ...common, countryCode: form.countryCode, initialOperators,
        } });
      }
      await Promise.all([
        getGetAdminCountriesQueryKey(), getGetAuthCountriesQueryKey(), getGetPublicPricingQueryKey(),
        getGetAdminOperatorPricingQueryKey(), getGetAdminPaymentRoutingQueryKey(),
      ].map((queryKey) => cache.invalidateQueries({ queryKey })));
      setOpen(false);
      setFeedback(selected ? 'Pays mis à jour.' : `Pays ajouté avec ${initialOperators.length} opérateur${initialOperators.length === 1 ? '' : 's'} désactivé${initialOperators.length === 1 ? '' : 's'}. Les opérations restent désactivées.`);
    } catch (failure) {
      const status = (failure as { status?: number }).status;
      setError(status === 409
        ? selected
          ? 'Ces données ont changé. Fermez le formulaire et rechargez le pays.'
          : 'Ce code pays ou un identifiant d’opérateur existe déjà. Vérifiez les valeurs puis réessayez.'
        : status === 403 ? 'Votre compte n’a pas le droit de modifier les pays.'
          : 'Le pays n’a pas été enregistré. Vérifiez les données et réessayez.');
    }
  };

  const toggleSignupAvailability = async () => {
    if (!countryToToggleSignup || signupReason.trim().length < 3) return;
    setSignupError('');
    try {
      const updated = await update.mutateAsync({
        countryCode: countryToToggleSignup.countryCode,
        data: {
          countryName: countryToToggleSignup.countryName,
          phonePrefix: countryToToggleSignup.phonePrefix,
          minPhoneDigits: countryToToggleSignup.minPhoneDigits,
          maxPhoneDigits: countryToToggleSignup.maxPhoneDigits,
          enabled: countryToToggleSignup.enabled,
          signupEnabled: !countryToToggleSignup.signupEnabled,
          operations: countryToToggleSignup.operations,
          expectedVersion: countryToToggleSignup.version,
          reason: signupReason.trim(),
        },
      });
      await Promise.all([
        getGetAdminCountriesQueryKey(), getGetAuthCountriesQueryKey(),
        getGetAuthRegistrationCountriesQueryKey(),
        getGetRegistrationSettingsQueryKey(),
      ].map((queryKey) => cache.invalidateQueries({ queryKey })));
      setFeedback(
        `${updated.countryName} ${updated.signupEnabled ? 'est maintenant disponible' : 'n’est plus disponible'} à l’inscription.`,
      );
      setCountryToToggleSignup(null);
      setSignupReason('');
    } catch (failure) {
      const status = (failure as { status?: number }).status;
      setSignupError(status === 409
        ? 'Le catalogue a changé ou ce serait le dernier pays disponible. Rechargez la liste et réessayez.'
        : status === 403
          ? 'Votre compte n’a pas le droit de modifier la disponibilité à l’inscription.'
          : 'La disponibilité n’a pas été modifiée.');
      await query.refetch();
    }
  };

  const deleteCountry = async () => {
    if (!countryToDelete || deleteReason.trim().length < 3) return;
    setError('');
    try {
      await remove.mutateAsync({
        countryCode: countryToDelete.countryCode,
        data: { expectedVersion: countryToDelete.version, reason: deleteReason.trim() },
      });
      await Promise.all([
        getGetAdminCountriesQueryKey(), getGetAuthCountriesQueryKey(), getGetPublicPricingQueryKey(),
        getGetAdminOperatorPricingQueryKey(), getGetAdminPaymentRoutingQueryKey(),
      ].map((queryKey) => cache.invalidateQueries({ queryKey })));
      setCountryToDelete(null);
      setDeleteReason('');
      setFeedback('Pays supprimé du catalogue.');
    } catch (failure) {
      const status = (failure as { status?: number }).status;
      setError(status === 409
        ? 'Ce pays est actif ou lié à des données/configurations existantes. Désactivez-le au lieu de le supprimer.'
        : status === 403
          ? 'Votre compte n’a pas le droit de supprimer les pays.'
          : 'Le pays n’a pas été supprimé. Vérifiez les données et réessayez.');
    }
  };

  const countries = query.data?.countries ?? [];
  const visibleCountries = countries.filter((country) => {
    const term = search.trim().toLocaleLowerCase('fr-FR');
    return !term || [country.countryName, country.countryCode, country.phonePrefix]
      .some((value) => value.toLocaleLowerCase('fr-FR').includes(term));
  });

  return (
    <section className="space-y-3" aria-labelledby="admin-countries-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="admin-countries-title" className="text-lg font-semibold">Pays et disponibilités</h3>
          <p className="text-sm text-muted-foreground">
            Tous les pays sont listés ici. La disponibilité à l’inscription est réglée séparément de l’état global et des paiements.
          </p>
        </div>
         <Button type="button" disabled={!canMutate} onClick={() => openForm(null)}>Ajouter un pays</Button>
      </div>
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Rechercher un pays, un code ou un indicatif"
        aria-label="Rechercher un pays"
        data-testid="input-country-search"
      />
      {query.isLoading ? <p role="status">Chargement des pays…</p>
        : query.isError ? <p role="alert">Impossible de charger les pays. <Button variant="outline" onClick={() => void query.refetch()}>Réessayer</Button></p>
          : visibleCountries.length === 0 ? <p role="status">Aucun pays ne correspond à cette recherche.</p>
          : <div className="grid gap-3 md:grid-cols-2">
            {visibleCountries.map((country) => (
              <Card key={country.countryCode}>
                <CardHeader>
                  <CardTitle className="text-base">{country.flag} {country.countryName}</CardTitle>
                  <CardDescription>{country.countryCode.toUpperCase()} · {country.phonePrefix} · {country.minPhoneDigits}–{country.maxPhoneDigits} chiffres nationaux</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">
                    Inscription : {country.signupEnabled ? 'active' : 'désactivée'}
                    {' · '}Catalogue global : {country.enabled ? 'actif' : 'désactivé'}
                  </p>
                  <p className="text-sm text-muted-foreground">{operationLabels.map(([key, label]) =>
                    `${label} : ${country.enabled && country.operations[key] ? 'autorisé' : 'désactivé'}`).join(' · ')}</p>
                   <div className="flex flex-wrap gap-2">
                      <Button
                        variant={country.signupEnabled ? 'outline' : 'default'}
                        type="button"
                        disabled={!canMutate || busy}
                        onClick={() => {
                          setSignupError('');
                          setSignupReason('');
                          setCountryToToggleSignup(country);
                        }}
                        data-testid={`button-toggle-country-signup-${country.countryCode}`}
                      >
                        {country.signupEnabled ? 'Désactiver à l’inscription' : 'Activer à l’inscription'}
                      </Button>
                     <Button variant="outline" type="button" disabled={!canMutate} onClick={() => openForm(country)}>Configurer le pays</Button>
                     <Button variant="destructive" type="button" disabled={!canMutate}
                       onClick={() => { setError(''); setDeleteReason(''); setCountryToDelete(country); }}>
                       Supprimer
                     </Button>
                   </div>
                </CardContent>
              </Card>
            ))}
            {query.data?.countries.length === 0 && <p>Aucun pays configuré.</p>}
          </div>}
      <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected ? 'Configurer le pays' : 'Ajouter un pays'}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
             <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="country-code">Code ISO à deux lettres</Label>
                <Input id="country-code" value={form.countryCode} disabled={!!selected || busy} maxLength={2} required
                  onChange={(event) => setForm({ ...form, countryCode: event.target.value.toLowerCase() })} /></div>
              <div className="space-y-1"><Label htmlFor="country-prefix">Indicatif téléphonique</Label>
                <Input id="country-prefix" value={form.phonePrefix} disabled={busy} required
                  onChange={(event) => setForm({ ...form, phonePrefix: event.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label htmlFor="country-name">Nom du pays</Label>
              <Input id="country-name" value={form.countryName} disabled={busy} minLength={2} maxLength={120} required
                onChange={(event) => setForm({ ...form, countryName: event.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              {(['minPhoneDigits', 'maxPhoneDigits'] as const).map((key) => (
                <div key={key} className="space-y-1"><Label htmlFor={`country-${key}`}>{key === 'minPhoneDigits' ? 'Chiffres minimum' : 'Chiffres maximum'}</Label>
                  <Input id={`country-${key}`} type="number" min={4} max={15} step={1} required disabled={busy}
                    value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} disabled={busy}
                onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
               Activer le pays dans le catalogue global et ses opérations configurées
            </label>
            <p className="text-xs text-muted-foreground">Ce réglage global est indépendant de la disponibilité à l’inscription. Il ne configure pas les fournisseurs ni les frais.</p>
             {selected ? <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Opérations autorisées dans ce pays</legend>
              {operationLabels.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled={busy} checked={form.operations[key]}
                    onChange={(event) => setForm({ ...form, operations: { ...form.operations, [key]: event.target.checked } })} />{label}
                </label>
              ))}
              <p className="text-xs text-muted-foreground">Il faut également activer l’opérateur et l’opération correspondante, configurer les frais et intégrer le prestataire côté serveur. Ces cases ne déclenchent aucun paiement.</p>
             </fieldset> : <fieldset className="space-y-3 rounded-lg border p-3">
               <legend className="px-1 text-sm font-medium">Opérateurs initiaux, facultatif</legend>
               <p className="text-xs text-muted-foreground">Les opérateurs ajoutés ici et leurs frais seront créés désactivés. Aucun paiement ne sera activé.</p>
               {form.initialOperators.map((operator, index) => (
                 <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
                   <div className="space-y-1">
                     <Label htmlFor={`initial-operator-${index}`}>Nom</Label>
                     <Input id={`initial-operator-${index}`} value={operator.name} maxLength={120} disabled={busy}
                       onChange={(event) => setForm({ ...form, initialOperators: form.initialOperators.map((item, itemIndex) =>
                         itemIndex === index ? { ...item, name: event.target.value } : item) })} />
                   </div>
                   <div className="space-y-1">
                     <Label htmlFor={`initial-operator-brand-${index}`}>Apparence</Label>
                     <select id={`initial-operator-brand-${index}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                       value={operator.brand} disabled={busy}
                       onChange={(event) => setForm({ ...form, initialOperators: form.initialOperators.map((item, itemIndex) =>
                         itemIndex === index ? { ...item, brand: event.target.value as ManagedOperatorBrand } : item) })}>
                       {['orange', 'wave', 'mtn', 'moov', 'generic'].map((brand) => (
                         <option key={brand} value={brand}>{brand === 'generic' ? 'Générique' : brand.toUpperCase()}</option>
                       ))}
                     </select>
                   </div>
                   <Button type="button" variant="outline" disabled={busy}
                     className="self-end" onClick={() => setForm({ ...form, initialOperators: form.initialOperators.filter((_, itemIndex) => itemIndex !== index) })}>
                     Retirer
                   </Button>
                 </div>
               ))}
               <Button type="button" variant="outline" disabled={busy || form.initialOperators.length >= 30}
                 onClick={() => setForm({ ...form, initialOperators: [...form.initialOperators, { name: '', brand: 'generic' }] })}>
                 Ajouter une ligne opérateur
               </Button>
             </fieldset>}
            <div className="space-y-1"><Label htmlFor="country-reason">Motif de la modification</Label>
              <Textarea id="country-reason" value={form.reason} minLength={3} maxLength={500} required disabled={busy}
                onChange={(event) => setForm({ ...form, reason: event.target.value })} /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Annuler</Button>
               <Button type="submit" disabled={busy || !canMutate}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={countryToToggleSignup !== null} onOpenChange={(value) => {
        if (!value && !update.isPending) {
          setCountryToToggleSignup(null);
          setSignupReason('');
          setSignupError('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {countryToToggleSignup?.signupEnabled
                ? 'Désactiver ce pays à l’inscription ?'
                : 'Activer ce pays à l’inscription ?'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {countryToToggleSignup?.signupEnabled
              ? `${countryToToggleSignup.countryName} sera masqué aux nouveaux inscrits. Les comptes existants et les paiements ne changeront pas.`
              : `${countryToToggleSignup?.countryName ?? 'Ce pays'} apparaîtra sur le formulaire des nouveaux comptes. Les paiements restent soumis à leurs réglages séparés.`}
          </p>
          <div className="space-y-1">
            <Label htmlFor="country-signup-reason">Motif obligatoire</Label>
            <Textarea
              id="country-signup-reason"
              value={signupReason}
              maxLength={500}
              disabled={update.isPending}
              onChange={(event) => setSignupReason(event.target.value)}
            />
          </div>
          {signupError && <p role="alert" className="text-sm text-destructive">{signupError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={update.isPending}
              onClick={() => setCountryToToggleSignup(null)}>Annuler</Button>
            <Button type="button"
              variant={countryToToggleSignup?.signupEnabled ? 'destructive' : 'default'}
              disabled={!canMutate || signupReason.trim().length < 3 || update.isPending}
              onClick={() => void toggleSignupAvailability()}>
              {update.isPending ? 'Enregistrement…' : countryToToggleSignup?.signupEnabled ? 'Confirmer la désactivation' : 'Confirmer l’activation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={countryToDelete !== null} onOpenChange={(value) => { if (!value && !remove.isPending) setCountryToDelete(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer ce pays du catalogue ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            La suppression est refusée si le pays est actif ou référencé par des comptes, contacts, historiques, opérateurs ou routes. Dans ce cas, désactivez-le pour préserver les données.
          </p>
          <div className="space-y-1">
            <Label htmlFor="country-delete-reason">Motif obligatoire</Label>
            <Textarea id="country-delete-reason" value={deleteReason} maxLength={500} disabled={remove.isPending}
              onChange={(event) => setDeleteReason(event.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={remove.isPending} onClick={() => setCountryToDelete(null)}>Annuler</Button>
            <Button type="button" variant="destructive" disabled={!canMutate || deleteReason.trim().length < 3 || remove.isPending}
              onClick={() => void deleteCountry()}>
              {remove.isPending ? 'Suppression…' : 'Supprimer le pays'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
