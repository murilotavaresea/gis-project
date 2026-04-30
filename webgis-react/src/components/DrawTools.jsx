import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import tokml from "tokml";
import * as turf from "@turf/turf";
import "leaflet-draw";
import { useMap } from "react-leaflet";
import BuscaCAR from "./BuscaCAR";
import GerarAreaBeneficiavel from "./GerarAreaBeneficiavel";
import RelatorioTemporalTool from "./RelatorioTemporalTool";
import VerificarSobreposicao from "./VerificarSobreposicao";
import MapaRelatorio from "./MapaRelatorio";
import { obterResumoDesenho } from "../utils/desenhoMetricas";

function MeasurementPanel({
  tipo,
  unidade,
  setUnidade,
  resultado,
  medindo,
  onStart,
  onReset,
  onClose,
}) {
  return (
    <div id="measurement-panel">
      <button className="close-button" onClick={onClose} type="button">
        x
      </button>
      <h3>{tipo === "polygon" ? "MEDIR AREA" : "MEDIR DISTANCIA"}</h3>
      <div className="unit-selector">
        <label>Unidade:</label>
        <select value={unidade} onChange={(e) => setUnidade(e.target.value)}>
          {tipo === "polygon" ? (
            <>
              <option value="mÂ²">mÂ²</option>
              <option value="ha">hectares</option>
              <option value="kmÂ²">kmÂ²</option>
              <option value="alq">alqueires paulistas</option>
            </>
          ) : (
            <>
              <option value="m">metros</option>
              <option value="km">quilometros</option>
            </>
          )}
        </select>
      </div>
      <div className="measurement-panelResult">
        <strong>Resultado:</strong>
        <span>{resultado || "Pronto para iniciar uma nova medicao."}</span>
      </div>
      <div className="measurement-panelActions">
        <button className="start-button" onClick={onStart} type="button" disabled={medindo}>
          {medindo ? "Medindo..." : "Iniciar"}
        </button>
        <button className="reset-button" onClick={onReset} type="button">
          Resetar
        </button>
      </div>
    </div>
  );
}

