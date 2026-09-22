import { useEffect } from 'react';
import depositSuccessIllustration from '@assets/generated_images/sendflow-deposit-success-3d-alpha.png';
import depositFailureIllustration from '@assets/generated_images/sendflow-deposit-failure-3d-alpha.png';
import depositPendingIllustration from '@assets/generated_images/sendflow-deposit-pending-3d-alpha.png';

export type TransferRequestState = 'idle' | 'pending' | 'success' | 'failure';

type TransferRequestDialogProps = {
  state: TransferRequestState;
  operation: string;
  pendingLabel: string;
  amountLabel: string;
  amount: string;
  metaLabel: string;
  metaValue: string;
  pendingCopy: string;
  successTitle: string;
  successCopy: string;
  failureTitle: string;
  failureCopy: string;
  cancelLabel: string;
  successButtonLabel: string;
  failureButtonLabel: string;
  onClose: () => void;
};

export function TransferRequestDialog({
  state,
  operation,
  pendingLabel,
  amountLabel,
  amount,
  metaLabel,
  metaValue,
  pendingCopy,
  successTitle,
  successCopy,
  failureTitle,
  failureCopy,
  cancelLabel,
  successButtonLabel,
  failureButtonLabel,
  onClose,
}: TransferRequestDialogProps) {
  useEffect(() => {
    if (state === 'idle') return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [state]);

  if (state === 'idle') return null;

  const titleId = `sendflow-${operation.toLowerCase().replace(/\s+/g, '-')}-request-title`;

  return (
    <div className="sendflow-deposit-request-layer">
      <section
        className={`sendflow-deposit-request-card is-${state}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-live="polite"
      >
        {state === 'pending' && (
          <div className="sendflow-deposit-request-state">
            <div className="sendflow-deposit-pending-art">
              <img src={depositPendingIllustration} alt="" />
            </div>
            <div className="sendflow-deposit-pending-dots" aria-label="Validation en cours">
              <span />
              <span />
              <span />
            </div>
            <header className="sendflow-deposit-request-header">
              <span>{pendingLabel}</span>
              <h2 id={titleId}>{operation}</h2>
            </header>
            <div className="sendflow-deposit-request-amount">
              <span>{amountLabel}</span>
              <strong>{amount} <small>FCFA</small></strong>
            </div>
            <div className="sendflow-deposit-request-meta">
              <span>{metaLabel}</span>
              <strong>{metaValue}</strong>
            </div>
            <p className="sendflow-deposit-request-copy">{pendingCopy}</p>
            <button type="button" className="sendflow-deposit-request-cancel" onClick={onClose}>
              {cancelLabel}
            </button>
          </div>
        )}

        {state === 'success' && (
          <div className="sendflow-deposit-request-state is-success">
            <div className="sendflow-deposit-success-art">
              <img src={depositSuccessIllustration} alt="" />
            </div>
            <h2 id={titleId}>{successTitle}</h2>
            <p>{successCopy}</p>
            <button type="button" className="sendflow-deposit-request-confirm" onClick={onClose}>
              {successButtonLabel}
            </button>
          </div>
        )}

        {state === 'failure' && (
          <div className="sendflow-deposit-request-state is-failure">
            <div className="sendflow-deposit-failure-art">
              <img src={depositFailureIllustration} alt="" />
            </div>
            <h2 id={titleId}>{failureTitle}</h2>
            <p>{failureCopy}</p>
            <button type="button" className="sendflow-deposit-request-confirm" onClick={onClose}>
              {failureButtonLabel}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}