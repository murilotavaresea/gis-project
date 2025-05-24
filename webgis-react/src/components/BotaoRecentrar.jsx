import React from 'react';
import { useMap } from 'react-leaflet';

export default function BotaoRecentrar() {
  const map = useMap();

  const handleClick = () => {
    console.log("📍 Botão Recentralizar foi clicado");
    if (map) {
      console.log("✅ Mapa encontrado. Recentralizando...");
      map.setView([-14.8, -51.5], 5);
    } else {
      console.warn("⚠️ Mapa não encontrado!");
    }
  };

  return (
    <button onClick={handleClick} style={{ padding: '8px 12px', borderRadius: '6px' }}>
      <img src="/icons/centralizar.png" alt="Recentralizar" style={{ width: '24px', height: '24px' }} />
    </button>
  );
}
