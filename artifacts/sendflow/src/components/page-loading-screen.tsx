interface PageLoadingScreenProps {
  label?: string;
}

export default function PageLoadingScreen({
  label = 'Chargement de la page',
}: PageLoadingScreenProps) {
  return (
    <main
      className="sendflow-page-loading"
      role="status"
      aria-live="polite"
      aria-label={label}
      data-testid="status-page-loading"
    >
      <span className="sendflow-page-loader" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
    </main>
  );
}
