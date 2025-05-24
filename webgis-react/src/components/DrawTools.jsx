import React, { useState } from 'react';
import L from 'leaflet';
import tokml from 'tokml';
import * as turf from '@turf/turf';
import 'leaflet-draw'; // importante para registrar os eventos
import BotaoRecentrar from './BotaoRecentrar';
import { useMap } from 'react-leaflet';
import BuscaCAR from './BuscaCAR';





function MeasurementPanel({ tipo, unidade, setUnidade, resultado, onReset, onClose }) {
  return (
    <div id="measurement-panel">
      <button className="close-button" onClick={onClose}>✖</button>
      <h3>{tipo === 'polygon' ? 'MEDIR ÁREA' : 'MEDIR DISTÂNCIA'}</h3>
      <div className="unit-selector">
        <label>Unidade:</label>
        <select value={unidade} onChange={e => setUnidade(e.target.value)}>
          {tipo === 'polygon' ? (
            <>
              <option value="m²">m²</option>
              <option value="ha">hectares</option>
              <option value="km²">km²</option>
              <option value="alq">alqueires paulistas</option>
            </>
          ) : (
            <>
              <option value="m">metros</option>
              <option value="km">quilômetros</option>
            </>
          )}
        </select>
      </div>
      <div><strong>Resultado:</strong> {resultado}</div>
      <button className="reset-button" onClick={onReset}>Resetar</button>
    </div>
  );
}





