import {
  Component,
  type ComponentType,
  type ReactNode,
} from 'react';
import { CircleAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ resetError }: ErrorFallbackProps) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <AlertDialog open onOpenChange={(open) => { if (!open) resetError(); }}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-[380px] gap-5 rounded-[26px] border-0 bg-white px-6 py-7 shadow-2xl sm:rounded-[26px]">
          <AlertDialogHeader className="items-center space-y-4 text-center">
            <div className="flex size-[68px] items-center justify-center rounded-full bg-red-50 text-red-500" aria-hidden="true">
              <CircleAlert className="size-8" strokeWidth={2.2} />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-foreground">
              Une erreur est survenue
            </AlertDialogTitle>
            <AlertDialogDescription className="max-w-[300px] text-[15px] leading-6">
              Un problème empêche l’affichage de cette page. Réessayez. Si le problème persiste, contactez le service client SendFlow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1">
            <AlertDialogAction
              onClick={resetError}
              className="h-12 w-full rounded-full text-base font-semibold"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(): void {
    console.error('SendFlow encountered a page rendering error.');
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
