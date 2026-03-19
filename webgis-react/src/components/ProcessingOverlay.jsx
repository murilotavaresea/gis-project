import React from "react";

export default function ProcessingOverlay({
  active = false,
  title = "Processando",
  message = "Aguarde enquanto a operacao e preparada.",
}) {
  if (!active) {
    return null;
  }

  return (
    <div className="processing-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="processing-card">
        <div className="processing-cardHeader">
          <span className="processing-spinner" aria-hidden="true" />
          <strong>{title}</strong>
        </div>
        <p>{message}</p>
      </div>
    </div>
  );
}
