import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminCountriesQueryKey, getGetAdminOperatorPricingQueryKey,
  getGetAdminPaymentRoutingQueryKey, getGetAuthCountriesQueryKey, getGetPublicPricingQueryKey,
  useCreateAdminCountry, useGetAdminCountries, useUpdateAdminCountry,
  type AdminCountry, type CountryOperationFlags,
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
const emptyForm = {
  countryCode: '', countryName: '', phonePrefix: '+', minPhoneDigits: '8', maxPhoneDigits: '10',
  enabled: true, operations: { deposit: false, interNetwork: false, international: false } as CountryOperationFlags,
  reason: '',
};

export function AdminCountriesSection() {
  const query = useGetAdminCountries();
  const cache = useQueryClient();
  const create = useCreateAdminCountry();
  const update = useUpdateAdminCountry();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AdminCountry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const busy = create.isPending || update.isPending;

  const openForm = (country: AdminCountry | null) => {
    setSelected(country);
    setError('');
    setForm(country ? {
      countryCode: country.countryCode, countryName: country.countryName, phonePrefix: country.phonePrefix,
      minPhoneDigits: String(country.minPhoneDigits), maxPhoneDigits: String(country.maxPhoneDigits),
      enabled: country.enabled, operations: { ...country.operations }, reason: '',
    } : { ...emptyForm, operations: { ...emptyForm.operations } });
    setOpen(true);
  };

  const save = async () => {
    const min = Number(form.minPhoneDigits), max = Number(form.maxPhoneDigits);
    if (!/^[a-z]{2}$/.test(form.countryCode) || !/^\+[1-9][0-9]{0,3}$/.test(form.phonePrefix)
      || form.countryName.trim().length < 2 || form.reason.trim().length < 3
      || !Number.isInteger(min) || !Number.isInteger(max) || min < 4 || max < min
      || max + form.phonePrefix.length - 1 > 15) {
      setError('Vérifiez le code pays, l’indicatif, les longueurs de numéro et le motif.');
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
          ...common, operations: form.operations, expectedVersion: selected.version,
        } });
      } else {
        await create.mutateAsync({ data: { ...common, countryCode: form.countryCode } });
      }
      await Promise.all([
        getGetAdminCountriesQueryKey(), getGetAuthCountriesQueryKey(), getGetPublicPricingQueryKey(),
        getGetAdminOperatorPricingQueryKey(), getGetAdminPaymentRoutingQueryKey(),
      ].map((queryKey) => cache.invalidateQueries({ queryKey })));
      setOpen(false);
      setFeedback(selected ? 'Pays mis à jour.' : 'Pays ajouté. Configurez ensuite ses opérateurs et ses opérations.');
    } catch (failure) {
      const status = (failure as { status?: number }).status;
      setError(status === 409 ? 'Ces données ont changé. Fermez le formulaire et rechargez le pays.'
        : status === 403 ? 'Votre compte n’a pas le droit de modifier les pays.'
          : 'Le pays n’a pas été enregistré. Vérifiez les données et réessayez.');
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="admin-countries-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="admin-countries-title" className="text-lg font-semibold">Pays et disponibilités</h3>
          <p className="text-sm text-muted-foreground">Catalogue partagé par l’inscription, la connexion et les opérations.</p>
        </div>
        <Button type="button" onClick={() => openForm(null)}>Ajouter un pays</Button>
      </div>
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
      {query.isLoading ? <p role="status">Chargement des pays…</p>
        : query.isError ? <p role="alert">Impossible de charger les pays. <Button variant="outline" onClick={() => void query.refetch()}>Réessayer</Button></p>
          : <div className="grid gap-3 md:grid-cols-2">
            {query.data?.countries.map((country) => (
              <Card key={country.countryCode}>
                <CardHeader>
                  <CardTitle className="text-base">{country.flag} {country.countryName}</CardTitle>
                  <CardDescription>{country.countryCode.toUpperCase()} · {country.phonePrefix} · {country.minPhoneDigits}–{country.maxPhoneDigits} chiffres nationaux</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{country.enabled ? 'Nouvelles inscriptions autorisées' : 'Nouvelles inscriptions désactivées'}</p>
                  <p className="text-sm text-muted-foreground">{operationLabels.map(([key, label]) =>
                    `${label} : ${country.enabled && country.operations[key] ? 'autorisé' : 'désactivé'}`).join(' · ')}</p>
                  <Button variant="outline" type="button" onClick={() => openForm(country)}>Configurer le pays</Button>
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
              Autoriser les nouvelles inscriptions et les opérations configurées
            </label>
            <p className="text-xs text-muted-foreground">Désactiver un pays ne retire pas la connexion aux comptes existants. Vérifiez la couverture SMS avant d’autoriser les inscriptions.</p>
            {selected ? <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Opérations autorisées dans ce pays</legend>
              {operationLabels.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled={busy} checked={form.operations[key]}
                    onChange={(event) => setForm({ ...form, operations: { ...form.operations, [key]: event.target.checked } })} />{label}
                </label>
              ))}
              <p className="text-xs text-muted-foreground">Il faut également activer l’opérateur et l’opération correspondante, configurer les frais et intégrer le prestataire côté serveur. Ces cases ne déclenchent aucun paiement.</p>
            </fieldset> : <p className="text-sm text-muted-foreground">Les trois opérations seront désactivées à la création.</p>}
            <div className="space-y-1"><Label htmlFor="country-reason">Motif de la modification</Label>
              <Textarea id="country-reason" value={form.reason} minLength={3} maxLength={500} required disabled={busy}
                onChange={(event) => setForm({ ...form, reason: event.target.value })} /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
