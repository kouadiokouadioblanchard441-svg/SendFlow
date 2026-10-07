import { useEffect, useState, type FormEvent } from "react";
import { useUnlockAdminPin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminPinDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: () => void | Promise<void>;
  cancelLabel?: string;
};

function getPinErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "La vérification du PIN a échoué. Réessayez.";
  }

  const status = "status" in error ? error.status : undefined;
  if (status === 429) return "Trop de tentatives. Réessayez après le délai indiqué.";
  if (status === 503) return "La vérification du PIN est temporairement indisponible.";

  const data = "data" in error ? error.data : undefined;
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }

  if (status === 403) return "PIN incorrect ou compte non autorisé.";
  return "La vérification du PIN a échoué. Réessayez.";
}

export function AdminPinDialog({
  open,
  onOpenChange,
  onUnlocked,
  cancelLabel = "Annuler",
}: AdminPinDialogProps) {
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const unlockAdminPin = useUnlockAdminPin();

  useEffect(() => {
    if (!open) {
      setPin("");
      setErrorMessage("");
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    if (!/^[0-9]{8}$/.test(pin)) {
      setErrorMessage("Saisissez les 8 chiffres du PIN administrateur.");
      return;
    }

    try {
      await unlockAdminPin.mutateAsync({ data: { pin } });
      setPin("");
      await onUnlocked();
    } catch (error) {
      setErrorMessage(getPinErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vérification administrateur</DialogTitle>
          <DialogDescription>
            Saisissez votre PIN administrateur pour ouvrir cet espace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sendflow-admin-pin">PIN administrateur</Label>
            <Input
              id="sendflow-admin-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              pattern="[0-9]{8}"
              maxLength={8}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "sendflow-admin-pin-error" : undefined}
              data-testid="input-admin-pin"
            />
            {errorMessage && (
              <p
                id="sendflow-admin-pin-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {errorMessage}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              disabled={unlockAdminPin.isPending || pin.length !== 8}
              aria-busy={unlockAdminPin.isPending}
              data-testid="button-admin-pin-submit"
            >
              {unlockAdminPin.isPending ? "Vérification…" : "Continuer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