export default function DrawTools({
  mapRef,
  drawnItemsRef,
  fileInputRef,
  fileInputRefCAR,
  resetMapView,
  camadasImportadas,
  setCamadasImportadas,
  setDesenhos,
  areaDoImovelLayer,
  setAreaDoImovelLayer,
  camadas
}) {

  const [showDrawSubmenu, setShowDrawSubmenu] = useState(false);
  const [showMeasureSubmenu, setShowMeasureSubmenu] = useState(false);
  const [tipoMedicao, setTipoMedicao] = useState(null);
  const [unidade, setUnidade] = useState('ha');
  const [resultado, setResultado] = useState('');
const [linhasMedicao, setLinhasMedicao] = useState([]);
const [medindo, setMedindo] = useState(false);
const [medicaoDrawer, setMedicaoDrawer] = useState(null);
const [mostrarBuscaCAR, setMostrarBuscaCAR] = useState(false);




  const map = useMap(); // 🎯 obtém o objeto do mapa diretamente
  const toggleMeasurementPanel = () => {
    setShowMeasureSubmenu(prev => {
      const novoEstado = !prev;
      if (!novoEstado) {
        setTipoMedicao(null);
        setResultado('');
      }
      return novoEstado;
    });
  };

  const startDraw = (tipo) => {
 


  if (!map || !drawnItemsRef.current || !drawnItemsRef.current._map) {
  console.warn("⚠️ Mapa ou drawnItemsRef ainda não estão prontos");
  return;
}


  console.log("🟢 Iniciando desenho:", tipo);


    const options = { shapeOptions: { color: '#3388ff' } };
    let drawer;
    switch (tipo) {
      case 'polygon': drawer = new L.Draw.Polygon(map, options); break;
      case 'rectangle': drawer = new L.Draw.Rectangle(map, options); break;
      case 'polyline': drawer = new L.Draw.Polyline(map, options); break;
      case 'marker':
  const customMarker = new L.Icon({
    iconUrl: '/icons/marker.png',   // caminho do seu ícone
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  drawer = new L.Draw.Marker(map, { icon: customMarker });
  break;

      default: return;
    }
    drawer.enable();
    map.once(L.Draw.Event.CREATED, function (e) {
      drawnItemsRef.current.addLayer(e.layer);
      setDesenhos(prev => [...prev, {
        tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1),
        layer: e.layer,
        exportar: true
      }]);
    });
  };

  

  const startMeasurement = (tipo) => {
  if (!map) return;

  setTipoMedicao(tipo);
  setResultado('');
  setLinhasMedicao([]);
  setMedindo(true);

  const shapeOptions = { color: 'orange' };
const novoDrawer = tipo === 'polygon'
  ? new L.Draw.Polygon(map, { shapeOptions })
  : new L.Draw.Polyline(map, { shapeOptions });

novoDrawer.enable();
setMedicaoDrawer(novoDrawer);
 // 👈 guarda referência



  map.once(L.Draw.Event.CREATED, function (e) {
    const layer = e.layer;
    const geojson = layer.toGeoJSON();

    if (tipo === 'polygon') {
      const areaM2 = turf.area(geojson);
      let valor = 0;
      let unidadeStr = '';
      switch (unidade) {
        case 'm²': valor = areaM2; unidadeStr = 'm²'; break;
        case 'ha': valor = areaM2 / 10000; unidadeStr = 'hectares'; break;
        case 'km²': valor = areaM2 / 1e6; unidadeStr = 'km²'; break;
        case 'alq': valor = areaM2 / 24200; unidadeStr = 'alqueires'; break;
        default: valor = areaM2; unidadeStr = 'm²';
      }

      const center = layer.getBounds().getCenter();
      L.popup()
        .setLatLng(center)
        .setContent(`<b>${valor.toFixed(2)} ${unidadeStr}</b>`)
        .openOn(map);

      setResultado(`${valor.toFixed(2)} ${unidadeStr}`);
      drawnItemsRef.current.addLayer(layer);
      setMedindo(false); // fim da medição
    } else {
      // cálculo dos segmentos de linha
      const coords = geojson.geometry.coordinates;
      let total = 0;
      const segmentos = [];

      for (let i = 1; i < coords.length; i++) {
        const seg = turf.lineString([coords[i - 1], coords[i]]);
        const dist = turf.length(seg, { units: unidade === 'km' ? 'kilometers' : 'meters' });
        total += dist;
        segmentos.push({ segmento: `${i} → ${i + 1}`, valor: dist });
      }

      setLinhasMedicao(segmentos);
      setResultado(`Distância total: ${unidade === 'km' ? total.toFixed(2) + ' km' : (total * 1000).toFixed(2) + ' m'}`);
      drawnItemsRef.current.addLayer(layer);
      setMedindo(false);
    }
  });
};


  const resetMeasurement = () => {
    drawnItemsRef.current.clearLayers();
    setResultado('');
  };

 const exportarKML = () => {
  const features = [];

  drawnItemsRef.current.eachLayer(layer => {
    let feature = layer.toGeoJSON();

    // Garante que estamos lidando com uma Feature
    if (feature.type === 'FeatureCollection') {
      feature = feature.features[0];
    }

    let coords = turf.getCoords(feature);
    let numVertices = coords.flat(Infinity).length;

    // 🔁 Se mais de 100 vértices, simplifica iterativamente
    if (numVertices > 100) {
      console.log(`🔁 Iniciando simplificação com ${numVertices} vértices`);

      let tolerance = 0.0005;
      let simplified = feature;

      while (numVertices > 100 && tolerance < 0.01) {
        try {
          simplified = turf.simplify(feature, {
            tolerance,
            highQuality: true,
            mutate: false
          });

          coords = turf.getCoords(simplified);
          numVertices = coords.flat(Infinity).length;

          console.log(`→ Simplificado para ${numVertices} vértices (tolerance=${tolerance.toFixed(4)})`);
          tolerance += 0.0005;
        } catch (e) {
          console.warn("⚠️ Erro na simplificação:", e);
          break;
        }
      }

      feature = simplified;
    }

    // ✅ Limpa coordenadas duplicadas consecutivas
    feature = turf.cleanCoords(feature);

    features.push(feature);
  });

  const geojson = {
    type: "FeatureCollection",
    features
  };

  const kml = tokml(geojson);
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'desenhos.kml';
  a.click();
};



  const verificarSobreposicao = () => {
    if (!areaDoImovelLayer) {
      alert("Área do imóvel não encontrada.");
      return;
    }

    const areaGeoJSON = areaDoImovelLayer.toGeoJSON();
    const areaFeatures = areaGeoJSON.type === 'FeatureCollection'
      ? areaGeoJSON.features
      : [areaGeoJSON];

    const areaFeatureCollection = turf.featureCollection(areaFeatures);

    const resultados = [];

    camadas.forEach(camada => {
      const nomeCamada = camada.nome.split(':').pop().toUpperCase();
      if (nomeCamada === 'ESTADOS') return;

      let temIntersecao = false;

      if (camada.data) {
        camada.data.features.forEach(feature => {
          try {
            const intersecta = turf.intersect(areaFeatureCollection, feature);
            if (intersecta) temIntersecao = true;
          } catch (e) {
            console.warn(`Erro ao verificar ${camada.nome}:`, e);
          }
        });
      }

      resultados.push({
        camada: camada.nome,
        sobreposicao: temIntersecao
      });
    });

    let texto = "🧾 Resultado da verificação:\n\n";
    resultados.forEach(r => {
      texto += `• ${r.camada}: ${r.sobreposicao ? '❌ Sobreposição detectada' : '✅ Sem sobreposição'}\n`;
    });

    alert(texto);
  };

const gerarAreaBeneficiavel = async () => {
  if (!map || !drawnItemsRef.current) {
    console.warn("⚠️ Referências do mapa ou itens desenhados não estão disponíveis.");
    return;
  }

  console.log("✅ Iniciando geração da Área Beneficiável...");

  const obterCamada = (nomeParcial) =>
    camadasImportadas.find(c => c.nome.includes(nomeParcial));

  const camadaImovel = obterCamada("Area_do_Imovel");
  const camadaRL = obterCamada("Reserva_Legal");
  const camadaAPP = obterCamada("Area_de_Preservacao_Permanente");
  const camadaRemanescente = obterCamada("Remanescente");
  const camadaServidao = obterCamada("Servidao_Administrativa");
  const camadaAPF = obterCamada("APF");

  if (!camadaImovel) {
    alert("❌ Área do imóvel não encontrada.");
    return;
  }

  const geoImovel = camadaImovel.layer.toGeoJSON();

  // 🔧 Coleta camadas impeditivas válidas
  const impeditivas = [];
  [camadaRL, camadaAPP, camadaRemanescente, camadaServidao].forEach(camada => {
    if (camada) {
      const geo = camada.layer.toGeoJSON();
      if (geo?.features?.length || geo?.geometry) {
        impeditivas.push(geo);
      }
    }
  });

  try {
    // 🔁 Envia ao backend
    const response = await fetch("http://localhost:5000/gerar-area-beneficiavel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imovel: geoImovel.features?.[0] || geoImovel,
        impeditivas: impeditivas,
        apf: camadaAPF?.layer?.toGeoJSON(), // opcional
        estado: "MT" // ⚠️ ou dinamize com base no imóvel
      })
    });

    const resultado = await response.json();

    if (resultado.erro) {
      alert("Erro ao calcular diferença: " + resultado.erro);
      return;
    }

    let geoFinal = resultado;

    // ✅ (Opcional) Interseção extra com APF (caso não tratada no backend)
    const estaEmMT = camadaImovel?.uf === "MT" || camadaImovel?.nome?.includes("_MT");
    if (estaEmMT && camadaAPF) {
      const apfGeo = camadaAPF.layer.toGeoJSON().features?.[0] || camadaAPF.layer.toGeoJSON();
      const intersectado = turf.intersect(geoFinal, apfGeo);
      if (intersectado) {
        geoFinal = intersectado;
        console.log("📍 Interseção com APF realizada (MT).");
      } else {
        console.warn("⚠️ Interseção com APF retornou nulo.");
      }
    }

    // 🗺️ Adiciona no mapa
    const novaLayer = new L.GeoJSON(geoFinal, {
      style: {
        color: "#27ae60",
        weight: 1,
        fillOpacity: 0.5
      }
    });

    novaLayer.addTo(drawnItemsRef.current);
    map.fitBounds(novaLayer.getBounds());

    setCamadasImportadas(prev => [
      ...prev,
      {
        nome: "Área Beneficiável",
        layer: novaLayer,
        visivel: true
      }
    ]);

    console.log("✅ Área Beneficiável adicionada com sucesso.");
  } catch (e) {
    console.error("❌ Erro ao gerar área beneficiável:", e);
    alert("Erro ao gerar área beneficiável.");
  }
};





  return (
    <>
      <div id="tool-sidebar">
        {/* DESENHAR */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowDrawSubmenu(p => !p)} title="Desenhar">
            <img src="/icons/desenho.png" alt="Desenhar" style={{ width: '24px', height: '24px' }} />
          </button>
          {showDrawSubmenu && (
            <div className="tool-submenu">
              <button onClick={() => startDraw('polygon')} title="Polígono">
                <img src="/icons/poligono.png" alt="Polígono" style={{ width: '24px', height: '24px' }} />
              </button>
              <button onClick={() => startDraw('rectangle')} title="Retângulo">◼️</button>
              <button onClick={() => startDraw('polyline')} title="Linha">
                <img src="/icons/linha.png" alt="Linha" style={{ width: '24px', height: '24px' }} />
              </button>
              <button onClick={() => startDraw('marker')} title="Ponto">
                <img src="/icons/ponto.png" alt="Ponto" style={{ width: '24px', height: '24px' }} />
              </button>
              <button onClick={exportarKML} title="Exportar">
                <img src="/icons/salvar.png" alt="Exportar" style={{ width: '24px', height: '24px' }} />
              </button>
            </div>
          )}
        </div>

        {/* MEDIR */}
        <div style={{ position: 'relative' }}>
          <button onClick={toggleMeasurementPanel} title="Medir">
            <img src="/icons/medir.png" alt="Medir" style={{ width: '24px', height: '24px' }} />
          </button>
          {showMeasureSubmenu && (
  <div className="tool-submenu">
    {!medindo && (
      <>
        <button onClick={() => startMeasurement('polygon')} title="Área">
          <img src="/icons/Area.png" alt="Área" style={{ width: '24px', height: '24px' }} />
        </button>
        <button onClick={() => startMeasurement('polyline')} title="Distância">
          <img src="/icons/regua.png" alt="Distância" style={{ width: '24px', height: '24px' }} />
        </button>
      </>
    )}
    {medindo && (
      <button
  onClick={() => {
    if (medicaoDrawer) medicaoDrawer.disable();
    setMedindo(false);
    setTipoMedicao(null);
    setMedicaoDrawer(null);
  }}
  title="Parar"
>

        <img src="/icons/stop.png" alt="Parar" style={{ width: '24px', height: '24px' }} />
      </button>
    )}
  </div>
)}

        </div>

        {/* IMPORTAR */}
        <button onClick={() => fileInputRef.current.click()} title="Importar">
          <img src="/icons/folder.png" alt="Importar" style={{ width: '24px', height: '24px' }} />
        </button>
        <button onClick={() => fileInputRefCAR.current.click()} title="Importar CAR">🗂️</button>

        {/* RECENTRALIZAR */}
        <BotaoRecentrar onClick={resetMapView} />

        <button onClick={() => setMostrarBuscaCAR((prev) => !prev)} title="Buscar CAR">
  <img src="/icons/buscar-car.png" alt="Buscar CAR" style={{ width: '24px', height: '24px' }} />
</button>

{/* GERAR ÁREA BENEFICIÁVEL */}
<button onClick={gerarAreaBeneficiavel} title="Gerar Área Beneficiável">
  🌱
</button>


        {/* VERIFICAR SOBREPOSIÇÃO */}
        <button onClick={verificarSobreposicao} title="Checar Sobreposição">📋</button>
      </div>

      {/* PAINEL DE MEDIÇÃO */}
{tipoMedicao && (
  <MeasurementPanel
    tipo={tipoMedicao}
    unidade={unidade}
    setUnidade={setUnidade}
    resultado={resultado}
    onReset={resetMeasurement}
    onClose={() => {
      setTipoMedicao(null);
      setShowMeasureSubmenu(false);
      setResultado('');
    }}
  />
)}

<BuscaCAR
  map={map}
  drawnItemsRef={drawnItemsRef}
  onClose={() => setMostrarBuscaCAR(false)}
  visivel={mostrarBuscaCAR}
/>



{/* ✅ PAINEL DE SEGMENTOS DA LINHA */}
{linhasMedicao.length > 0 && (
  <div className="painel-medicao">
    <strong>Segmentos:</strong>
    <ul style={{ margin: 0, paddingLeft: '1em' }}>
      {linhasMedicao.map((seg, i) => (
        <li key={i}>
          {seg.segmento}: {(unidade === 'km' ? seg.valor : seg.valor * 1000).toFixed(1)} {unidade === 'km' ? 'km' : 'm'}
        </li>
      ))}
    </ul>
    <div><strong>{resultado}</strong></div>
  </div>
)}


    </>
  );
}

