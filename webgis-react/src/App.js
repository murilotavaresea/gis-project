import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import LayerPanel from './components/LayerPanel';
import JSON5 from 'json5';

import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

import L from 'leaflet';
import 'leaflet-draw';
import BotaoRecentrar from './components/BotaoRecentrar';

import DrawTools from './components/DrawTools';
import { LayersControl, TileLayer } from 'react-leaflet';
import ImportadorCAR from './components/ImportadorCAR';






import {
  MapContainer,
  FeatureGroup,
  GeoJSON,
  } from 'react-leaflet';



window.L = L;

const GEOSERVER_WFS_URL = 'https://ambagrodb.com/geoserver/webgis/ows';







function formatarNomeCAR(nome) {
  const base = nome.replace('.shp', '').replace('.geojson', '');

  const mapeamento = {
    'Area_do_Imovel': 'Área do Imóvel',
    'Area_de_Preservacao_Permanente': 'APP',
    'Reserva_Legal': 'Reserva Legal',
    'Cobertura_do_Solo': 'Remanescente de Vegetação',
    'Servidao_Administrativa': 'Servidão Administrativa'
  };

  const chaveEncontrada = Object.keys(mapeamento).find(k => base.includes(k));
  return chaveEncontrada ? mapeamento[chaveEncontrada] : base.replace(/_/g, ' ');
}


