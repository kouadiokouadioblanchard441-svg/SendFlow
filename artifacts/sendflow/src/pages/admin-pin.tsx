import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  getGetAdminAccessStatusQueryKey,
  useGetAdminAccessStatus,
  useUnlockAdminPin,
} from "@workspace/api-client-react";
import { z } from "zod";
import { Redirect, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { adminRoute } from "@/lib/admin-route";
import { useSeo } from "@/lib/seo";

const adminPinSchema = z.object({
  pin: z.string().length(8).regex(/^[0-9]{8}$/),
});
type AdminPinValues = z.infer<typeof adminPinSchema>;

function pinErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "La vérification du PIN a échoué. Réessayez.";
  const status = "status" in error ? error.status : undefined;
  if (status === 429) return "Trop de tentatives. Réessayez après le délai indiqué.";
  if (status === 503) return "La vérification du PIN est temporairement indisponible.";
  if (status === 403) return "PIN incorrect ou compte non autorisé.";
  if ("data" in error && error.data && typeof error.data === "object"
    && "error" in error.data && typeof error.data.error === "string") return error.data.error;
  return "La vérification du PIN a échoué. Réessayez.";
}

export default function AdminPinPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const accessQuery = useGetAdminAccessStatus({
    query: {
      queryKey: getGetAdminAccessStatusQueryKey(),
      retry: false,
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });
  const unlockPin = useUnlockAdminPin();
  const form = useForm<AdminPinValues>({
    resolver: zodResolver(adminPinSchema),
    defaultValues: { pin: "" },
  });

  useSeo({
    path: adminRoute("/pin"),
    locale: "fr",
    title: "Vérification administrateur · SendFlow",
    description: "Vérification sécurisée du compte administrateur SendFlow.",
    robots: "noindex,nofollow",
  });

  if (accessQuery.isLoading) {
    return <main role="status" className="flex min-h-screen items-center justify-center bg-background p-6 text-muted-foreground">
      Vérification de l’accès administrateur…
    </main>;
  }

  if (accessQuery.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <section className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-xl font-semibold">Vérification indisponible</h1>
          <p className="text-sm text-muted-foreground">
            Le serveur n’a pas pu confirmer les droits administrateur. Réessayez plus tard.
          </p>
          <Button type="button" variant="outline" onClick={() => void accessQuery.refetch()}>
            Réessayer
          </Button>
        </section>
      </main>
    );
  }

  if (!accessQuery.data?.isAdmin) return <Redirect to={adminRoute("/sign-in")} />;
  if (accessQuery.data.pinUnlocked) return <Redirect to={adminRoute("/operator-pricing")} />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">SendFlow · Administrateur</p>
          <h1 className="text-2xl font-semibold tracking-tight">Vérification du PIN</h1>
          <p className="text-sm text-muted-foreground">
            Saisissez le PIN associé au compte administrateur autorisé.
          </p>
        </div>
        <Form {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                const result = await unlockPin.mutateAsync({ data: values });
                if (!result.pinUnlocked) {
                  form.setError("pin", { message: "Le serveur n’a pas confirmé le déverrouillage." });
                  return;
                }
                form.reset({ pin: "" });
                await queryClient.invalidateQueries({ queryKey: getGetAdminAccessStatusQueryKey() });
                setLocation(adminRoute("/operator-pricing"));
              } catch (error) {
                form.setError("pin", { message: pinErrorMessage(error) });
              }
            })}
          >
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PIN administrateur</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      inputMode="numeric"
                      autoComplete="current-password"
                      pattern="[0-9]{8}"
                      maxLength={8}
                      onChange={(event) => field.onChange(event.target.value.replace(/\D/g, "").slice(0, 8))}
                      data-testid="input-admin-pin"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setLocation("/account-info")}>
                Retour au profil
              </Button>
              <Button type="submit" disabled={unlockPin.isPending || form.watch("pin").length !== 8}>
                {unlockPin.isPending ? "Vérification…" : "Ouvrir le panel"}
              </Button>
            </div>
          </form>
        </Form>
      </section>
    </main>
  );
}
