// src/pages/WebGIS.jsx

import React, { useState, useEffect, useRef } from 'react';
import '../App.css';

import Sidebar from '../components/Sidebar';
import LayerPanel from '../components/LayerPanel';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

import L from 'leaflet';
import 'leaflet-draw';

import BotaoRecentrar from '../components/BotaoRecentrar';
import DrawTools from '../components/DrawTools';

import {
  LayersControl,
  TileLayer,
  MapContainer,
  FeatureGroup,
  GeoJSON
} from 'react-leaflet';

import ImportadorCAR from '../components/ImportadorCAR';
import PainelCamadas from '../components/PainelCamadas';
import PainelFontesCamadas from '../components/PainelFontesCamadas';
import PainelAjuda from '../components/PainelAjuda';

import { getEstiloCamada } from '../utils/estiloCamadas';
import formatarPopupAtributos from '../utils/formatarPopupAtributos';

import * as toGeoJSON from '@tmcw/togeojson';
import shp from 'shpjs';

import CoordenadasBox from '../components/CoordenadasBox';
import WfsBboxLayer from "../components/WfsBboxLayer";
import ExternalWmsLayer from "../components/ExternalWmsLayer";
import ArcgisFeatureLayer from "../components/ArcgisFeatureLayer";
import camadasExternasFallback from "../config/camadasExternasFallback";
import config from "../config";
import exportarLayerComoKml from "../utils/exportarLayerComoKml";

window.L = L;

const GEOSERVER_WFS_URL = config.GEOSERVER_BASE_URL;
const MAP_CENTER = [-14.8, -51.5];
const MAP_ZOOM = 5;
const EXTERNAL_LAYERS_URL = config.EXTERNAL_LAYERS_URL;
const EXTERNAL_LAYERS_TIMEOUT_MS = 65000;

function isCamadaInternaFPB(nome = '') {
  return nome.split(':').pop().toUpperCase().startsWith('FPB');
}