export default function App() {
  const mapRef = useRef(null);
  const drawnItemsRef = useRef(new L.FeatureGroup());
  const fileInputRef = useRef(null);
  const fileInputRefCAR = useRef(null); // para arquivos .zip do CAR
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [camadas, setCamadas] = useState([]);
  const [camadasImportadas, setCamadasImportadas] = useState([]);
  const [ordemCamadasAtivas, setOrdemCamadasAtivas] = useState([]);
  const [desenhos, setDesenhos] = useState([]);
  const [areaDoImovelLayer, setAreaDoImovelLayer] = useState(null);
  const [indiceEditando, setIndiceEditando] = useState(null);
  



useEffect(() => {
  const zoomControl = document.querySelector('.leaflet-control-zoom');
  if (zoomControl) {
    zoomControl.style.left = isSidebarOpen ? '320px' : '10px';
  }
}, [isSidebarOpen]);




useEffect(() => {
  const camadaIBAMA = {
  nome: "Embargo IBAMA",
  data: null,
  visivel: false,
  externa: true,
  url: "https://pamgia.ibama.gov.br/server/services/01_Publicacoes_Bases/adm_embargos_ibama_a/MapServer/WFSServer?service=wfs&version=2.0.0&request=GetFeature&typeName=adm_embargos_ibama_a:base.adm_embargos_ibama_a&outputFormat=GEOJSON"
};


  fetch(`${GEOSERVER_WFS_URL}?service=WFS&request=GetCapabilities`)
    .then(res => res.text())
    .then(text => {
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");
      const nodes = xml.getElementsByTagName("FeatureType");

      const nomes = Array.from(nodes).map(n =>
        n.getElementsByTagName("Name")[0].textContent
      );

      const camadasGeoServer = nomes.map(nome => ({
        nome,
        data: null,
        visivel: false
      }));

      // Junta as camadas do GeoServer com a do IBAMA
      const todasCamadas = [...camadasGeoServer, camadaIBAMA];
      setCamadas(todasCamadas);

      // Carrega as camadas do GeoServer
      nomes.forEach(nome => {
        const url = `${GEOSERVER_WFS_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=${nome}&outputFormat=application/json`;
        fetch(url)
          .then(res => res.json())
          .then(data => {
            setCamadas(old =>
              old.map(c => c.nome === nome ? { ...c, data } : c)
            );
          });
      });

      // Carrega a camada do IBAMA
      fetch(camadaIBAMA.url)
  .then(res => res.text())
  .then(text => {
    try {
      const data = JSON5.parse(text);
      setCamadas(old =>
        old.map(c => c.nome === camadaIBAMA.nome ? { ...c, data } : c)
      );
    } catch (err) {
      console.error("❌ Erro ao fazer parse com JSON5 (IBAMA):", err);
      console.log("🔎 Conteúdo bruto:", text.slice(0, 200));
    }
  })
  .catch(err => console.error("❌ Erro ao carregar camada IBAMA:", err));
    });
}, []);
  
  const removerDesenhoIndividual = (index) => {
  const desenho = desenhos[index];
  if (desenho && desenho.layer) {
    drawnItemsRef.current.removeLayer(desenho.layer);
    setDesenhos(prev => prev.filter((_, i) => i !== index));
  }
};

const removerCamadaImportada = (index) => {
  const camada = camadasImportadas[index];
  if (camada) {
    drawnItemsRef.current.removeLayer(camada.layer);
    setCamadasImportadas(prev => prev.filter((_, i) => i !== index));
  }
};


const editarDesenhoIndividual = (index) => {
  const desenho = desenhos[index];

  if (!desenho || !desenho.layer || !desenho.layer.editing) return;

  // Habilita edição diretamente na layer
  desenho.layer.editing.enable();

  setIndiceEditando(index);
};


const removerTodasCamadasCAR = () => {
  setCamadasImportadas(prev => {
    const restantes = prev.filter(camada => {
      const nome = camada.nome.toLowerCase();
      const ehCAR =
        nome.includes('area_do_imovel') ||
        nome.includes('reserva_legal') ||
        nome.includes('area_de_preservacao_permanente') ||
        nome.includes('cobertura_do_solo') ||
        nome.includes('servidao_administrativa') ||
        nome.includes('apf') ||
        nome.includes('car');

      if (ehCAR) {
        drawnItemsRef.current.removeLayer(camada.layer);
      }

      return !ehCAR;
    });

    return restantes;
  });

  setAreaDoImovelLayer(null); // opcional
};


const finalizarEdicaoIndividual = () => {
  if (indiceEditando === null) return;

  const desenho = desenhos[indiceEditando];
  if (desenho?.layer?.editing) {
    desenho.layer.editing.disable();
  }

  setIndiceEditando(null);
};



  const toggleLayer = nome => {
    setCamadas(old =>
      old.map(c => c.nome === nome ? { ...c, visivel: !c.visivel } : c)
    );
  
    setOrdemCamadasAtivas(prev => {
      // Se estiver visível, remover da lista
      if (camadas.find(c => c.nome === nome)?.visivel) {
        return prev.filter(n => n !== nome);
      } else {
        // Se estiver invisível, adicionar no topo (ou ao fim se preferir)
        return [...prev, nome];
      }
    });
  };
  
  const toggleCamadaImportada = (nome) => {
    setCamadasImportadas(prev =>
      prev.map(c =>
        c.nome === nome
          ? { ...c, visivel: !c.visivel }
          : c
      )
    );
  
    const camada = camadasImportadas.find(c => c.nome === nome);
    if (camada) {
      if (camada.visivel) {
        drawnItemsRef.current.removeLayer(camada.layer);
      } else {
        drawnItemsRef.current.addLayer(camada.layer);
      }
    }
  };
  

  const bringToFront = nome => {
    const map = mapRef.current;
    if (!map) return;
    map.eachLayer(layer => {
      if (layer.feature?.properties?.nome === nome) {
        layer.bringToFront();
      }
    });
  };

 

const resetMapView = () => {
  console.log("📍 Botão Recentralizar foi clicado");
  const map = mapRef.current;
  if (map) {
    console.log("✅ Mapa encontrado. Recentralizando...");
    map.setView([-14.8, -51.5], 5);
  } else {
    console.warn("⚠️ Mapa não encontrado!");
  }
};





  const handleImport = e => {
    const file = e.target.files[0];
    if (!file || !mapRef.current) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const geo = JSON.parse(ev.target.result);
        const layer = new L.GeoJSON(geo);
        layer.addTo(drawnItemsRef.current);
        mapRef.current.fitBounds(layer.getBounds());
      } catch {
        alert('Formato inválido');
      }
    };
    reader.readAsText(file);
  };

  
  const alternarDesenhoParaExportacao = (index) => {
    setDesenhos(prev => {
      const atualizados = [...prev];
      atualizados[index].exportar = !atualizados[index].exportar;
      return atualizados;
    });
  };
  
  const removerTodosDesenhos = () => {
    desenhos.forEach(d => {
      drawnItemsRef.current.removeLayer(d.layer);
    });
    setDesenhos([]);
  };
  
  
  return (
    <div>
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(o => !o)}>
  <h2>Camadas</h2>

  <h3>Banco de Dados</h3>

<ul>
  {camadas
    .filter(c =>
      !c.nome.toUpperCase().includes('MAPBIOMAS') &&
      !c.nome.split(':').pop().toUpperCase().startsWith('FPB') &&
      ![
        'ASSENTAMENTO',
        'QUILOMBOLA',
        'TERRAS INDÍGENAS',
        'UNIDADES DE CONSERVAÇÃO'
      ].includes(c.nome.split(':').pop().toUpperCase())
    )
    .map((c, index) => {
      const nomeLimpo = c.nome.includes(':') ? c.nome.split(':')[1] : c.nome;
      return (
        <li key={index}>
          <label>
            <input
              type="checkbox"
              checked={c.visivel}
              onChange={() => toggleLayer(c.nome)}
            />
            {nomeLimpo}
          </label>
        </li>
      );
    })}
