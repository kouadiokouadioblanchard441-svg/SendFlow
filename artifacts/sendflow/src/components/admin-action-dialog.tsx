import { useState } from 'react';
import { Archive, Ban, CheckCircle2, CreditCard, RotateCcw, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminTransactionQueryKey,
  getGetAdminUserQueryKey,
  getListAdminTransactionsQueryKey,
  getListAdminUsersQueryKey,
  useArchiveAdminTransaction,
  useCreateAdminWalletAdjustment,
  useDeleteAdminUser,
  useRestoreAdminUser,
  useSuspendAdminUser,
} from '@workspace/api-client-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type AdminActionKind = 'credit' | 'debit' | 'suspend' | 'restore' | 'delete-user' | 'archive-transaction';

type AdminActionDialogProps = {
  kind: AdminActionKind;
  targetId: string;
  currentBalanceMinor?: number;
  currency?: string;
  onCompleted?: () => void;
};

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return 'L’action n’a pas pu être exécutée.';
  const candidate = error as { data?: { error?: string }; message?: string };
  return candidate.data?.error || candidate.message || 'L’action n’a pas pu être exécutée.';
}

function formatMinor(minor: number | undefined, currency = 'XOF') {
  if (minor === undefined) return '—';
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100)} ${currency === 'XOF' ? 'FCFA' : currency}`;
}

const actionMeta: Record<AdminActionKind, {
  title: string;
  trigger: string;
  description: string;
  icon: typeof CreditCard;
  destructive?: boolean;
}> = {
  credit: {
    title: 'Créditer le wallet',
    trigger: 'Créditer',
    description: 'Cette opération crée une écriture immuable dans le ledger et augmente le solde après validation.',
    icon: CreditCard,
  },
  debit: {
    title: 'Débiter le wallet',
    trigger: 'Débiter',
    description: 'Cette opération crée une écriture immuable dans le ledger et refuse tout solde négatif.',
    icon: CreditCard,
    destructive: true,
  },
  suspend: {
    title: 'Suspendre le compte',
    trigger: 'Suspendre',
    description: 'Le compte ne pourra plus initialiser sa session applicative. La suspension sera auditée.',
    icon: Ban,
    destructive: true,
  },
  restore: {
    title: 'Restaurer le compte',
    trigger: 'Restaurer',
    description: 'Le compte repassera à l’état actif. La restauration sera auditée.',
    icon: RotateCcw,
  },
  'delete-user': {
    title: 'Supprimer logiquement le compte',
    trigger: 'Supprimer',
    description: 'Aucune donnée financière ne sera physiquement supprimée. Le compte sera marqué supprimé et conservé pour la traçabilité.',
    icon: Trash2,
    destructive: true,
  },
  'archive-transaction': {
    title: 'Archiver la transaction',
    trigger: 'Archiver',
    description: 'La transaction sera retirée des listes opérationnelles, mais son enregistrement financier restera conservé.',
    icon: Archive,
    destructive: true,
  },
};

export function AdminActionDialog({
  kind,
  targetId,
  currentBalanceMinor,
  currency,
  onCompleted,
}: AdminActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [success, setSuccess] = useState('');
  const queryClient = useQueryClient();
  const walletMutation = useCreateAdminWalletAdjustment();
  const suspendMutation = useSuspendAdminUser();
  const restoreMutation = useRestoreAdminUser();
  const deleteMutation = useDeleteAdminUser();
  const archiveMutation = useArchiveAdminTransaction();
  const meta = actionMeta[kind];
  const Icon = meta.icon;
  const isWalletAction = kind === 'credit' || kind === 'debit';
  const expectedConfirmation = isWalletAction ? kind.toUpperCase() : 'CONFIRMER';
  const isPending = walletMutation.isPending
    || suspendMutation.isPending
    || restoreMutation.isPending
    || deleteMutation.isPending
    || archiveMutation.isPending;
  const error = kind === 'credit' || kind === 'debit'
    ? walletMutation.error
    : kind === 'suspend'
      ? suspendMutation.error
      : kind === 'restore'
        ? restoreMutation.error
        : kind === 'delete-user'
          ? deleteMutation.error
          : archiveMutation.error;

  const reset = () => {
    setAmount('');
    setReason('');
    setConfirmation('');
    setSuccess('');
  };

  const close = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };

  const invalidate = async () => {
    if (kind === 'archive-transaction') {
      await queryClient.invalidateQueries({ queryKey: getListAdminTransactionsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetAdminTransactionQueryKey(targetId) });
    } else {
      await queryClient.invalidateQueries({ queryKey: getGetAdminUserQueryKey(targetId) });
      await queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getListAdminTransactionsQueryKey() });
    }
  };

  const submit = async () => {
    if (reason.trim().length < 10 || confirmation !== expectedConfirmation) return;

    if (isWalletAction) {
      const normalizedAmount = amount.trim().replace(',', '.');
      if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) return;
      const amountMinor = Math.round(Number(normalizedAmount) * 100);
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return;
      const direction = kind === 'credit' ? 'credit' : 'debit';

      await walletMutation.mutateAsync({
        userId: targetId,
        data: {
          direction,
          amountMinor,
          reason: reason.trim(),
          confirmation: direction === 'credit' ? 'CREDIT' : 'DEBIT',
          idempotencyKey: crypto.randomUUID(),
          ...(currentBalanceMinor === undefined ? {} : { expectedBalanceMinor: currentBalanceMinor }),
        },
      });
      await invalidate();
      setSuccess(`Opération ${kind === 'credit' ? 'de crédit' : 'de débit'} enregistrée.`);
    } else if (kind === 'suspend') {
      await suspendMutation.mutateAsync({ userId: targetId, data: { reason: reason.trim(), confirmation: 'CONFIRMER' } });
      await invalidate();
      setSuccess('Compte suspendu et action auditée.');
    } else if (kind === 'restore') {
      await restoreMutation.mutateAsync({ userId: targetId, data: { reason: reason.trim(), confirmation: 'CONFIRMER' } });
      await invalidate();
      setSuccess('Compte restauré et action auditée.');
    } else if (kind === 'delete-user') {
      await deleteMutation.mutateAsync({ userId: targetId, data: { reason: reason.trim(), confirmation: 'CONFIRMER' } });
      await invalidate();
      setSuccess('Compte marqué comme supprimé logiquement.');
    } else {
      await archiveMutation.mutateAsync({ transactionId: targetId, data: { reason: reason.trim(), confirmation: 'CONFIRMER' } });
      await invalidate();
      setSuccess('Transaction archivée et action auditée.');
    }

    onCompleted?.();
  };

  const canSubmit = reason.trim().length >= 10
    && confirmation === expectedConfirmation
    && (!isWalletAction || /^\d+([.,]\d{1,2})?$/.test(amount.trim()));

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <Button
        type="button"
        variant={meta.destructive ? 'destructive' : 'outline'}
        size="sm"
        onClick={() => setOpen(true)}
        data-testid={`button-admin-action-${kind}`}
      >
        <Icon className="size-4" aria-hidden="true" />
        {meta.trigger}
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{meta.title}</AlertDialogTitle>
          <AlertDialogDescription>{meta.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {isWalletAction && (
          <div className="space-y-2">
            <Label htmlFor={`admin-action-amount-${kind}`}>Montant ({currency === 'XOF' ? 'FCFA' : currency || 'devise'})</Label>
            <Input
              id={`admin-action-amount-${kind}`}
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isPending || Boolean(success)}
            />
            <p className="text-xs text-muted-foreground">Solde actuel : {formatMinor(currentBalanceMinor, currency)}</p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor={`admin-action-reason-${kind}`}>Motif obligatoire</Label>
          <Textarea
            id={`admin-action-reason-${kind}`}
            placeholder="Décrivez précisément la raison de cette action."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={isPending || Boolean(success)}
            maxLength={500}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`admin-action-confirmation-${kind}`}>
            Tapez <strong>{expectedConfirmation}</strong> pour confirmer
          </Label>
          <Input
            id={`admin-action-confirmation-${kind}`}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={isPending || Boolean(success)}
            autoComplete="off"
          />
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{getErrorMessage(error)}</AlertDescription></Alert>}
        {success && <Alert><CheckCircle2 className="size-4" /><AlertDescription>{success}</AlertDescription></Alert>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Fermer</AlertDialogCancel>
          {!success && (
            <Button
              type="button"
              variant={meta.destructive ? 'destructive' : 'default'}
              disabled={!canSubmit || isPending}
              onClick={() => void submit()}
            >
              {isPending ? 'Traitement…' : 'Confirmer l’action'}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}