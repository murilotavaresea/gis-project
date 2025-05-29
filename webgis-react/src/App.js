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
import PainelCamadas from './components/PainelCamadas';
import { getEstiloCamada } from './utils/estiloCamadas';







import {
  MapContainer,
  FeatureGroup,
  GeoJSON,
  } from 'react-leaflet';



window.L = L;

const GEOSERVER_WFS_URL = 'http://localhost:8080/geoserver/webgis/ows';





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
  <PainelCamadas
    camadas={camadas}
    toggleLayer={toggleLayer}
    camadasImportadas={camadasImportadas}
    toggleCamadaImportada={toggleCamadaImportada}
    removerCamadaImportada={removerCamadaImportada}
    removerTodasCamadasCAR={removerTodasCamadasCAR}
    formatarNomeCAR={formatarNomeCAR}
    desenhos={desenhos}
    editarDesenhoIndividual={editarDesenhoIndividual}
    finalizarEdicaoIndividual={finalizarEdicaoIndividual}
    removerDesenhoIndividual={removerDesenhoIndividual}
    alternarDesenhoParaExportacao={alternarDesenhoParaExportacao}
    removerTodosDesenhos={removerTodosDesenhos}
    indiceEditando={indiceEditando}
  />
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
      style={() => getEstiloCamada(c.nome)}
      onEachFeature={(feature, layer) => {
        feature.properties = feature.properties || {};
        feature.properties.nome = c.nome;
        layer.bindPopup(`<b>${c.nome}</b>`);
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