</ul>

<details style={{ marginTop: '10px' }}>
  <summary style={{ cursor: 'pointer' }}><strong>Florestas Públicas (FPB)</strong></summary>
  <ul>
    {camadas
      .filter(c => c.nome.split(':').pop().toUpperCase().startsWith('FPB'))
      .map((c, index) => {
        const nomeLimpo = c.nome.split(':').pop();
        return (
          <li key={index}>
            <label>
              <input
                type="checkbox"
                checked={c.visivel}
                onChange={() => toggleLayer(c.nome)}
              />
              {nomeLimpo}
            </label>
          </li>
        );
      })}
  </ul>
</details>
<details style={{ marginTop: '10px' }}>
  <summary style={{ cursor: 'pointer' }}><strong>Mapbiomas</strong></summary>
  <ul>
    {camadas
      .filter(c => c.nome.toUpperCase().includes('MAPBIOMAS'))
      .map((c, index) => {
        const nomeLimpo = c.nome.includes(':') ? c.nome.split(':')[1] : c.nome;
        return (
          <li key={index}>
            <label>
              <input
                type="checkbox"
                checked={c.visivel}
                onChange={() => toggleLayer(c.nome)}
              />
              {nomeLimpo}
            </label>
          </li>
        );
      })}
  </ul>
</details>




<details style={{ marginTop: '10px' }}>
  <summary style={{ cursor: 'pointer' }}><strong>Áreas Protegidas</strong></summary>
  <ul>
    {camadas
      .filter(c =>
        ['ASSENTAMENTO', 'QUILOMBOLA', 'TERRAS INDÍGENAS', 'UNIDADES DE CONSERVAÇÃO'].includes(
          c.nome.split(':').pop().toUpperCase()
        )
      )
      .map((c, index) => {
        const nomeLimpo = c.nome.split(':').pop();
        return (
          <li key={index}>
            <label>
              <input
                type="checkbox"
                checked={c.visivel}
                onChange={() => toggleLayer(c.nome)}
              />
              {nomeLimpo}
            </label>
          </li>
        );
      })}
  </ul>
</details>

  <h3>Importadas (CAR)</h3>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <span>Camadas importadas</span>
  <button onClick={removerTodasCamadasCAR} style={{ fontSize: '0.8em' }} title="Remover todas">
    <img src="/icons/lixo.png" alt="Remover todas" style={{ width: '20px', height: '20px' }} />
  </button>
</div>
<ul>
  {camadasImportadas.map((c, index) => (
    <li key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <label>
        <input
          type="checkbox"
          checked={c.visivel}
          onChange={() => toggleCamadaImportada(c.nome)}
        />
        {formatarNomeCAR(c.nome)}
      </label>
      <button
        onClick={() => removerCamadaImportada(index)}
        title="Remover camada"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <img src="/icons/lixo.png" alt="Excluir" style={{ width: '16px', height: '16px' }} />
      </button>
    </li>
  ))}
</ul>


  <h3>Desenhos Manuais</h3>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span>Todos os desenhos</span>
    <button onClick={removerTodosDesenhos} style={{ fontSize: '0.8em' }}>
      <img src="/icons/lixo.png" alt="Remover" style={{ width: '24px', height: '24px' }} />
    </button>
  </div>
  <ul>
  {desenhos.map((d, i) => (
    <li key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <label>
        <input
          type="checkbox"
          checked={d.exportar}
          onChange={() => alternarDesenhoParaExportacao(i)}
        />
        {d.tipo}
      </label>
      <div>
        {indiceEditando === i && (
  <button
    onClick={finalizarEdicaoIndividual}
    title="Finalizar edição"
    style={{ background: 'transparent', border: 'none', cursor: 'pointer', marginRight: '5px' }}
  >
    ✅
  </button>
)}
        <button onClick={() => editarDesenhoIndividual(i)} title="Editar" style={{ background: 'transparent', border: 'none', cursor: 'pointer', marginRight: '5px' }}>
          <img src="/icons/desenho.png" alt="Editar" style={{ width: '16px', height: '16px' }} />
        </button>
        
        <button onClick={() => removerDesenhoIndividual(i)} title="Excluir" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <img src="/icons/lixo.png" alt="Excluir" style={{ width: '16px', height: '16px' }} />
        </button>
      </div>
    </li>
  ))}
</ul>


</Sidebar>



      <LayerPanel
  camadas={camadas}
  toggleLayer={toggleLayer}
  bringToFront={bringToFront}
  ordemCamadasAtivas={ordemCamadasAtivas}
  setOrdemCamadasAtivas={setOrdemCamadasAtivas}
