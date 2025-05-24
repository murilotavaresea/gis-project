import React, { useState, useRef } from 'react';
import axios from 'axios';
import L from 'leaflet';
import tokml from 'tokml';

export default function BuscaCAR({ map, drawnItemsRef, onClose, visivel = true }) {
  const [codigoCAR, setCodigoCAR] = useState('');
  const [buscando, setBuscando] = useState(false);
  const carLayerRef = useRef(null);  // Referência persistente do layer

  const buscarCAR = async () => {
    if (!codigoCAR) return;
    setBuscando(true);

    const uf = codigoCAR.substring(0, 2).toLowerCase();
    const ufsValidas = [
      'ac', 'al', 'am', 'ap', 'ba', 'ce', 'df', 'es', 'go', 'ma',
      'mg', 'ms', 'mt', 'pa', 'pb', 'pe', 'pi', 'pr', 'rj', 'rn',
      'ro', 'rr', 'rs', 'sc', 'se', 'sp', 'to'
    ];

    if (!ufsValidas.includes(uf)) {
      alert('UF inválida no código do CAR.');
      setBuscando(false);
      return;
    }

    const wfsUrl = `https://geoserver.car.gov.br/geoserver/sicar/ows`;
    const typeName = `sicar:sicar_imoveis_${uf}`;
    const url = `${wfsUrl}?service=WFS&version=1.0.0&request=GetFeature&typeName=${typeName}&outputFormat=application/json&CQL_FILTER=cod_imovel='${codigoCAR}'`;

    try {
      const { data } = await axios.get(url);

      if (data.features.length === 0) {
        alert('Imóvel não encontrado.');
        return;
      }

      // Remove anterior, se existir
      if (carLayerRef.current) {
        drawnItemsRef.current.removeLayer(carLayerRef.current);
      }

      const layer = new L.GeoJSON(data, {
        style: {
          color: 'purple',
          weight: 3,
          fillOpacity: 0
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          layer.bindPopup(`<b>${props.inscricaocar}</b><br>${props.municipio}`);
        }
      });

      layer.addTo(drawnItemsRef.current);
      map.fitBounds(layer.getBounds());
      carLayerRef.current = layer;

    } catch (error) {
      console.error('Erro na busca WFS:', error);
      alert('Erro ao buscar CAR.');
    } finally {
      setBuscando(false);
    }
  };

  const limparCAR = () => {
    if (carLayerRef.current) {
      drawnItemsRef.current.removeLayer(carLayerRef.current);
      carLayerRef.current = null;
    }
  };

  const exportarCAR = () => {
    if (!carLayerRef.current) return;

    const geojson = carLayerRef.current.toGeoJSON();
    const kml = tokml(geojson);
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${codigoCAR}.kml`;
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="painel-busca-car" style={{ display: visivel ? 'block' : 'none' }}>
      <div className="topo">
        <strong>Buscar CAR</strong>
        <button className="fechar" onClick={onClose}>✖</button>
      </div>

      <input
        type="text"
        placeholder="Digite o código do CAR"
        value={codigoCAR}
        onChange={(e) => setCodigoCAR(e.target.value)}
      />
      <button onClick={buscarCAR} disabled={buscando}>
        {buscando ? 'Buscando...' : 'Buscar'}
      </button>
      <button onClick={limparCAR} disabled={!carLayerRef.current}>
        Limpar
      </button>
      <button onClick={exportarCAR} disabled={!carLayerRef.current}>
        Exportar
      </button>
    </div>
  );
}
