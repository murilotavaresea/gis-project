// src/pages/WebGIS.jsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  FeatureGroup
} from 'react-leaflet';

import ImportadorCAR from '../components/ImportadorCAR';
import PainelCamadas from '../components/PainelCamadas';
import PainelFontesCamadas from '../components/PainelFontesCamadas';
import PainelAjuda from '../components/PainelAjuda';
import ProcessingOverlay from '../components/ProcessingOverlay';

import { aplicarPadraoCamada, getEstiloCamada } from '../utils/estiloCamadas';

import * as toGeoJSON from '@tmcw/togeojson';
import shp from 'shpjs';

import CoordenadasBox from '../components/CoordenadasBox';
import WfsBboxLayer from "../components/WfsBboxLayer";
import ExternalWmsLayer from "../components/ExternalWmsLayer";
import WmsFeatureInfoOverlay from "../components/WmsFeatureInfoOverlay";
import ArcgisFeatureLayer from "../components/ArcgisFeatureLayer";
import MapbiomasAlertLayer from "../components/MapbiomasAlertLayer";
import camadasExternasFallback from "../config/camadasExternasFallback";
import config from "../config";
import exportarLayerComoKml from "../utils/exportarLayerComoKml";

window.L = L;

const MAP_CENTER = [-14.8, -51.5];
const MAP_ZOOM = 5;
const EXTERNAL_LAYERS_URL = config.EXTERNAL_LAYERS_URL;
const EXTERNAL_LAYERS_TIMEOUT_MS = 65000;
const EXTERNAL_LAYERS_RETRY_DELAY_MS = 1800;
const EXTERNAL_CATALOG_CACHE_KEY = "webgis:external-catalog:v5";
const EXTERNAL_CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;
const LAYER_ORDER_BASE_ZINDEX = 320;

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchJsonWithRetry(url, options = {}, retries = 1) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        break;
      }

      await delay(EXTERNAL_LAYERS_RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

function readCachedExternalCatalog() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(EXTERNAL_CATALOG_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (
      !parsed ||
      !Array.isArray(parsed.data) ||
      !parsed.savedAt ||
      Date.now() - parsed.savedAt > EXTERNAL_CATALOG_CACHE_TTL_MS
    ) {
      window.localStorage.removeItem(EXTERNAL_CATALOG_CACHE_KEY);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.warn("Nao foi possivel ler o cache local do catalogo externo:", error);
    return null;
  }
}

function writeCachedExternalCatalog(data) {
  if (typeof window === "undefined" || !Array.isArray(data)) {
    return;
  }

  try {
    window.localStorage.setItem(
      EXTERNAL_CATALOG_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      })
    );
  } catch (error) {
    console.warn("Nao foi possivel salvar o cache local do catalogo externo:", error);
  }
}

function montarNomeCamadaExterna(camada) {
  return camada.id ?? `${camada.typeName}::${camada.titulo || camada.typeName}`;
}

function montarChaveCatalogoExterno(camada = {}) {
  if (camada.id) {
    return `id::${camada.id}`;
  }

  return `${camada.typeName || ''}::${camada.titulo || camada.typeName || ''}`;
}