/>



      <MapContainer
      id='map'
  center={[-14.8, -51.5]}
  zoom={5}
 whenCreated={(map) => {
  mapRef.current = map;
  setTimeout(() => {
    if (drawnItemsRef.current && map) {
      map.addLayer(drawnItemsRef.current);
      console.log("✅ FeatureGroup conectado ao mapa com sucesso");
    } else {
      console.warn("⚠️ Ainda não foi possível adicionar o FeatureGroup ao mapa");
    }
  }, 0);
}}



>

        <LayersControl position="topright">
  <LayersControl.BaseLayer checked name="OpenStreetMap">
    <TileLayer
      attribution="&copy; OpenStreetMap contributors"
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  </LayersControl.BaseLayer>

  <LayersControl.BaseLayer name="Google Satellite">
    <TileLayer
      attribution="Google Satellite"
      url="http://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
    />
  </LayersControl.BaseLayer>

  <LayersControl.BaseLayer name="ESRI World Imagery">
    <TileLayer
      attribution="Tiles © Esri"
      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    />
  </LayersControl.BaseLayer>
</LayersControl>

        {camadas.map(c =>
          c.visivel && c.data ? (
            <GeoJSON
              key={c.nome}
              data={c.data}
              onEachFeature={(feature, layer) => {
                feature.properties = feature.properties || {};
                feature.properties.nome = c.nome;
                layer.bindPopup(`<b>${c.nome}</b>`);
              }}
              style={(feature) => {
                const nome = c.nome.split(':').pop().toUpperCase();
              
                if (nome === 'EMBARGO IBAMA') {
                  return {
                    color: 'red',
                    weight: 2,
                    dashArray: '5, 5', // estilo tracejado (hashed)
                    fillOpacity: 0.1
                  };
                }
              
                if (nome === 'ESTADOS') {
                  return {
                    color: 'BLUE',
                    weight: 1,
                    fillOpacity: 0
                  };
                }
              
                if (nome === 'MAPBIOMAS') {
                  return {
                    color: '#1f78b4',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
              
                if (nome === 'ASSENTAMENTO') {
                  return {
                    color: '#33a02c',
                    fillOpacity: 0.2
                  };
                }
              
                if (nome === 'QUILOMBOLA') {
                  return {
                    color: '#6a3d9a',
                    dashArray: '4,4',
                    fillOpacity: 0.15
                  };
                }
              
                if (nome === 'TERRAS INDÍGENAS') {
                  return {
                    color: '#e31a1c',
                    fillOpacity: 0.25
                  };
                }
              
                if (nome === 'UNIDADES DE CONSERVAÇÃO') {
                  return {
                    color: '#ff7f00',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }

                if (nome === 'FPB AC') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }

                if (nome === 'FPB AL') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB AM') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB AP') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB BA') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB CE') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB GO') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB MA') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB MS') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB MT') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB PA') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB PE') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB PI') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB PR') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB RO') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB RR') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB RS') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB SC') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                if (nome === 'FPB TO') {
                  return {
                    color: '#4fb286',
                    weight: 1.5,
                    fillOpacity: 0.2
                  };
                }
                

                // estilo padrão
                return {
                  color: '#3388ff',
                  weight: 2,
                  fillOpacity: 0.1
                };
              }}            
            />
          ) : null
        )}
        <FeatureGroup ref={drawnItemsRef}>
 
</FeatureGroup>

        <DrawTools
          mapRef={mapRef}
          drawnItemsRef={drawnItemsRef}
          fileInputRef={fileInputRef}
          fileInputRefCAR={fileInputRefCAR}
          resetMapView={resetMapView}
          camadasImportadas={camadasImportadas}
          setCamadasImportadas={setCamadasImportadas}
          setDesenhos={setDesenhos}  // 👈 adicionado
          areaDoImovelLayer={areaDoImovelLayer}
          setAreaDoImovelLayer={setAreaDoImovelLayer} // ✅ ADICIONE ESTA LINHA
          camadas={camadas}
        />
        <BotaoRecentrar />

<ImportadorCAR
  fileInputRefCAR={fileInputRefCAR}
  drawnItemsRef={drawnItemsRef}
  setCamadasImportadas={setCamadasImportadas}
  setAreaDoImovelLayer={setAreaDoImovelLayer}
/>

      </MapContainer>

      <input
        type="file"
        ref={fileInputRef}
        accept=".geojson,.json,.kml,.gpx"
        style={{ display: 'none' }}
        onChange={handleImport}
      />
      


      <footer>© Murilo Tavares</footer>
    </div>
  );
}
