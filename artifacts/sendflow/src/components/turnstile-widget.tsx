import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  getGetTurnstileConfigQueryKey,
  useGetTurnstileConfig,
} from "@workspace/api-client-react";

type TurnstileWidgetApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "light";
      size: "flexible";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidgetApi;
  }
}

export type TurnstileWidgetHandle = {
  reset: () => void;
};

type TurnstileWidgetProps = {
  action: "login" | "signup" | "password_reset" | "pin_reset";
  onTokenChange: (token: string | null) => void;
  onErrorMessage?: (message: string) => void;
};

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.sendflowTurnstile = "true";
    script.onload = () => {
      if (window.turnstile) resolve();
      else reject(new Error("Turnstile did not initialize"));
    };
    script.onerror = () => reject(new Error("Turnstile script could not load"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    turnstileScriptPromise = null;
    document.querySelector("script[data-sendflow-turnstile]")?.remove();
    throw error;
  });

  return turnstileScriptPromise;
}

const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ action, onTokenChange, onErrorMessage }, ref) {
    const configuration = useGetTurnstileConfig({
      query: {
        queryKey: getGetTurnstileConfigQueryKey(),
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    });
    const siteKey = configuration.data?.siteKey?.trim() ?? "";
    const configurationUnavailable =
      !configuration.isLoading && (configuration.isError || !siteKey);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenChangeRef = useRef(onTokenChange);
    const onErrorMessageRef = useRef(onErrorMessage);
    const [state, setState] = useState<
      "loading" | "ready" | "verified" | "expired" | "error"
    >("loading");
    const [retryNumber, setRetryNumber] = useState(0);

    useEffect(() => {
      onTokenChangeRef.current = onTokenChange;
    }, [onTokenChange]);

    useEffect(() => {
      onErrorMessageRef.current = onErrorMessage;
    }, [onErrorMessage]);

    const reset = useCallback(() => {
      onTokenChangeRef.current(null);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setState("ready");
      } else {
        setState(configurationUnavailable ? "error" : "loading");
      }
    }, [configurationUnavailable]);

    useImperativeHandle(ref, () => ({ reset }), [reset]);

    useEffect(() => {
      let active = true;
      setState(configurationUnavailable ? "error" : "loading");
      onTokenChangeRef.current(null);

      if (configuration.isLoading)
        return () => {
          active = false;
        };
      if (configurationUnavailable)
        return () => {
          active = false;
        };
      if (!siteKey || !containerRef.current)
        return () => {
          active = false;
        };

      void loadTurnstileScript()
        .then(() => {
          if (!active || !containerRef.current || !window.turnstile) return;
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            action,
            theme: "light",
            size: "flexible",
            callback: (token) => {
              if (!active || typeof token !== "string" || token.length === 0)
                return;
              onTokenChangeRef.current(token);
              setState("verified");
            },
            "error-callback": () => {
              if (!active) return;
              onTokenChangeRef.current(null);
              setState("error");
            },
            "expired-callback": () => {
              if (!active) return;
              onTokenChangeRef.current(null);
              setState("expired");
            },
            "timeout-callback": () => {
              if (!active) return;
              onTokenChangeRef.current(null);
              setState("expired");
            },
          });
          setState("ready");
        })
        .catch(() => {
          if (!active) return;
          onTokenChangeRef.current(null);
          setState("error");
        });

      return () => {
        active = false;
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
        }
        widgetIdRef.current = null;
      };
    }, [
      action,
      retryNumber,
      siteKey,
      configuration.isLoading,
      configurationUnavailable,
    ]);

    const message = configurationUnavailable
      ? "La vérification de sécurité n’est pas configurée. Réessayez plus tard."
      : configuration.isLoading || state === "loading"
        ? "Chargement de la vérification de sécurité…"
        : state === "expired"
          ? "La vérification a expiré. Validez à nouveau."
          : state === "error"
            ? "La vérification ne peut pas être chargée. Réessayez."
            : null;
    const errorMessage =
      state === "expired" || state === "error" ? message : null;

    useEffect(() => {
      if (errorMessage) onErrorMessageRef.current?.(errorMessage);
    }, [errorMessage]);

    return (
      <div className="sendflow-turnstile" data-state={state}>
        <div
          ref={containerRef}
          className="sendflow-turnstile-widget"
          aria-label="Vérification de sécurité"
        />
        {message && (!onErrorMessage || !errorMessage) && (
          <p
            className="sendflow-turnstile-status"
            role={state === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {message}
          </p>
        )}
        {state === "error" && (
          <button
            type="button"
            className="sendflow-turnstile-retry"
            onClick={() => {
              if (configurationUnavailable) void configuration.refetch();
              else setRetryNumber((current) => current + 1);
            }}
          >
            Réessayer
          </button>
        )}
      </div>
    );
  },
);

TurnstileWidget.displayName = "TurnstileWidget";

export default TurnstileWidget;
