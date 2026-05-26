import React, { useCallback, useState } from 'react';
import config from '../config';
import MapBiomasChart from './MapBiomasChart';

const API_URL = `${config.API_BASE_URL}/mapbiomas/analise`;

const ANOS_RECENTES = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const ANOS_DECADAL  = [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024];

const COLECOES = [
  {
    id: 'lulc',
    label: 'LULC',
    descricao: 'Uso e cobertura do solo (visão geral)',
    habilitado: true,
  },
  {
    id: 'pastagem',
    label: 'Pastagem',
    descricao: 'Qualidade e degradação de pastagem',
    habilitado: false,
    aviso: 'Path no GCS ainda não localizado — em breve',
  },
  {
    id: 'agricultura',
    label: 'Agricultura',
    descricao: 'Culturas agrícolas detalhadas',
    habilitado: false,
    aviso: 'Path no GCS ainda não localizado — em breve',
  },
];

function extrairGeometria(camada) {
  if (!camada) return null;
  if (camada.type === 'FeatureCollection') return camada;
  if (camada.type === 'Feature')           return camada;
  if (camada.type === 'Polygon' || camada.type === 'MultiPolygon') return camada;
  return null;
}

/**
 * Painel lateral de análise MapBiomas Coleção 10.1.
 *
 * Props:
 *   geometriaImovel – GeoJSON (Feature, FeatureCollection ou Geometry) do imóvel
 */
export default function MapBiomasPanel({ geometriaImovel }) {
  const [anosSelecionados, setAnosSelecionados]       = useState([2023, 2024]);
  const [colecoesSelecionadas, setColecoesSelecionadas] = useState(['lulc']);
  const [resultado, setResultado]                     = useState(null);
  const [carregando, setCarregando]                   = useState(false);
  const [erro, setErro]                               = useState(null);
  const [modoAnos, setModoAnos]                       = useState('recentes'); // 'recentes' | 'decadal' | 'custom'

  const geom = extrairGeometria(geometriaImovel);

  const toggleAno = useCallback((ano) => {
    setAnosSelecionados((prev) =>
      prev.includes(ano) ? prev.filter((a) => a !== ano) : [...prev, ano].sort()
    );
  }, []);

  const toggleColecao = useCallback((id) => {
    setColecoesSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }, []);

  const selecionarModo = useCallback((modo) => {
    setModoAnos(modo);
    if (modo === 'recentes') setAnosSelecionados([2023, 2024]);
    if (modo === 'decadal')  setAnosSelecionados([...ANOS_DECADAL]);
  }, []);

  const analisar = useCallback(async () => {
    if (!geom) return;
    if (anosSelecionados.length === 0) {
      setErro('Selecione ao menos um ano.');
      return;
    }
    if (colecoesSelecionadas.length === 0) {
      setErro('Selecione ao menos uma coleção.');
      return;
    }

    setCarregando(true);
    setErro(null);
    setResultado(null);

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geometria: geom,
          anos:      anosSelecionados,
          colecoes:  colecoesSelecionadas,
        }),
      });

      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json.erro || `Erro HTTP ${resp.status}`);
      }

      setResultado(json);
    } catch (err) {
      setErro(err.message || 'Erro ao consultar MapBiomas.');
    } finally {
      setCarregando(false);
    }
  }, [geom, anosSelecionados, colecoesSelecionadas]);

  const totalHa = resultado?.meta?.area_total_ha ?? 0;

  return (
    <div className="mb-panel">
      {/* Cabeçalho informativo */}
      <div className="mb-panel-header">
        <div className="mb-panel-badge">MapBiomas</div>
        <span className="mb-panel-versao">Coleção 10.1 · 1985–2024</span>
      </div>

      {/* Aviso se não há imóvel carregado */}
      {!geom && (
        <div className="mb-panel-aviso">
          Carregue ou busque um imóvel rural no mapa para habilitar a análise.
        </div>
      )}

      {/* Seleção de anos */}
      <section className="mb-section">
        <div className="mb-section-title">
          Período
          <div className="mb-modo-btns">
            {[['recentes', 'Recentes'], ['decadal', 'Decadal']].map(([modo, label]) => (
              <button
                key={modo}
                type="button"
                className={`mb-modo-btn ${modoAnos === modo ? 'active' : ''}`}
                onClick={() => selecionarModo(modo)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={`mb-modo-btn ${modoAnos === 'custom' ? 'active' : ''}`}
              onClick={() => setModoAnos('custom')}
            >
              Personalizar
            </button>
          </div>
        </div>

        <div className="mb-anos-grid">
          {(modoAnos === 'recentes' ? ANOS_RECENTES : ANOS_DECADAL).map((ano) => (
            <label key={ano} className="mb-ano-label">
              <input
                type="checkbox"
                checked={anosSelecionados.includes(ano)}
                onChange={() => toggleAno(ano)}
              />
              {ano}
            </label>
          ))}
        </div>

        {modoAnos === 'custom' && (
          <p className="mb-custom-hint">
            Selecione anos individualmente acima ou use os modos rápidos.
          </p>
        )}
      </section>

      {/* Seleção de coleções */}
      <section className="mb-section">
        <div className="mb-section-title">Coleções</div>
        <div className="mb-colecoes">
          {COLECOES.map((col) => (
            <label
              key={col.id}
              className={`mb-colecao-label ${!col.habilitado ? 'disabled' : ''}`}
              title={col.aviso || col.descricao}
            >
              <input
                type="checkbox"
                checked={colecoesSelecionadas.includes(col.id)}
                onChange={() => col.habilitado && toggleColecao(col.id)}
                disabled={!col.habilitado}
              />
              <span className="mb-colecao-nome">{col.label}</span>
              <span className="mb-colecao-desc">{col.descricao}</span>
              {col.aviso && <span className="mb-colecao-aviso">⚠</span>}
            </label>
          ))}
        </div>
      </section>

      {/* Botão de análise */}
      <button
        type="button"
        className="mb-btn-analisar"
        onClick={analisar}
        disabled={!geom || carregando || anosSelecionados.length === 0}
      >
        {carregando ? (
          <>
            <span className="mb-spinner" aria-hidden="true" />
            Consultando COGs…
          </>
        ) : (
          'Analisar cobertura'
        )}
      </button>

      {/* Erro */}
      {erro && (
        <div className="mb-panel-erro" role="alert">
          {erro}
        </div>
      )}

      {/* Resultados */}
      {resultado && !erro && (
        <div className="mb-resultados">
          {resultado.meta && (
            <div className="mb-meta">
              Imóvel: <strong>{totalHa} ha</strong> · Processado em{' '}
              <strong>{resultado.meta.tempo_processamento_s}s</strong> ·{' '}
              resolução 30 m
            </div>
          )}

          {['lulc', 'pastagem', 'agricultura'].map((col) => {
            if (!resultado[col]) return null;
            return Object.entries(resultado[col])
              .sort(([a], [b]) => parseInt(b) - parseInt(a))
              .map(([ano, dados]) => (
                <MapBiomasChart
                  key={`${col}-${ano}`}
                  titulo={`${col.toUpperCase()} ${ano}`}
                  dados={dados}
                  totalHa={totalHa}
                />
              ));
          })}
        </div>
      )}

      <div className="mb-panel-creditos">
        Dados: MapBiomas Brasil Coleção 10.1 · Licença CC-BY 4.0
      </div>
    </div>
  );
}
