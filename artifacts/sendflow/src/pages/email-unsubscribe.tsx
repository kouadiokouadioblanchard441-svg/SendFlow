import { useState, type CSSProperties } from "react";
import { useUnsubscribeFromSendFlowMarketingEmails } from "@workspace/api-client-react";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function EmailUnsubscribePage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const unsubscribe = useUnsubscribeFromSendFlowMarketingEmails();
  const [confirmed, setConfirmed] = useState(false);

  const confirmUnsubscribe = () => {
    if (!token || unsubscribe.isPending || confirmed) return;
    unsubscribe.mutate({ data: { token } }, { onSuccess: () => setConfirmed(true) });
  };

  return (
    <main
      className="grid min-h-screen place-items-center bg-white px-4 py-10 text-slate-950"
      style={{ "--primary": "211 100% 50%", "--primary-foreground": "0 0% 100%" } as CSSProperties}
    >
      <Card className="w-full max-w-lg border-border shadow-sm">
        <CardHeader className="space-y-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            {confirmed ? <CheckCircle2 className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
          </span>
          <CardTitle>{confirmed ? "Désinscription enregistrée" : "Gérer les e-mails SendFlow"}</CardTitle>
          <CardDescription>
            {confirmed
              ? "Vous ne recevrez plus les annonces et offres SendFlow à cette adresse."
              : "Confirmez votre choix pour ne plus recevoir les annonces et offres SendFlow. L’ouverture de cette page ne modifie pas votre préférence."}
          </CardDescription>
        </CardHeader>
        {!confirmed && (
          <CardContent className="space-y-3">
            {!token && <p className="text-sm text-destructive" role="alert">Le lien de désinscription est incomplet ou invalide.</p>}
            {unsubscribe.isError && <p className="text-sm text-destructive" role="alert">La demande n’a pas pu être enregistrée. Le lien peut être expiré ou invalide.</p>}
            <Button className="w-full" onClick={confirmUnsubscribe} disabled={!token || unsubscribe.isPending}>
              {unsubscribe.isPending ? "Enregistrement…" : "Confirmer la désinscription"}
            </Button>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