function normalizarNomeInterno(nome = '') {
  return nome
    .split(':')
    .pop()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

function isCamadaInternaAreaProtegida(nome = '') {
  return [
    'ASSENTAMENTO',
    'QUILOMBOLA',
    'TERRASINDIGENAS',
    'UNIDADESDECONSERVACAO',
  ].includes(normalizarNomeInterno(nome));
}

function isCamadaInternaOculta(nome = '') {
  return [
    'EMBARGOIBAMA',
    'ESTADOS',
    'APF',
    'TERRASINDIGENAS',
    'UNIDADESDECONSERVACAO',
  ].includes(normalizarNomeInterno(nome));
}

function montarNomeCamadaExterna(camada) {
  return camada.id ?? `${camada.typeName}::${camada.titulo || camada.typeName}`;
}

function montarChaveCatalogoExterno(camada = {}) {
  return `${camada.typeName || ''}::${camada.titulo || camada.typeName || ''}`;
}

function mesclarCamadaExterna(camadaAtual, camadaNova = {}) {
  const valoresValidos = Object.fromEntries(
    Object.entries(camadaNova).filter(([, valor]) => valor !== undefined && valor !== null)
  );

  return {
    ...valoresValidos,
    ...camadaAtual,
  };
}

function formatarNomeCAR(nome) {

  const base = nome.replace('.shp', '').replace('.geojson', '');

  const mapeamento = {
    'MARCADORES_Area_de_Preservacao_Permanente': 'Marcadores APP',
    'Area_do_Imovel': 'Área do Imóvel',
    'Area_de_Preservacao_Permanente': 'APP',
    'Reserva_Legal': 'Reserva Legal',
    'Cobertura_do_Solo': 'Remanescente de Vegetação',
    'Servidao_Administrativa': 'Servidão Administrativa'
  };

  const chaveEncontrada = Object.keys(mapeamento).find(k => base.includes(k));

  return chaveEncontrada
    ? mapeamento[chaveEncontrada]
    : base.replace(/_/g, ' ');
}

export default function WebGIS() {

  const drawnItemsRef = useRef(new L.FeatureGroup());
  const fileInputRef = useRef(null);
  const fileInputRefCAR = useRef(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSidebarView, setActiveSidebarView] = useState("camadas");

  const [camadas, setCamadas] = useState([]);
  const [camadasImportadas, setCamadasImportadas] = useState([]);

  const [ordemCamadasAtivas, setOrdemCamadasAtivas] = useState([]);

  const [desenhos, setDesenhos] = useState([]);

  const [areaDoImovelLayer, setAreaDoImovelLayer] = useState(null);

  const [indiceEditando, setIndiceEditando] = useState(null);

  const [carLayerBusca, setCarLayerBusca] = useState(null);
  const sidebarSections = [
    { id: "camadas", label: "Catalogo", icon: "/icons/layers.svg" },
    { id: "fontes", label: "Fontes", shortLabel: "i" },
    { id: "ajuda", label: "Ajuda", shortLabel: "?" },
  ];
  const sidebarFrameTitle = {
    camadas: "Catalogo operacional",
    fontes: "Fontes das camadas",
    ajuda: "Ajuda da plataforma",
  };

  const montarCamadasExternas = (externas) => externas.map(c => ({
    nome: montarNomeCamadaExterna(c),
    typeName: c.typeName,
    titulo: c.titulo,
    data: null,
    visivel: false,
    externa: true,
    sourceType: c.sourceType ?? 'wfs',
    grupoExterno: c.grupoExterno ?? 'Fontes Externas',
    subgrupoExterno: c.subgrupoExterno ?? null,
    featureFilter: c.featureFilter ?? null,
    wfsBaseUrl: c.wfs,
    wfsParams: c.wfsParams ?? {},
    wfsVersion: c.wfsVersion ?? '2.0.0',
    bboxAxisOrder: c.bboxAxisOrder ?? 'lonlat',
    arcgisQueryUrl: c.arcgisQueryUrl,
    arcgisParams: c.arcgisParams ?? {},
    wmsBaseUrl: c.wms,
    wmsParams: c.wmsParams ?? {},
    analysisWfsBaseUrl: c.analysisWfsBaseUrl,
    analysisTypeName: c.analysisTypeName,
    analysisWfsVersion: c.analysisWfsVersion ?? '2.0.0',
    analysisWfsParams: c.analysisWfsParams ?? {},
    minZoom: c.minZoom ?? 7
  }));

  const anexarCamadasExternas = (listaAtual, camadasExternas) => {
    const externasPorChave = new Map(
      camadasExternas.map((camada) => [montarChaveCatalogoExterno(camada), camada])
    );
    const internas = listaAtual.filter((camada) => !camada.externa);
    const externasExistentes = listaAtual.filter((camada) => camada.externa);

    const externasAtualizadas = externasExistentes.map((camada) =>
      mesclarCamadaExterna(camada, externasPorChave.get(montarChaveCatalogoExterno(camada)))
    );

    const chavesJaPresentes = new Set(
      externasAtualizadas.map((camada) => montarChaveCatalogoExterno(camada))
    );
    const novasExternas = camadasExternas.filter(
      (camada) => !chavesJaPresentes.has(montarChaveCatalogoExterno(camada))
    );

    return [...internas, ...externasAtualizadas, ...novasExternas];
  };

  const handleEachFeature = (feature, layer) => {
    const popupHtml = formatarPopupAtributos(feature);

    if (popupHtml) {
      layer.bindPopup(popupHtml, { maxWidth: 460 });
    }
  };
  useEffect(() => {

    const fetchCamadas = async () => {

      try {
        if (!GEOSERVER_WFS_URL) {
          throw new Error("GeoServer nao configurado");
        }

        const res = await fetch(`${GEOSERVER_WFS_URL}?service=WFS&request=GetCapabilities`);
        const text = await res.text();

        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");

        const nodes = xml.getElementsByTagName("FeatureType");

        const nomes = Array.from(nodes).map(n =>
          n.getElementsByTagName("Name")[0].textContent
        );

        const camadasGeoServer = nomes
          .filter(
            (nome) =>
              !isCamadaInternaFPB(nome) &&
              !isCamadaInternaAreaProtegida(nome) &&
              !isCamadaInternaOculta(nome)
          )
          .map(nome => ({
            nome,
            data: null,
            visivel: false,
            externa: false
          }));

        const camadasExternasIniciais = montarCamadasExternas(camadasExternasFallback);
        setCamadas([...camadasGeoServer, ...camadasExternasIniciais]);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_LAYERS_TIMEOUT_MS);

        try {
          const resExternas = await fetch(EXTERNAL_LAYERS_URL, { signal: controller.signal });
          const externas = await resExternas.json();
          const camadasExternas = montarCamadasExternas(externas);

          setCamadas((old) => anexarCamadasExternas(old, camadasExternas));
        } catch (errExternas) {
          console.warn('Nao foi possivel carregar as camadas externas no momento:', errExternas);
        } finally {
          clearTimeout(timeoutId);
        }


        for (const camada of camadasGeoServer) {

          if (camada.externa) continue;

          const url =
            `${GEOSERVER_WFS_URL}?service=WFS&version=1.0.0&request=GetFeature` +
            `&typeName=${camada.nome}&outputFormat=application/json`;

          try {

            const res = await fetch(url);
            const data = await res.json();

            setCamadas(old =>
              old.map(c => c.nome === camada.nome ? { ...c, data } : c)
            );

          } catch (errInterno) {

            console.warn(`⚠️ Erro ao buscar camada ${camada.nome}:`, errInterno);

          }

        }

      } catch (err) {
        console.warn("Nao foi possivel carregar as camadas internas do GeoServer:", err);

        const camadasExternasIniciais = montarCamadasExternas(camadasExternasFallback);
        setCamadas(camadasExternasIniciais);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_LAYERS_TIMEOUT_MS);

        try {
          const resExternas = await fetch(EXTERNAL_LAYERS_URL, { signal: controller.signal });
          const externas = await resExternas.json();
          const camadasExternas = montarCamadasExternas(externas);

          setCamadas((old) => anexarCamadasExternas(old, camadasExternas));
        } catch (errExternas) {
          console.warn("Nao foi possivel carregar as camadas externas no momento:", errExternas);
        } finally {
          clearTimeout(timeoutId);
        }

      }

    };

    fetchCamadas();

  }, []);



  const toggleLayer = nome => {

    setCamadas(old =>
      old.map(c => c.nome === nome ? { ...c, visivel: !c.visivel } : c)
    );

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



  const removerCamadaImportada = (index) => {

    const camada = camadasImportadas[index];

    if (camada) {

      drawnItemsRef.current.removeLayer(camada.layer);

      setCamadasImportadas(prev => prev.filter((_, i) => i !== index));

    }

  };



  const removerTodasCamadasCAR = () => {

    camadasImportadas.forEach(c => {

      drawnItemsRef.current.removeLayer(c.layer);

    });

    setCamadasImportadas([]);

  };



  const exportarCamadaImportada = (index) => {

    const camada = camadasImportadas[index];

    if (!camada?.layer) return;

    exportarLayerComoKml(camada.layer, camada.nome || 'camada_importada');

  };



  const exportarDesenhoIndividual = (index) => {

    const desenho = desenhos[index];

    if (!desenho?.layer) return;

    exportarLayerComoKml(desenho.layer, desenho.tipo || `desenho_${index + 1}`);

  };



  const removerDesenhoIndividual = (index) => {

    const desenho = desenhos[index];

    if (desenho && desenho.layer) {

      drawnItemsRef.current.removeLayer(desenho.layer);

      setDesenhos(prev => prev.filter((_, i) => i !== index));

    }

  };



  const editarDesenhoIndividual = (index) => {

    const desenho = desenhos[index];

    if (!desenho?.layer?.editing) return;

    desenho.layer.editing.enable();

    setIndiceEditando(index);

  };



  const finalizarEdicaoIndividual = () => {

    if (indiceEditando === null) return;

    const desenho = desenhos[indiceEditando];

    desenho?.layer?.editing?.disable();

    setIndiceEditando(null);

  };



  const alternarDesenhoParaExportacao = (index) => {
    setDesenhos((prev) => {
      const atualizados = [...prev];
      const desenho = atualizados[index];

      if (!desenho?.layer) {
        return prev;
      }

      const proximoVisivel = desenho.visivel === false;

      if (proximoVisivel) {
        drawnItemsRef.current.addLayer(desenho.layer);
      } else {
        desenho.layer.editing?.disable?.();
        drawnItemsRef.current.removeLayer(desenho.layer);

        if (indiceEditando === index) {
          setIndiceEditando(null);
        }
      }

      atualizados[index] = {
        ...desenho,
        visivel: proximoVisivel,
      };

      return atualizados;
    });

  };



  const removerTodosDesenhos = () => {

    desenhos.forEach(d => {

      drawnItemsRef.current.removeLayer(d.layer);

    });

    setDesenhos([]);

  };



  const bringToFront = nome => {

    const map = drawnItemsRef.current._map;

    if (!map) return;

    map.eachLayer(layer => {

      if (layer.feature?.properties?.nome === nome) {

        layer.bringToFront();

      }

    });

  };



  const handleImport = (e) => {

    const input = e.target;
    const file = input.files[0];

    if (!file) return;

    input.value = '';

    const ext = file.name.split('.').pop().toLowerCase();

    const nomeCamada = file.name.replace(/\.(geojson|json|kml|gpx|zip)$/i, '');

    const reader = new FileReader();

    reader.onload = async (ev) => {

      try {

        let geo = null;

        if (ext === 'geojson' || ext === 'json') {

          geo = JSON.parse(ev.target.result);

        }

        else if (ext === 'kml' || ext === 'gpx') {

          const xml = new DOMParser().parseFromString(ev.target.result, "text/xml");

          geo = ext === 'kml'
            ? toGeoJSON.kml(xml)
            : toGeoJSON.gpx(xml);

        }

        else if (ext === 'zip') {

          geo = await shp(ev.target.result);

        }

        else {

          alert("Formato não suportado.");

          return;

        }

        adicionarCamadaAoMapa(geo, nomeCamada);

      } catch (err) {

        console.error(err);

      }

    };

    if (ext === 'zip') reader.readAsArrayBuffer(file);
    else reader.readAsText(file);

  };



  const adicionarCamadaAoMapa = (geojson, nomeOriginal = 'Importado') => {

    const layer = new L.GeoJSON(geojson);

    drawnItemsRef.current.addLayer(layer);

    const bounds = layer.getBounds();

    if (bounds.isValid()) {

      const map = drawnItemsRef.current._map;

      if (map) map.fitBounds(bounds);

    }

    setCamadasImportadas(prev => [

      ...prev,

      {
        nome: nomeOriginal,
        layer,
        visivel: true
      }

    ]);

  };



  return (

    <div className="map-shell">

      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((o) => !o)}
        sections={sidebarSections}
        activeSection={activeSidebarView}
        onChangeSection={setActiveSidebarView}
        title="Atlas WebGIS"
        subtitle="Analise territorial e inteligencia espacial"
        frameTitle={sidebarFrameTitle[activeSidebarView] || "Catalogo operacional"}
      >
        {activeSidebarView === "camadas" && (
          <PainelCamadas
            camadas={camadas}
            toggleLayer={toggleLayer}
            camadasImportadas={camadasImportadas}
            toggleCamadaImportada={toggleCamadaImportada}
            removerCamadaImportada={removerCamadaImportada}
            exportarCamadaImportada={exportarCamadaImportada}
            removerTodasCamadasCAR={removerTodasCamadasCAR}
            formatarNomeCAR={formatarNomeCAR}
            desenhos={desenhos}
            exportarDesenhoIndividual={exportarDesenhoIndividual}
            editarDesenhoIndividual={editarDesenhoIndividual}
            finalizarEdicaoIndividual={finalizarEdicaoIndividual}
            removerDesenhoIndividual={removerDesenhoIndividual}
            alternarDesenhoParaExportacao={alternarDesenhoParaExportacao}
            removerTodosDesenhos={removerTodosDesenhos}
            indiceEditando={indiceEditando}
          />
        )}

        {activeSidebarView === "fontes" && (
          <PainelFontesCamadas camadas={camadas} variant="inline" />
        )}

        {activeSidebarView === "ajuda" && <PainelAjuda />}

      </Sidebar>


      <LayerPanel
        camadas={camadas}
        toggleLayer={toggleLayer}
        bringToFront={bringToFront}
        ordemCamadasAtivas={ordemCamadasAtivas}
        setOrdemCamadasAtivas={setOrdemCamadasAtivas}
      />


      <MapContainer
        id="map"
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
      >

        <LayersControl position="topright">

          <LayersControl.BaseLayer name="OpenStreetMap">

            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

          </LayersControl.BaseLayer>


          <LayersControl.BaseLayer checked name="Google Satellite">

            <TileLayer
              attribution="Google Satellite"
              url="http://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            />

          </LayersControl.BaseLayer>

        </LayersControl>


        {camadas.map((c) => {

          if (c.externa && c.sourceType === 'wms') {
            return (
              <ExternalWmsLayer
                key={c.nome}
                url={c.wmsBaseUrl}
                layers={c.nome}
                visivel={c.visivel}
                minZoom={c.minZoom}
                params={c.wmsParams}
              />
            );
          }

          if (c.externa && c.sourceType === 'arcgis-feature') {
            return (
              <ArcgisFeatureLayer
                key={c.nome}
                baseUrl={config.PROXY_WFS_BASE_URL}
                queryUrl={c.arcgisQueryUrl}
                visivel={c.visivel}
                minZoom={c.minZoom}
                queryParams={c.arcgisParams}
                onEachFeature={handleEachFeature}
                style={() => {
                  const nomeReferencia = c.titulo || c.nome;

                  return getEstiloCamada(nomeReferencia.toUpperCase());

                }}
              />
            );
          }

          if (c.externa) {

            return (

              <WfsBboxLayer
                key={c.nome}
                baseUrl={config.PROXY_WFS_BASE_URL}
                wfsBaseUrl={c.wfsBaseUrl}
                typeName={c.typeName || c.nome}
                visivel={c.visivel}
                minZoom={c.minZoom}
                wfsParams={c.wfsParams}
                wfsVersion={c.wfsVersion}
                bboxAxisOrder={c.bboxAxisOrder}
                featureFilter={c.featureFilter}
                onEachFeature={handleEachFeature}
                style={() => {
                  const nomeReferencia = c.titulo || (c.nome.includes(':')
                    ? c.nome.split(':')[1]
                    : c.nome);

                  return getEstiloCamada(nomeReferencia.toUpperCase());

                }}
              />

            );

          }

          return c.visivel ? (

            <GeoJSON
              key={c.nome}
              data={c.data}
              onEachFeature={handleEachFeature}
              style={() => {

                const nomeLimpo = c.nome.includes(':')
                  ? c.nome.split(':')[1]
                  : c.nome;

                return getEstiloCamada(nomeLimpo.toUpperCase());

              }}
            />

          ) : null;

        })}


        <FeatureGroup ref={drawnItemsRef} />

        <DrawTools
          drawnItemsRef={drawnItemsRef}
          fileInputRef={fileInputRef}
          fileInputRefCAR={fileInputRefCAR}
          camadasImportadas={camadasImportadas}
          setCamadasImportadas={setCamadasImportadas}
          setDesenhos={setDesenhos}
          areaDoImovelLayer={areaDoImovelLayer}
          setAreaDoImovelLayer={setAreaDoImovelLayer}
          camadas={camadas}
          carLayerBusca={carLayerBusca}
          setCarLayerBusca={setCarLayerBusca}
        />

        <BotaoRecentrar />

        <ImportadorCAR
          fileInputRefCAR={fileInputRefCAR}
          drawnItemsRef={drawnItemsRef}
          setCamadasImportadas={setCamadasImportadas}
          setAreaDoImovelLayer={setAreaDoImovelLayer}
        />

        <CoordenadasBox />

      </MapContainer>


      <input
        type="file"
        ref={fileInputRef}
        accept=".geojson,.json,.kml,.gpx,.zip"
        style={{ display: 'none' }}
        onChange={handleImport}
      />

      <footer>© Murilo Tavares</footer>

    </div>

  );

}
