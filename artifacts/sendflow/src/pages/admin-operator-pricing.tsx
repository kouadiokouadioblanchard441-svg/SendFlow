import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useDeleteAdminOperatorLogo,
  getGetAdminOperatorPricingQueryKey,
  getGetPublicPricingQueryKey,
  useCreateAdminOperator,
  useGetAdminOperatorPricing,
  useUploadAdminOperatorLogo,
  useUpdateAdminOperator,
  useUpdateAdminOperatorPricing,
} from '@workspace/api-client-react';
import type { ManagedOperatorBrand, PublicPricingCategory } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { OperatorMark } from '@/components/operator-mark';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type CategoryId = PublicPricingCategory['id'];

const brandLabels: Record<ManagedOperatorBrand, string> = {
  orange: 'Orange',
  wave: 'Wave',
  mtn: 'MTN',
  moov: 'Moov',
  generic: 'Générique',
};

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: number; response?: { status?: number } };
  return candidate.status ?? candidate.response?.status;
}

function getMutationError(error: unknown): string {
  const status = getErrorStatus(error);
  if (status === 401) return 'Votre session administrateur a expiré. Reconnectez-vous avant de réessayer.';
  if (status === 403) return 'Votre compte ne peut pas modifier le catalogue.';
  if (status === 409) return 'Une autre personne a modifié ces données. Actualisez la page avant de réessayer.';
  if (status === 413) return 'Le logo dépasse la taille maximale de 512 Ko.';
  if (status === 415) return 'Choisissez une image PNG, JPEG ou WebP.';
  return 'La modification n’a pas été enregistrée. Réessayez dans quelques instants.';
}

