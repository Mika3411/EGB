export default function AiGenerationStatus({ isBusy = false }) {
  if (!isBusy) return null;

  return (
    <div className="ai-generation-overlay" role="status" aria-live="polite">
      <div className="ai-generation-modal">
        <span className="ai-generation-spinner" aria-hidden="true" />
        <strong>Génération en cours...</strong>
        <span>Veuillez patienter, cela peut prendre quelques minutes.</span>
      </div>
    </div>
  );
}
