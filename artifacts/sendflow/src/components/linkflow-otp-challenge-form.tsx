import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const otpSchema = z.object({
  otp: z.string().regex(/^[0-9]{4,12}$/, "Saisissez le code numérique reçu."),
});

type OtpFormValues = z.infer<typeof otpSchema>;

type LinkFlowOtpChallengeFormProps = {
  otpMethod: "sms" | "ussd" | "app" | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (otp: string) => Promise<boolean>;
};

function methodInstruction(method: LinkFlowOtpChallengeFormProps["otpMethod"]) {
  if (method === "sms") return "Saisissez le code envoyé par SMS par votre opérateur.";
  if (method === "ussd") return "Composez la consigne de l’opérateur, récupérez votre code, puis saisissez-le ici.";
  if (method === "app") return "Saisissez le code demandé par l’application de votre opérateur.";
  return "Suivez l’instruction de votre opérateur, puis saisissez le code reçu.";
}

export default function LinkFlowOtpChallengeForm({
  otpMethod,
  submitting,
  error,
  onSubmit,
}: LinkFlowOtpChallengeFormProps) {
  const form = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
    mode: "onChange",
  });

  const submit = form.handleSubmit(async ({ otp }) => {
    if (await onSubmit(otp)) form.reset();
  });

  return (
    <Form {...form}>
      <form className="sendflow-linkflow-otp-form" onSubmit={submit} noValidate>
        <p className="sendflow-linkflow-otp-instruction" data-testid="text-otp-instruction">
          {methodInstruction(otpMethod)}
        </p>
        <FormField
          control={form.control}
          name="otp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code OTP</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={12}
                  placeholder="123456"
                  disabled={submitting}
                  data-testid="input-payment-otp"
                  onChange={(event) => field.onChange(event.target.value.replace(/\D/g, "").slice(0, 12))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error && <p className="sendflow-linkflow-otp-error" role="alert" data-testid="status-otp-error">{error}</p>}
        <Button
          type="submit"
          className="sendflow-linkflow-otp-submit"
          disabled={submitting || !form.formState.isValid}
          data-testid="button-confirm-payment-otp"
        >
          {submitting ? "Vérification…" : "Confirmer le code"}
        </Button>
        <p className="sendflow-linkflow-otp-privacy">
          Ne partagez pas ce code. Il sert uniquement à confirmer cette demande auprès de l’opérateur.
        </p>
      </form>
    </Form>
  );
}