export default function AdminOperatorPricingPage() {
  const queryClient = useQueryClient();
  const query = useGetAdminOperatorPricing();
  const queryErrorStatus = getErrorStatus(query.error);
  const createMutation = useCreateAdminOperator();
  const operatorMutation = useUpdateAdminOperator();
  const ratesMutation = useUpdateAdminOperatorPricing();
  const logoUploadHeaders = useRef<Record<string, string>>({ 'Content-Type': 'image/png' });
  const logoUploadMutation = useUploadAdminOperatorLogo({
    request: { headers: logoUploadHeaders.current },
  });
  const logoDeleteMutation = useDeleteAdminOperatorLogo();
  const countries = query.data?.countries ?? [];
  const categories = query.data?.categories ?? [];
  const [countryCode, setCountryCode] = useState('ci');
  const [categoryId, setCategoryId] = useState<CategoryId>('deposit');
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [rateReason, setRateReason] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState('');
  const [newOperatorBrand, setNewOperatorBrand] = useState<ManagedOperatorBrand>('generic');
  const [newOperatorReason, setNewOperatorReason] = useState('');
  const [operatorToToggle, setOperatorToToggle] = useState<
    (typeof countries)[number]['operators'][number] | null
  >(null);
  const [toggleReason, setToggleReason] = useState('');
  const [operationToToggle, setOperationToToggle] = useState<CategoryId | null>(null);
  const [logoTarget, setLogoTarget] = useState<
    (typeof countries)[number]['operators'][number] | null
  >(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const country = countries.find((item) => item.countryCode === countryCode) ?? countries[0];
  const category = categories.find((item) => item.id === categoryId) ?? categories[0];
  const countryOperators = country?.operators ?? [];
  const changedRates = useMemo(() => {
    const changes: Array<{
      operatorId: string;
      feePercent: number | null;
      expectedVersion: number;
    }> = [];

    for (const operator of countryOperators) {
      const currentRate = operator.rates.find((item) => item.categoryId === categoryId);
      const draft = rateDrafts[operator.operatorId];
      if (!currentRate || draft === undefined) continue;

      const trimmed = draft.trim();
      const feePercent = trimmed === '' ? null : Number(trimmed);
      if (feePercent !== null && (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100)) {
        continue;
      }
      if (feePercent === currentRate.feePercent) continue;

      changes.push({
        operatorId: operator.operatorId,
        feePercent,
        expectedVersion: currentRate.version,
      });
    }
    return changes;
  }, [categoryId, countryOperators, rateDrafts]);

  const invalidRateDraft = useMemo(
    () =>
      countryOperators.some((operator) => {
        const draft = rateDrafts[operator.operatorId];
        if (draft === undefined || draft.trim() === '') return false;
        const value = Number(draft);
        return !Number.isFinite(value) || value < 0 || value > 100;
      }),
    [countryOperators, rateDrafts],
  );

  useEffect(() => {
    if (countries.length > 0 && !countries.some((item) => item.countryCode === countryCode)) {
      setCountryCode(countries[0].countryCode);
    }
  }, [countries, countryCode]);

  useEffect(() => {
    if (categories.length > 0 && !categories.some((item) => item.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  useEffect(() => {
    setRateDrafts({});
    setRateReason('');
  }, [countryCode, categoryId]);

  const invalidateCatalog = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetAdminOperatorPricingQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetPublicPricingQueryKey() }),
    ]);
  };

  const createOperator = () => {
    if (!country || newOperatorReason.trim().length < 3 || newOperatorName.trim().length < 2) return;
    setErrorMessage('');
    setSuccessMessage('');
    createMutation.mutate(
      {
        data: {
          countryCode: country.countryCode,
          name: newOperatorName.trim(),
          brand: newOperatorBrand,
          reason: newOperatorReason.trim(),
        },
      },
      {
        onSuccess: async () => {
          await invalidateCatalog();
          setAddDialogOpen(false);
          setNewOperatorName('');
          setNewOperatorBrand('generic');
          setNewOperatorReason('');
          setSuccessMessage('Opérateur ajouté. Il est désactivé tant que vous ne l’activez pas.');
        },
        onError: (error) => setErrorMessage(getMutationError(error)),
      },
    );
  };

  const toggleOperator = () => {
    if (!operatorToToggle || toggleReason.trim().length < 3) return;
    setErrorMessage('');
    setSuccessMessage('');
    operatorMutation.mutate(
      {
        operatorId: operatorToToggle.operatorId,
        data: {
          name: operatorToToggle.name,
          brand: operatorToToggle.brand,
          enabled: operationToToggle ? operatorToToggle.enabled : !operatorToToggle.enabled,
          depositEnabled: operationToToggle === 'deposit'
            ? !operatorToToggle.depositEnabled : operatorToToggle.depositEnabled,
          interNetworkEnabled: operationToToggle === 'inter-network'
            ? !operatorToToggle.interNetworkEnabled : operatorToToggle.interNetworkEnabled,
          internationalEnabled: operationToToggle === 'international'
            ? !operatorToToggle.internationalEnabled : operatorToToggle.internationalEnabled,
          expectedVersion: operatorToToggle.version,
          reason: toggleReason.trim(),
        },
      },
      {
        onSuccess: async () => {
          await invalidateCatalog();
          setSuccessMessage(operationToToggle
            ? `${operatorToToggle.name} : disponibilité de cette opération mise à jour pour ce pays uniquement.`
            : operatorToToggle.enabled
              ? `${operatorToToggle.name} est désactivé et ne sera plus proposé aux clients.`
              : `${operatorToToggle.name} est activé.`);
          setOperatorToToggle(null);
          setToggleReason('');
        },
        onError: (error) => setErrorMessage(getMutationError(error)),
      },
    );
  };

  const saveRates = () => {
    if (!country || changedRates.length === 0 || invalidRateDraft || rateReason.trim().length < 3) return;
    setErrorMessage('');
    setSuccessMessage('');
    ratesMutation.mutate(
      {
        data: {
          countryCode: country.countryCode,
          categoryId,
          updates: changedRates,
          reason: rateReason.trim(),
        },
      },
      {
        onSuccess: async () => {
          await invalidateCatalog();
          setRateDrafts({});
          setRateReason('');
          setSuccessMessage(`Les frais de la section « ${category?.label ?? 'tarification'} » ont été enregistrés.`);
        },
        onError: (error) => setErrorMessage(getMutationError(error)),
      },
    );
  };

  const saveLogo = () => {
    if (!logoTarget || !logoFile) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(logoFile.type)) {
      setErrorMessage('Choisissez une image PNG, JPEG ou WebP.');
      return;
    }
    if (logoFile.size < 1 || logoFile.size > 512 * 1024) {
      setErrorMessage('Le logo doit peser au maximum 512 Ko.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    logoUploadHeaders.current['Content-Type'] = logoFile.type;
    logoUploadMutation.mutate(
      {
        operatorId: logoTarget.operatorId,
        expectedVersion: logoTarget.version,
        data: logoFile,
      },
      {
        onSuccess: async () => {
          const operatorName = logoTarget.name;
          await invalidateCatalog();
          setLogoTarget(null);
          setLogoFile(null);
          setSuccessMessage(`Le logo de ${operatorName} a été enregistré dans la base de données.`);
        },
        onError: (error) => setErrorMessage(getMutationError(error)),
      },
    );
  };

  const removeLogo = () => {
    if (!logoTarget?.logoUrl) return;
    setErrorMessage('');
    setSuccessMessage('');
    logoDeleteMutation.mutate(
      { operatorId: logoTarget.operatorId, expectedVersion: logoTarget.version },
      {
        onSuccess: async () => {
          const operatorName = logoTarget.name;
          await invalidateCatalog();
          setLogoTarget(null);
          setLogoFile(null);
          setSuccessMessage(`Le logo de ${operatorName} a été retiré.`);
        },
        onError: (error) => setErrorMessage(getMutationError(error)),
      },
    );
  };

  return (
    <div className="space-y-6" data-testid="content-admin-operator-pricing">
      <div className="sendflow-admin-page-intro">
        <div>
          <p className="sendflow-admin-overline">Catalogue client</p>
          <h2 data-testid="heading-admin-operator-pricing">Opérateurs et frais par pays</h2>
          <p className="sendflow-admin-subtitle">
            Activez les réseaux proposés aux clients et gérez leurs frais pour chaque type d’opération.
          </p>
        </div>
        <div className="sendflow-admin-readonly-chip"><ShieldCheck className="size-4" /> Modifications auditées</div>
      </div>

      {errorMessage && (
        <Alert variant="destructive" data-testid="alert-admin-operator-pricing-error">
          <CircleAlert className="size-4" />
          <AlertTitle>Modification non enregistrée</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert data-testid="alert-admin-operator-pricing-success">
          <AlertTitle>Modification enregistrée</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {query.isLoading && (
        <div className="space-y-4" data-testid="loading-admin-operator-pricing">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      )}
      {query.isError && (
        <Alert variant="destructive" data-testid="alert-admin-operator-pricing-load-error">
          <CircleAlert className="size-4" />
          <AlertTitle>
            {queryErrorStatus === 401
              ? 'Session administrateur requise'
              : queryErrorStatus === 403
                ? 'Accès refusé'
                : 'Catalogue indisponible'}
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>
              {queryErrorStatus === 401
                ? 'Cette session ne correspond pas à un compte administrateur autorisé. Vérifiez l’identité utilisée, puis réessayez.'
                : queryErrorStatus === 403
                  ? 'Votre compte ne peut pas consulter le catalogue des opérateurs et des tarifs.'
                  : 'Impossible de charger les opérateurs et les tarifs persistés.'}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {query.data && country && category && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Pays et section</CardTitle>
              <CardDescription>
                Les changements de tarifs ne modifient pas l’état des intégrations de paiement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-[minmax(220px,1fr)_minmax(280px,2fr)]">
                <div className="space-y-2">
                  <Label htmlFor="admin-operator-country">Pays</Label>
                  <Select value={country.countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger id="admin-operator-country" data-testid="select-admin-operator-country">
                      <SelectValue placeholder="Choisir un pays" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((item) => (
                        <SelectItem key={item.countryCode} value={item.countryCode}>
                          {item.flag} {item.countryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Section tarifaire</Label>
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Section tarifaire">
                    {categories.map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        size="sm"
                        variant={category.id === item.id ? 'default' : 'outline'}
                        role="tab"
                        aria-selected={category.id === item.id}
                        onClick={() => setCategoryId(item.id)}
                        data-testid={`button-admin-pricing-category-${item.id}`}
                      >
                        {item.shortLabel}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div>
                  <p className="font-semibold">{country.flag} {country.countryName} · {category.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {countryOperators.length} opérateur{countryOperators.length === 1 ? '' : 's'} · Les tarifs vides ne sont pas publiés.
                  </p>
                </div>
                <Button type="button" onClick={() => { setErrorMessage(''); setAddDialogOpen(true); }} data-testid="button-add-country-operator">
                  <Plus className="mr-2 size-4" /> Ajouter un opérateur
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frais des opérateurs</CardTitle>
              <CardDescription>
                Saisissez un pourcentage de 0 à 100. Laissez vide pour retirer le tarif public de cette section.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {countryOperators.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground" role="status" data-testid="empty-admin-country-operators">
                  Aucun opérateur n’est encore enregistré pour ce pays.
                </div>
              ) : (
                <Table className="sendflow-admin-user-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opérateur</TableHead>
                      <TableHead>Disponibilité client</TableHead>
                      <TableHead>Frais · {category.shortLabel}</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {countryOperators.map((operator) => {
                      const rate = operator.rates.find((item) => item.categoryId === categoryId);
                      const draft = rateDrafts[operator.operatorId];
                      const inputValue = draft ?? (rate?.feePercent === null || !rate ? '' : String(rate.feePercent));
                      return (
                        <TableRow key={operator.operatorId} data-testid={`row-admin-operator-${operator.operatorId}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
                                <OperatorMark
                                  operator={operator}
                                  imageClassName="h-full w-full object-contain p-1"
                                  fallbackClassName="text-xs"
                                />
                              </span>
                              <span className="flex flex-col">
                              <strong>{operator.name}</strong>
                              <small className="text-muted-foreground">{operator.operatorId} · {brandLabels[operator.brand]}</small>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={operator.enabled ? 'sendflow-admin-status-succeeded' : 'sendflow-admin-status-pending'}
                              data-testid={`status-admin-operator-${operator.operatorId}`}
                            >
                              {operator.enabled ? 'Actif sur les pages client' : 'Désactivé'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex max-w-[180px] items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                inputMode="decimal"
                                value={inputValue}
                                onChange={(event) => setRateDrafts((current) => ({
                                  ...current,
                                  [operator.operatorId]: event.target.value,
                                }))}
                                aria-label={`Frais ${category.label} pour ${operator.name}, en pourcentage`}
                                data-testid={`input-admin-rate-${operator.operatorId}-${categoryId}`}
                              />
                              <span className="text-sm text-muted-foreground">%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setErrorMessage('');
                                  setLogoFile(null);
                                  setLogoTarget(operator);
                                }}
                                data-testid={`button-manage-operator-logo-${operator.operatorId}`}
                              >
                                {operator.logoUrl ? 'Modifier le logo' : 'Ajouter un logo'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => { setOperationToToggle(null); setErrorMessage(''); setToggleReason(''); setOperatorToToggle(operator); }}
                                data-testid={`button-toggle-operator-${operator.operatorId}`}
                              >
                                {operator.enabled ? 'Désactiver' : 'Activer'}
                              </Button>
                              <Button type="button" size="sm" variant="outline"
                                onClick={() => {
                                  setOperationToToggle(categoryId);
                                  setErrorMessage(''); setToggleReason(''); setOperatorToToggle(operator);
                                }}>
                                {(categoryId === 'deposit' ? operator.depositEnabled
                                  : categoryId === 'inter-network' ? operator.interNetworkEnabled
                                    : operator.internationalEnabled) ? 'Désactiver' : 'Activer'} {category?.shortLabel}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {countryOperators.length > 0 && (
                <div className="space-y-4 border-t p-5">
                  <div className="space-y-2">
                    <Label htmlFor="admin-pricing-reason">Motif de modification des frais</Label>
                    <Textarea
                      id="admin-pricing-reason"
                      value={rateReason}
                      onChange={(event) => setRateReason(event.target.value)}
                      placeholder="Indiquez pourquoi ces frais changent."
                      maxLength={500}
                      data-testid="input-admin-pricing-reason"
                    />
                  </div>
                  {invalidRateDraft && <p className="text-sm text-destructive">Chaque frais doit être compris entre 0 et 100 %.</p>}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {changedRates.length} tarif{changedRates.length === 1 ? '' : 's'} modifié{changedRates.length === 1 ? '' : 's'} dans cette section.
                    </p>
                    <Button
                      type="button"
                      onClick={saveRates}
                      disabled={
                        changedRates.length === 0 ||
                        invalidRateDraft ||
                        rateReason.trim().length < 3 ||
                        ratesMutation.isPending
                      }
                      data-testid="button-save-admin-rates"
                    >
                      {ratesMutation.isPending ? 'Enregistrement…' : 'Enregistrer les frais'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent data-testid="dialog-add-country-operator">
          <DialogHeader>
            <DialogTitle>Ajouter un opérateur</DialogTitle>
            <DialogDescription>
              Le nouvel opérateur sera créé désactivé et sans frais préremplis. Configurez ses tarifs avant de l’activer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-operator-name">Nom de l’opérateur</Label>
              <Input
                id="new-operator-name"
                value={newOperatorName}
                onChange={(event) => setNewOperatorName(event.target.value)}
                maxLength={120}
                data-testid="input-new-operator-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-operator-brand">Apparence</Label>
              <Select value={newOperatorBrand} onValueChange={(value) => setNewOperatorBrand(value as ManagedOperatorBrand)}>
                <SelectTrigger id="new-operator-brand" data-testid="select-new-operator-brand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(brandLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-operator-reason">Motif d’ajout</Label>
              <Textarea
                id="new-operator-reason"
                value={newOperatorReason}
                onChange={(event) => setNewOperatorReason(event.target.value)}
                maxLength={500}
                data-testid="input-new-operator-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Annuler</Button>
            <Button
              type="button"
              onClick={createOperator}
              disabled={
                newOperatorName.trim().length < 2 ||
                newOperatorReason.trim().length < 3 ||
                createMutation.isPending
              }
              data-testid="button-confirm-add-operator"
            >
              {createMutation.isPending ? 'Ajout…' : 'Ajouter désactivé'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={logoTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLogoTarget(null);
            setLogoFile(null);
          }
        }}
      >
        <DialogContent data-testid="dialog-manage-operator-logo">
          <DialogHeader>
            <DialogTitle>{logoTarget?.logoUrl ? 'Modifier le logo' : 'Ajouter un logo'}</DialogTitle>
            <DialogDescription>
              Le fichier est vérifié côté serveur puis stocké dans la base de données. Formats PNG, JPEG ou WebP, 512 Ko maximum.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {logoTarget?.logoUrl && (
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center overflow-hidden rounded-lg border bg-muted">
                  <OperatorMark
                    operator={logoTarget}
                    imageClassName="h-full w-full object-contain p-1"
                    fallbackClassName="text-xs"
                  />
                </span>
                <span className="text-sm text-muted-foreground">Logo actuellement enregistré</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="operator-logo-file">Fichier image · {logoTarget?.name}</Label>
              <Input
                id="operator-logo-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                data-testid="input-operator-logo-file"
              />
              {logoFile && (
                <p className="text-sm text-muted-foreground" data-testid="text-selected-operator-logo">
                  {logoFile.name} · {(logoFile.size / 1024).toFixed(0)} Ko
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex-wrap">
            {logoTarget?.logoUrl && (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                onClick={removeLogo}
                disabled={logoDeleteMutation.isPending || logoUploadMutation.isPending}
                data-testid="button-remove-operator-logo"
              >
                <Trash2 className="mr-2 size-4" />
                {logoDeleteMutation.isPending ? 'Suppression…' : 'Retirer le logo'}
              </Button>
            )}
            <Button
              type="button"
              onClick={saveLogo}
              disabled={!logoFile || logoUploadMutation.isPending || logoDeleteMutation.isPending}
              data-testid="button-save-operator-logo"
            >
              {logoUploadMutation.isPending ? 'Enregistrement…' : 'Enregistrer le logo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={operatorToToggle !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOperatorToToggle(null);
            setToggleReason('');
          }
        }}
      >
        <DialogContent data-testid="dialog-toggle-country-operator">
          <DialogHeader>
            <DialogTitle>{operationToToggle ? `Modifier la disponibilité : ${category?.shortLabel}` : operatorToToggle?.enabled ? 'Désactiver cet opérateur ?' : 'Activer cet opérateur ?'}</DialogTitle>
            <DialogDescription>
              {operationToToggle
                ? `Seule l’opération ${category?.shortLabel} sera modifiée pour cet opérateur dans ce pays. Les autres pays et opérations resteront inchangés.`
                : operatorToToggle?.enabled
                ? `${operatorToToggle.name} ne sera plus proposé sur les pages client. Son historique et ses tarifs seront conservés.`
                : `${operatorToToggle?.name ?? 'Cet opérateur'} sera proposé sur les pages client. Les tarifs non configurés resteront indiqués comme à confirmer.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="operator-toggle-reason">Motif obligatoire</Label>
            <Textarea
              id="operator-toggle-reason"
              value={toggleReason}
              onChange={(event) => setToggleReason(event.target.value)}
              maxLength={500}
              data-testid="input-operator-toggle-reason"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOperatorToToggle(null)}>Annuler</Button>
            <Button
              type="button"
              variant={operatorToToggle?.enabled ? 'destructive' : 'default'}
              onClick={toggleOperator}
              disabled={toggleReason.trim().length < 3 || operatorMutation.isPending}
              data-testid="button-confirm-toggle-operator"
            >
              {operatorMutation.isPending ? 'Enregistrement…' : operationToToggle ? 'Enregistrer' : operatorToToggle?.enabled ? 'Désactiver' : 'Activer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}