function mesclarCatalogosExternos(...catalogos) {
  const mapa = new Map();

  catalogos
    .filter(Array.isArray)
    .forEach((catalogo) => {
      catalogo.forEach((camada) => {
        const chave = montarChaveCatalogoExterno(camada);
        const atual = mapa.get(chave) || {};

        mapa.set(chave, {
          ...atual,
          ...camada,
        });
      });
    });

  return [...mapa.values()];
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
  const [camadasCarregando, setCamadasCarregando] = useState({});
  const [featureCollectionsExternas, setFeatureCollectionsExternas] = useState({});
  const [processingOverlay, setProcessingOverlay] = useState({
    active: false,
    title: '',
    message: '',
  });
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
    wmsLayers: c.wmsLayers ?? c.typeName,
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
    wfsPageSize: c.wfsPageSize ?? null,
    wfsMaxPages: c.wfsMaxPages ?? 1,
    bboxAxisOrder: c.bboxAxisOrder ?? 'lonlat',
    arcgisQueryUrl: c.arcgisQueryUrl,
    arcgisParams: c.arcgisParams ?? {},
    wmsBaseUrl: c.wms,
    wmsParams: c.wmsParams ?? {},
    wmsCrs: c.wmsCrs ?? null,
    useProxy: c.useProxy ?? true,
    opacity: c.opacity ?? 1,
    identifyEnabled: c.identifyEnabled ?? false,
    analysisWfsBaseUrl: c.analysisWfsBaseUrl,
    analysisTypeName: c.analysisTypeName,
    analysisWfsVersion: c.analysisWfsVersion ?? '2.0.0',
    analysisWfsParams: c.analysisWfsParams ?? {},
    mapbiomasProxyPath: c.mapbiomasProxyPath ?? '/proxy/mapbiomas-alerta',
    mapbiomasStartDate: c.mapbiomasStartDate ?? '2019-01-01',
    mapbiomasEndDate: c.mapbiomasEndDate ?? null,
    mapbiomasSources: c.mapbiomasSources ?? ["All"],
    mapbiomasPageSize: c.mapbiomasPageSize ?? 100,
    mapbiomasMaxPages: c.mapbiomasMaxPages ?? 3,
    minZoom: c.minZoom ?? 7
  }));

  const nomesCamadasVisiveisOrdenadas = useMemo(() => {
    const nomesVisiveis = camadas
      .filter((camada) => camada.visivel)
      .map((camada) => camada.nome);
    const nomesOrdenados = ordemCamadasAtivas.filter((nome) => nomesVisiveis.includes(nome));
    const nomesRestantes = nomesVisiveis.filter((nome) => !nomesOrdenados.includes(nome));

    return [...nomesOrdenados, ...nomesRestantes];
  }, [camadas, ordemCamadasAtivas]);

  const zIndexPorCamada = useMemo(() => {
    const total = nomesCamadasVisiveisOrdenadas.length;

    return nomesCamadasVisiveisOrdenadas.reduce((acc, nome, index) => {
      acc[nome] = LAYER_ORDER_BASE_ZINDEX + (total - index);
      return acc;
    }, {});
  }, [nomesCamadasVisiveisOrdenadas]);

  const anexarCamadasExternas = (listaAtual, camadasExternas) => {
    const externasPorChave = new Map(
      camadasExternas.map((camada) => [montarChaveCatalogoExterno(camada), camada])
    );
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

    return [...externasAtualizadas, ...novasExternas];
  };

  const obterNomeReferenciaCamada = (camada) => {
    if (!camada) {
      return '';
    }

    return camada.titulo || (camada.nome.includes(':')
      ? camada.nome.split(':')[1]
      : camada.nome);
  };

  const criarStyleCamada = (nomeReferencia) => () =>
    getEstiloCamada(String(nomeReferencia || '').toUpperCase());

  const criarHandleEachFeature = (nomeReferencia) => (_feature, layer) => {
    const estilo = getEstiloCamada(String(nomeReferencia || '').toUpperCase());

    aplicarPadraoCamada(layer, estilo, layer._map);
  };

  const atualizarCarregamentoCamada = useCallback((nomeCamada, carregando) => {
    setCamadasCarregando((estadoAtual) => {
      if (!nomeCamada) {
        return estadoAtual;
      }

      if (!carregando) {
        if (!estadoAtual[nomeCamada]) {
          return estadoAtual;
        }

        const proximoEstado = { ...estadoAtual };
        delete proximoEstado[nomeCamada];
        return proximoEstado;
      }

      if (estadoAtual[nomeCamada]) {
        return estadoAtual;
      }

      return {
        ...estadoAtual,
        [nomeCamada]: true,
      };
    });
  }, []);

  const showProcessingOverlay = useCallback(({ title, message }) => {
    setProcessingOverlay({
      active: true,
      title: title || 'Processando',
      message: message || 'Aguarde enquanto concluimos esta etapa.',
    });
  }, []);

  const hideProcessingOverlay = useCallback(() => {
    setProcessingOverlay({
      active: false,
      title: '',
      message: '',
    });
  }, []);

  const atualizarFeatureCollectionExterna = useCallback((nomeCamada, data) => {
    if (!nomeCamada) {
      return;
    }

    setFeatureCollectionsExternas((estadoAtual) => {
      if (!data) {
        if (!(nomeCamada in estadoAtual)) {
          return estadoAtual;
        }

        const proximoEstado = { ...estadoAtual };
        delete proximoEstado[nomeCamada];
        return proximoEstado;
      }

      return {
        ...estadoAtual,
        [nomeCamada]: data,
      };
    });
  }, []);
  useEffect(() => {

    const fetchCamadas = async () => {
      const cachedCatalog = readCachedExternalCatalog();
      const catalogoInicial = mesclarCatalogosExternos(
        camadasExternasFallback,
        cachedCatalog
      );
      const camadasExternasIniciais = montarCamadasExternas(catalogoInicial);
      setCamadas(camadasExternasIniciais);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_LAYERS_TIMEOUT_MS);

        try {
          const externas = await fetchJsonWithRetry(
            EXTERNAL_LAYERS_URL,
            { signal: controller.signal },
            1
          );
          const catalogoMesclado = mesclarCatalogosExternos(
            camadasExternasFallback,
            externas
          );
          const camadasExternas = montarCamadasExternas(catalogoMesclado);

          writeCachedExternalCatalog(catalogoMesclado);
          setCamadas((old) => anexarCamadasExternas(old, camadasExternas));
        } catch (errExternas) {
          if (errExternas?.name !== 'AbortError') {
            console.warn('Nao foi possivel carregar as camadas externas no momento:', errExternas);
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        console.warn("Nao foi possivel atualizar o catalogo de camadas externas:", err);
      }

    };

    fetchCamadas();

  }, [atualizarCarregamentoCamada]);



  const toggleLayer = nome => {
    const camadaAtual = camadas.find((camada) => camada.nome === nome);

    if (!camadaAtual) {
      return;
    }

    const proximoVisivel = !camadaAtual.visivel;

    if (!proximoVisivel) {
      atualizarCarregamentoCamada(nome, false);
    } else {
      atualizarCarregamentoCamada(nome, true);
    }

    setOrdemCamadasAtivas((ordemAtual) => {
      if (!proximoVisivel) {
        return ordemAtual.filter((nomeAtual) => nomeAtual !== nome);
      }

      return [nome, ...ordemAtual.filter((nomeAtual) => nomeAtual !== nome)];
    });

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
            camadasCarregando={camadasCarregando}
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
              url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            />

          </LayersControl.BaseLayer>

        </LayersControl>


        {camadas.map((c) => {

          if (c.externa && c.sourceType === 'wms') {
            return (
              <ExternalWmsLayer
                key={c.nome}
                baseUrl={`${config.API_BASE_URL}/proxy/wms`}
                url={c.wmsBaseUrl}
                layers={c.wmsLayers || c.typeName || c.nome}
                crsCode={c.wmsCrs}
                paneKey={c.nome}
                useProxy={c.useProxy}
                visivel={c.visivel}
                minZoom={c.minZoom}
                zIndex={zIndexPorCamada[c.nome]}
                opacity={c.opacity}
                params={c.wmsParams}
                onLoadingChange={(carregando) => atualizarCarregamentoCamada(c.nome, carregando)}
              />
            );
          }

          if (c.externa && c.sourceType === 'arcgis-feature') {
            const nomeReferencia = obterNomeReferenciaCamada(c);

            return (
              <ArcgisFeatureLayer
                key={c.nome}
                baseUrl={config.PROXY_WFS_BASE_URL}
                queryUrl={c.arcgisQueryUrl}
                paneKey={c.nome}
                visivel={c.visivel}
                minZoom={c.minZoom}
                zIndex={zIndexPorCamada[c.nome]}
                queryParams={c.arcgisParams}
                onEachFeature={criarHandleEachFeature(nomeReferencia)}
                style={criarStyleCamada(nomeReferencia)}
                onLoadingChange={(carregando) => atualizarCarregamentoCamada(c.nome, carregando)}
                onDataChange={(data) => atualizarFeatureCollectionExterna(c.nome, data)}
              />
            );
          }

          if (c.externa && c.sourceType === "mapbiomas-alerta") {
            const nomeReferencia = obterNomeReferenciaCamada(c);

            return (
              <MapbiomasAlertLayer
                key={c.nome}
                url={`${config.API_BASE_URL}${c.mapbiomasProxyPath || "/proxy/mapbiomas-alerta"}`}
                paneKey={c.nome}
                visivel={c.visivel}
                minZoom={c.minZoom}
                zIndex={zIndexPorCamada[c.nome]}
                startDate={c.mapbiomasStartDate}
                endDate={c.mapbiomasEndDate}
                sources={c.mapbiomasSources}
                pageSize={c.mapbiomasPageSize}
                maxPages={c.mapbiomasMaxPages}
                onEachFeature={criarHandleEachFeature(nomeReferencia)}
                style={criarStyleCamada(nomeReferencia)}
                onLoadingChange={(carregando) => atualizarCarregamentoCamada(c.nome, carregando)}
                onDataChange={(data) => atualizarFeatureCollectionExterna(c.nome, data)}
              />
            );
          }

          if (c.externa) {
            const nomeReferencia = obterNomeReferenciaCamada(c);

            return (

              <WfsBboxLayer
                key={c.nome}
                baseUrl={config.PROXY_WFS_BASE_URL}
                wfsBaseUrl={c.wfsBaseUrl}
                typeName={c.typeName || c.nome}
                paneKey={c.nome}
                visivel={c.visivel}
                minZoom={c.minZoom}
                zIndex={zIndexPorCamada[c.nome]}
                wfsParams={c.wfsParams}
                wfsVersion={c.wfsVersion}
                wfsPageSize={c.wfsPageSize}
                wfsMaxPages={c.wfsMaxPages}
                bboxAxisOrder={c.bboxAxisOrder}
                featureFilter={c.featureFilter}
                onEachFeature={criarHandleEachFeature(nomeReferencia)}
                style={criarStyleCamada(nomeReferencia)}
                onLoadingChange={(carregando) => atualizarCarregamentoCamada(c.nome, carregando)}
                onDataChange={(data) => atualizarFeatureCollectionExterna(c.nome, data)}
              />

            );

          }

          return null;

        })}

        <WmsFeatureInfoOverlay
          camadas={camadas}
          featureCollectionsExternas={featureCollectionsExternas}
          orderedLayerNames={nomesCamadasVisiveisOrdenadas}
          proxyBaseUrl={`${config.API_BASE_URL}/proxy/wms`}
        />


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
          showProcessingOverlay={showProcessingOverlay}
          hideProcessingOverlay={hideProcessingOverlay}
        />

        <BotaoRecentrar />

        <ImportadorCAR
          fileInputRefCAR={fileInputRefCAR}
          drawnItemsRef={drawnItemsRef}
          setCamadasImportadas={setCamadasImportadas}
          setAreaDoImovelLayer={setAreaDoImovelLayer}
          showProcessingOverlay={showProcessingOverlay}
          hideProcessingOverlay={hideProcessingOverlay}
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

      <ProcessingOverlay
        active={processingOverlay.active}
        title={processingOverlay.title}
        message={processingOverlay.message}
      />

      <footer>© Murilo Tavares</footer>

    </div>

  );

}

