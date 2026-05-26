import React, { useState } from 'react';

/**
 * Gráfico de barras horizontais para exibir cobertura/uso do solo MapBiomas.
 *
 * Props:
 *   dados     – objeto { NomeClasse: { ha, pct, cor, codigo, pixels } }
 *   titulo    – ex. "LULC 2024"
 *   totalHa   – área total do imóvel em ha (para porcentagem de referência)
 */
export default function MapBiomasChart({ dados = {}, titulo = '', totalHa = 0 }) {
  const [expandido, setExpandido] = useState(true);

  const entradas = Object.entries(dados)
    .filter(([, v]) => !v.erro && !v.aviso && typeof v.ha === 'number')
    .sort((a, b) => b[1].ha - a[1].ha);

  if (entradas.length === 0) {
    const msg = dados.erro || dados.aviso || 'Sem dados para este período.';
    return (
      <div className="mb-chart-empty">
        <span>{msg}</span>
      </div>
    );
  }

  const maxHa = entradas[0][1].ha;
  const totalAnalisado = entradas.reduce((s, [, v]) => s + v.ha, 0);

  return (
    <div className="mb-chart">
      <button
        type="button"
        className="mb-chart-toggle"
        onClick={() => setExpandido((e) => !e)}
        aria-expanded={expandido}
      >
        <span className="mb-chart-titulo">{titulo}</span>
        <span className="mb-chart-total">{totalAnalisado.toFixed(1)} ha</span>
        <span className="mb-chart-arrow">{expandido ? '▲' : '▼'}</span>
      </button>

      {expandido && (
        <div className="mb-chart-body">
          {entradas.map(([nome, info]) => {
            const barWidth = maxHa > 0 ? (info.ha / maxHa) * 100 : 0;
            return (
              <div key={info.codigo ?? nome} className="mb-bar-item">
                <div className="mb-bar-header">
                  <span
                    className="mb-bar-swatch"
                    style={{ background: info.cor || '#aaa' }}
                    aria-hidden="true"
                  />
                  <span className="mb-bar-nome">{nome}</span>
                  <span className="mb-bar-valores">
                    {info.ha.toFixed(1)} ha
                    <em>{info.pct.toFixed(1)}%</em>
                  </span>
                </div>
                <div className="mb-bar-track" aria-hidden="true">
                  <div
                    className="mb-bar-fill"
                    style={{ width: `${barWidth}%`, background: info.cor || '#aaa' }}
                  />
                </div>
              </div>
            );
          })}

          {totalHa > 0 && (
            <div className="mb-chart-footer">
              <span>
                Analisado: {totalAnalisado.toFixed(1)} ha /{' '}
                {((totalAnalisado / totalHa) * 100).toFixed(1)}% do imóvel
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