export default function DrawTools({
  drawnItemsRef,
  fileInputRef,
  fileInputRefCAR,
  camadasImportadas,
  setCamadasImportadas,
  setDesenhos,
  areaDoImovelLayer,
  setAreaDoImovelLayer,
  camadas,
  carLayerBusca,
  setCarLayerBusca,
  showProcessingOverlay,
  hideProcessingOverlay,
}) {
  const map = useMap();
  const measurementLayersRef = useRef([]);
  const measurementCreatedHandlerRef = useRef(null);
  const toolSidebarRef = useRef(null);
  const measurementPanelRef = useRef(null);
  const painelMedicaoRef = useRef(null);

  const [showDrawSubmenu, setShowDrawSubmenu] = useState(false);
  const [showMeasureSubmenu, setShowMeasureSubmenu] = useState(false);
  const [tipoMedicao, setTipoMedicao] = useState(null);
  const [unidade, setUnidade] = useState("ha");
  const [resultado, setResultado] = useState("");
  const [linhasMedicao, setLinhasMedicao] = useState([]);
  const [medindo, setMedindo] = useState(false);
  const [medicaoDrawer, setMedicaoDrawer] = useState(null);
  const [mostrarBuscaCAR, setMostrarBuscaCAR] = useState(false);
  const [mapaRelatorioData, setMapaRelatorioData] = useState({
    areaGeoJSON: null,
    overlayLayers: [],
  });
  const [mostrarMapaRelatorio, setMostrarMapaRelatorio] = useState(false);
  const mapaRelatorioResolverRef = useRef(null);
  const mapaRelatorioTimeoutRef = useRef(null);

  const toolIconStyle = { width: "22px", height: "22px" };

  useEffect(() => {
    const nodes = [
      toolSidebarRef.current,
      measurementPanelRef.current,
      painelMedicaoRef.current,
    ].filter(Boolean);

    nodes.forEach((node) => {
      L.DomEvent.disableClickPropagation(node);
      L.DomEvent.disableScrollPropagation(node);
    });

    return () => {
      nodes.forEach((node) => {
        L.DomEvent.off(node);
      });
    };
  }, [showDrawSubmenu, showMeasureSubmenu, tipoMedicao, linhasMedicao.length]);

  const limparMapaRelatorio = () => {
    if (mapaRelatorioTimeoutRef.current) {
      window.clearTimeout(mapaRelatorioTimeoutRef.current);
      mapaRelatorioTimeoutRef.current = null;
    }

    if (mapaRelatorioResolverRef.current) {
      mapaRelatorioResolverRef.current();
      mapaRelatorioResolverRef.current = null;
    }

    const container = document.getElementById("mapa-pdf");
    if (container) {
      container.innerHTML = "";
      delete container.dataset.renderReady;
    }

    setMostrarMapaRelatorio(false);
    setMapaRelatorioData({
      areaGeoJSON: null,
      overlayLayers: [],
    });
  };

  const prepararMapaRelatorio = (payload) =>
    new Promise((resolve) => {
      if (mapaRelatorioTimeoutRef.current) {
        window.clearTimeout(mapaRelatorioTimeoutRef.current);
      }

      mapaRelatorioResolverRef.current = () => {
        if (mapaRelatorioTimeoutRef.current) {
          window.clearTimeout(mapaRelatorioTimeoutRef.current);
          mapaRelatorioTimeoutRef.current = null;
        }

        mapaRelatorioResolverRef.current = null;
        resolve();
      };

      mapaRelatorioTimeoutRef.current = window.setTimeout(() => {
        if (mapaRelatorioResolverRef.current) {
          mapaRelatorioResolverRef.current();
        }
      }, 4000);

      setMapaRelatorioData(payload);
      setMostrarMapaRelatorio(true);
    });

  const handleMapaRelatorioReady = () => {
    if (mapaRelatorioResolverRef.current) {
      mapaRelatorioResolverRef.current();
    }
  };

  const clearMeasurementLayers = () => {
    measurementLayersRef.current.forEach((layer) => {
      drawnItemsRef.current?.removeLayer(layer);
    });

    measurementLayersRef.current = [];
    map?.closePopup();
    setLinhasMedicao([]);
    setResultado("");
  };

  const detachMeasurementCreatedHandler = () => {
    if (map && measurementCreatedHandlerRef.current) {
      map.off(L.Draw.Event.CREATED, measurementCreatedHandlerRef.current);
      measurementCreatedHandlerRef.current = null;
    }
  };

  const stopMeasurementMode = ({ clearResults = false, closePanel = false } = {}) => {
    medicaoDrawer?.disable();
    detachMeasurementCreatedHandler();
    setMedicaoDrawer(null);
    setMedindo(false);

    if (clearResults) {
      clearMeasurementLayers();
    }

    if (closePanel) {
      setTipoMedicao(null);
      setShowMeasureSubmenu(false);
    }
  };

  const toggleDrawSubmenu = () => {
    if (showMeasureSubmenu || tipoMedicao || medindo) {
      stopMeasurementMode({ clearResults: true, closePanel: true });
    }

    setShowDrawSubmenu((prev) => !prev);
  };

  const toggleMeasurementPanel = () => {
    if (showMeasureSubmenu || tipoMedicao || medindo) {
      stopMeasurementMode({ clearResults: true, closePanel: true });
      return;
    }

    setShowDrawSubmenu(false);
    setShowMeasureSubmenu(true);
  };

  const startDraw = (tipo) => {
    if (!map || !drawnItemsRef.current || !drawnItemsRef.current._map) {
      console.warn("Mapa ou drawnItemsRef ainda nao estao prontos");
      return;
    }

    const options = { shapeOptions: { color: "#6f89a5" } };
    let drawer;

    setShowDrawSubmenu(false);

    switch (tipo) {
      case "polygon":
        drawer = new L.Draw.Polygon(map, options);
        break;
      case "rectangle":
        drawer = new L.Draw.Rectangle(map, options);
        break;
      case "polyline":
        drawer = new L.Draw.Polyline(map, options);
        break;
      case "marker": {
        const customMarker = new L.Icon({
          iconUrl: "/icons/marker.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });
        drawer = new L.Draw.Marker(map, { icon: customMarker });
        break;
      }
      default:
        return;
    }

    drawer.enable();
    map.once(L.Draw.Event.CREATED, (e) => {
      drawnItemsRef.current.addLayer(e.layer);
      setDesenhos((prev) => [
        ...prev,
        {
          tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1),
          layer: e.layer,
          visivel: true,
          resumo: obterResumoDesenho(e.layer),
        },
      ]);
    });
  };

  const startMeasurement = (tipo) => {
    if (!map) return;

    clearMeasurementLayers();
    detachMeasurementCreatedHandler();
    setTipoMedicao(tipo);
    setResultado("");
    setLinhasMedicao([]);
    setMedindo(true);

    const shapeOptions = { color: "#c38f5d" };
    const novoDrawer =
      tipo === "polygon"
        ? new L.Draw.Polygon(map, { shapeOptions })
        : new L.Draw.Polyline(map, { shapeOptions });

    novoDrawer.enable();
    setMedicaoDrawer(novoDrawer);

    const handleMeasurementCreated = (e) => {
      detachMeasurementCreatedHandler();
      setMedicaoDrawer(null);

      const layer = e.layer;
      const geojson = layer.toGeoJSON();

      measurementLayersRef.current.push(layer);
      drawnItemsRef.current.addLayer(layer);

      if (tipo === "polygon") {
        const areaM2 = turf.area(geojson);
        let valor = 0;
        let unidadeStr = "";

        switch (unidade) {
          case "mÂ²":
            valor = areaM2;
            unidadeStr = "mÂ²";
            break;
          case "ha":
            valor = areaM2 / 10000;
            unidadeStr = "hectares";
            break;
          case "kmÂ²":
            valor = areaM2 / 1e6;
            unidadeStr = "kmÂ²";
            break;
          case "alq":
            valor = areaM2 / 24200;
            unidadeStr = "alqueires";
            break;
          default:
            valor = areaM2;
            unidadeStr = "mÂ²";
            break;
        }

        const center = layer.getBounds().getCenter();
        L.popup()
          .setLatLng(center)
          .setContent(`<b>${valor.toFixed(2)} ${unidadeStr}</b>`)
          .openOn(map);

        setResultado(`${valor.toFixed(2)} ${unidadeStr}`);
        setMedindo(false);
        return;
      }

      const coords = geojson.geometry.coordinates;
      let total = 0;
      const segmentos = [];

      for (let i = 1; i < coords.length; i += 1) {
        const seg = turf.lineString([coords[i - 1], coords[i]]);
        const dist = turf.length(seg, {
          units: unidade === "km" ? "kilometers" : "meters",
        });
        total += dist;
        segmentos.push({ segmento: `${i} -> ${i + 1}`, valor: dist });
      }

      setLinhasMedicao(segmentos);
      setResultado(
        unidade === "km"
          ? `Distancia total: ${total.toFixed(2)} km`
          : `Distancia total: ${(total * 1000).toFixed(2)} m`
      );
      setMedindo(false);
    };

    measurementCreatedHandlerRef.current = handleMeasurementCreated;
    map.on(L.Draw.Event.CREATED, handleMeasurementCreated);
  };

  const resetMeasurement = () => {
    stopMeasurementMode({ clearResults: true });
  };

  const exportarKML = () => {
    const features = [];

    drawnItemsRef.current.eachLayer((layer) => {
      let feature = layer.toGeoJSON();

      if (feature.type === "FeatureCollection") {
        feature = feature.features[0];
      }

      let coords = turf.getCoords(feature);
      let numVertices = coords.flat(Infinity).length;

      if (numVertices > 100) {
        let tolerance = 0.0005;
        let simplified = feature;

        while (numVertices > 100 && tolerance < 0.01) {
          try {
            simplified = turf.simplify(feature, {
              tolerance,
              highQuality: true,
              mutate: false,
            });

            coords = turf.getCoords(simplified);
            numVertices = coords.flat(Infinity).length;
            tolerance += 0.0005;
          } catch (error) {
            console.warn("Erro na simplificacao:", error);
            break;
          }
        }

        feature = simplified;
      }

      feature = turf.cleanCoords(feature);
      features.push(feature);
    });

    const geojson = {
      type: "FeatureCollection",
      features,
    };

    const kml = tokml(geojson);
    const blob = new Blob([kml], {
      type: "application/vnd.google-earth.kml+xml",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "desenhos.kml";
    a.click();
  };

  return (
    <>
      <div id="tool-sidebar" ref={toolSidebarRef}>
        <div style={{ position: "relative" }}>
          <button
            id="tour-tool-draw"
            className={showDrawSubmenu ? "is-active" : ""}
            onClick={toggleDrawSubmenu}
            title="Desenhar"
            type="button"
            aria-pressed={showDrawSubmenu}
          >
            <img src="/icons/pencil-line.svg" alt="Desenhar" style={toolIconStyle} />
          </button>
          {showDrawSubmenu && (
            <div className="tool-submenu">
              <button onClick={() => startDraw("polygon")} title="Poligono" type="button">
                <img src="/icons/crop.svg" alt="Poligono" style={toolIconStyle} />
              </button>
              <button onClick={() => startDraw("rectangle")} title="Retangulo" type="button">
                <img src="/icons/crop.svg" alt="Retangulo" style={toolIconStyle} />
              </button>
              <button onClick={() => startDraw("polyline")} title="Linha" type="button">
                <img src="/icons/line-squiggle.svg" alt="Linha" style={toolIconStyle} />
              </button>
              <button onClick={() => startDraw("marker")} title="Ponto" type="button">
                <img src="/icons/map-pin.svg" alt="Ponto" style={toolIconStyle} />
              </button>
              <button onClick={exportarKML} title="Exportar" type="button">
                <img src="/icons/download.svg" alt="Exportar" style={toolIconStyle} />
              </button>
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <button
            id="tour-tool-measure"
            className={showMeasureSubmenu || tipoMedicao ? "is-active" : ""}
            onClick={toggleMeasurementPanel}
            title="Medir"
            type="button"
            aria-pressed={showMeasureSubmenu || !!tipoMedicao}
          >
            <img
              src="/icons/ruler-dimension-line.svg"
              alt="Medir"
              style={toolIconStyle}
            />
          </button>
          {showMeasureSubmenu && (
            <div className="tool-submenu">
              {!medindo && (
                <>
                  <button onClick={() => startMeasurement("polygon")} title="Area" type="button">
                    <img src="/icons/crop.svg" alt="Area" style={toolIconStyle} />
                  </button>
                  <button onClick={() => startMeasurement("polyline")} title="Distancia" type="button">
                    <img
                      src="/icons/ruler-dimension-line.svg"
                      alt="Distancia"
                      style={toolIconStyle}
                    />
                  </button>
                </>
              )}
              {medindo && (
                <button onClick={() => stopMeasurementMode()} title="Parar" type="button">
                  <img src="/icons/circle-stop.svg" alt="Parar" style={toolIconStyle} />
                </button>
              )}
            </div>
          )}
        </div>

        <button id="tour-tool-import" onClick={() => fileInputRef.current.click()} title="Importar" type="button">
          <img src="/icons/file-input.svg" alt="Importar" style={toolIconStyle} />
        </button>

        <button id="tour-tool-import-car" onClick={() => fileInputRefCAR.current.click()} title="Importar CAR" type="button">
          <img src="/icons/novo-car.png" alt="Importar CAR" style={toolIconStyle} />
        </button>

        <button
          id="tour-tool-buscar-car"
          className={mostrarBuscaCAR ? "is-active" : ""}
          onClick={() => setMostrarBuscaCAR((prev) => !prev)}
          title="Buscar CAR"
          type="button"
          aria-pressed={mostrarBuscaCAR}
        >
          <img src="/icons/buscar-car.png" alt="Buscar CAR" style={toolIconStyle} />
        </button>

        <GerarAreaBeneficiavel
          map={map}
          drawnItemsRef={drawnItemsRef}
          camadasImportadas={camadasImportadas}
          setCamadasImportadas={setCamadasImportadas}
          camadas={camadas}
          showProcessingOverlay={showProcessingOverlay}
          hideProcessingOverlay={hideProcessingOverlay}
        />

        <RelatorioTemporalTool
          camadas={camadas}
          carLayerBusca={carLayerBusca}
          showProcessingOverlay={showProcessingOverlay}
          hideProcessingOverlay={hideProcessingOverlay}
        />

        <VerificarSobreposicao
          carLayerBusca={carLayerBusca}
          camadas={camadas}
          onPrepararMapaRelatorio={prepararMapaRelatorio}
          onLimparMapaRelatorio={limparMapaRelatorio}
          showProcessingOverlay={showProcessingOverlay}
          hideProcessingOverlay={hideProcessingOverlay}
        />
      </div>

      {tipoMedicao && (
        <div ref={measurementPanelRef}>
          <MeasurementPanel
            tipo={tipoMedicao}
            unidade={unidade}
            setUnidade={setUnidade}
            resultado={resultado}
            medindo={medindo}
            onStart={() => startMeasurement(tipoMedicao)}
            onReset={resetMeasurement}
            onClose={() => stopMeasurementMode({ clearResults: true, closePanel: true })}
          />
        </div>
      )}

      <BuscaCAR
        map={map}
        drawnItemsRef={drawnItemsRef}
        onClose={() => setMostrarBuscaCAR(false)}
        visivel={mostrarBuscaCAR}
        setCarLayerBusca={setCarLayerBusca}
        setCamadasImportadas={setCamadasImportadas}
        setAreaDoImovelLayer={setAreaDoImovelLayer}
        showProcessingOverlay={showProcessingOverlay}
        hideProcessingOverlay={hideProcessingOverlay}
      />

      {linhasMedicao.length > 0 && (
      <div className="painel-medicao" ref={painelMedicaoRef}>
          <strong>Segmentos:</strong>
          <ul style={{ margin: 0, paddingLeft: "1em" }}>
            {linhasMedicao.map((seg, i) => (
              <li key={i}>
                {seg.segmento}:{" "}
                {(unidade === "km" ? seg.valor : seg.valor * 1000).toFixed(1)}{" "}
                {unidade === "km" ? "km" : "m"}
              </li>
            ))}
          </ul>
          <div>
            <strong>{resultado}</strong>
          </div>
        </div>
      )}

      {mostrarMapaRelatorio && mapaRelatorioData.areaGeoJSON && (
        <MapaRelatorio
          geojson={mapaRelatorioData.areaGeoJSON}
          overlayLayers={mapaRelatorioData.overlayLayers}
          onReady={handleMapaRelatorioReady}
        />
      )}
    </>
  );
}
