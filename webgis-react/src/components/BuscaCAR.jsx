import React, { useState, useRef } from 'react';
import axios from 'axios';
import L from 'leaflet';
import tokml from 'tokml';

export default function BuscaCAR({
  map,
  drawnItemsRef,
  onClose,
  visivel = true,
  setCarLayerBusca,
}) {
  const [codigoCAR, setCodigoCAR] = useState('');
  const [buscando, setBuscando] = useState(false);
  const carLayerRef = useRef(null);

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

      if (!data.features || data.features.length === 0) {
        alert('Imóvel não encontrado.');
        return;
      }

      if (carLayerRef.current) {
        drawnItemsRef.current.removeLayer(carLayerRef.current);
      }

      const layer = new L.GeoJSON(data, {
        style: {
          color: '#c38f5d',
          weight: 3,
          fillOpacity: 0,
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          layer.bindPopup(`<b>${props.inscricaocar}</b><br>${props.municipio}`);
        },
      });

      layer.addTo(drawnItemsRef.current);
      map.fitBounds(layer.getBounds());
      carLayerRef.current = layer;

      if (setCarLayerBusca) {
        setCarLayerBusca(layer); // ✅ comunica ao App ou DrawTools
      }

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
    if (setCarLayerBusca) {
      setCarLayerBusca(null);
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
        <button className="fechar" onClick={onClose} type="button">x</button>
      </div>

      <input
        type="text"
        placeholder="Digite o código do CAR"
        value={codigoCAR}
        onChange={(e) => setCodigoCAR(e.target.value)}
      />
      <button onClick={buscarCAR} disabled={buscando} type="button">
        {buscando ? 'Buscando...' : 'Buscar'}
      </button>
      <button onClick={limparCAR} disabled={!carLayerRef.current} type="button">
        Limpar
      </button>
      <button onClick={exportarCAR} disabled={!carLayerRef.current} type="button">
        Exportar
      </button>
    </div>
  );
}
