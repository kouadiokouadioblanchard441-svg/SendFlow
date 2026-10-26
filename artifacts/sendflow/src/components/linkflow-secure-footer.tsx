import sendflowWordmark from '@assets/sendflow-wordmark-original.png';
import securePaymentMark from '@assets/generated_images/sendflow-secure-payment-mark-3d-clean.png';

export default function LinkFlowSecureFooter() {
  return (
    <footer className="sendflow-linkflow-secure-footer" aria-label="Paiement sécurisé par SendFlow">
      <span>Paiement sécurisé par</span>
      <img className="sendflow-linkflow-secure-wordmark" src={sendflowWordmark} alt="" aria-hidden="true" />
      <img className="sendflow-linkflow-secure-mark" src={securePaymentMark} alt="" aria-hidden="true" />
    </footer>
  );
}
