import React, { useEffect } from "react";
import L from "leaflet";
import { getEstiloCamada } from "../utils/estiloCamadas";

function obterPassoGrid(bounds) {
  const latSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
  const lngSpan = Math.abs(bounds.getEast() - bounds.getWest());
  const span = Math.max(latSpan, lngSpan);

  if (span > 20) return 5;
  if (span > 10) return 2;
  if (span > 5) return 1;
  if (span > 2) return 0.5;
  if (span > 1) return 0.25;
  if (span > 0.5) return 0.1;
  if (span > 0.2) return 0.05;
  if (span > 0.1) return 0.02;
  return 0.01;
}

function criarRotuloGrid(texto) {
  return L.divIcon({
    className: "mapa-relatorio-gridLabel",
    html: `<span style="display:inline-block;padding:1px 4px;border-radius:4px;background:rgba(248,250,252,0.78);color:#1f2937;font:600 9px/1 sans-serif;">${texto}</span>`,
    iconSize: [60, 16],
    iconAnchor: [30, 8],
  });
}

function adicionarGrid(map, bounds) {
  const step = obterPassoGrid(bounds);
  const gridLayer = L.layerGroup();
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  const startLat = Math.floor(south / step) * step;
  const startLng = Math.floor(west / step) * step;

  for (let lat = startLat; lat <= north + step; lat += step) {
    L.polyline(
      [
        [lat, west],
        [lat, east],
      ],
      {
        color: "#f8fafc",
        opacity: 0.32,
        weight: 0.6,
        dashArray: "2 6",
        interactive: false,
      }
    ).addTo(gridLayer);

    L.marker([lat, west], {
      icon: criarRotuloGrid(`${lat.toFixed(step < 0.1 ? 2 : 1)}°`),
      interactive: false,
    }).addTo(gridLayer);
  }

  for (let lng = startLng; lng <= east + step; lng += step) {
    L.polyline(
      [
        [south, lng],
        [north, lng],
      ],
      {
        color: "#f8fafc",
        opacity: 0.32,
        weight: 0.6,
        dashArray: "2 6",
        interactive: false,
      }
    ).addTo(gridLayer);

    L.marker([south, lng], {
      icon: criarRotuloGrid(`${lng.toFixed(step < 0.1 ? 2 : 1)}°`),
      interactive: false,
    }).addTo(gridLayer);
  }

  gridLayer.addTo(map);
  return gridLayer;
}

function obterEstiloAreaReferencia() {
  return {
    color: "#8f0aa8",
    weight: 2.2,
    opacity: 0.95,
    fillColor: "#c026d3",
    fillOpacity: 0.08,
  };
}

function obterEstiloRelatorio(nomeCamada) {
  const estiloBase = getEstiloCamada(nomeCamada);

  return {
    ...estiloBase,
    weight: Math.max(1.15, (estiloBase.weight || 1.2) + 0.1),
    opacity: Math.max(0.9, estiloBase.opacity || 0.9),
    fillOpacity: Math.max(0.08, estiloBase.fillOpacity || 0.08),
  };
}

function renderizarItemLegenda(nome, estilo, preenchimento = true) {
  const dash = estilo.dashArray || "none";
  const fillColor = preenchimento ? estilo.fillColor || estilo.color : "transparent";
  const fillOpacity = preenchimento ? estilo.fillOpacity || 0 : 0;

  return `
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="
        display:inline-block;
        width:20px;
        height:12px;
        border: ${Math.max(1, Math.round(estilo.weight || 1.2))}px solid ${estilo.color};
        background:${fillColor};
        opacity:${estilo.opacity || 0.9};
        ${dash !== "none" ? `border-style:dashed;` : ""}
        ${fillOpacity ? `box-shadow: inset 0 0 0 999px rgba(255,255,255,${1 - fillOpacity});` : ""}
      "></span>
      <span style="font:600 10px/1.2 sans-serif;color:#102326;">${nome}</span>
    </div>
  `;
}

function montarLegendaHtml(overlayLayers) {
  const itens = [
    renderizarItemLegenda("Area do CAR", obterEstiloAreaReferencia()),
    ...overlayLayers.map((camada) =>
      renderizarItemLegenda(camada.nome, obterEstiloRelatorio(camada.nome))
    ),
  ];

  return `
    <div style="
      display:flex;
      flex-direction:column;
      gap:6px;
      min-width:150px;
      max-width:210px;
      padding:10px 12px;
      border-radius:10px;
      background:rgba(248,250,249,0.88);
      border:1px solid rgba(16,35,38,0.12);
      box-shadow:0 8px 18px rgba(8,15,23,0.14);
      backdrop-filter:blur(8px);
    ">
      <div style="font:700 10px/1 sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:#35585b;">
        Legenda
      </div>
      ${itens.join("")}
    </div>
  `;
}

export default function MapaRelatorio({
  geojson,
  overlayLayers = [],
  onReady,
}) {
  useEffect(() => {
    const container = document.getElementById("mapa-pdf");
    if (!container || !geojson) return undefined;

    container.innerHTML = "";

    const map = L.map(container, {
      attributionControl: false,
      zoomControl: false,
      center: [0, 0],
      zoom: 15,
      minZoom: 1,
      maxZoom: 19,
      inertia: false,
    });

    const tileLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles © Esri",
      }
    );

    const camadaArea = L.geoJSON(geojson, {
      style: obterEstiloAreaReferencia,
    }).addTo(map);

    overlayLayers.forEach((camada) => {
      if (!camada?.geojson) return;

      L.geoJSON(camada.geojson, {
        style: () => obterEstiloRelatorio(camada.nome),
      }).addTo(map);
    });

    tileLayer.addTo(map);

    const boundsArea = camadaArea.getBounds();
 
    if (boundsArea.isValid()) {
      map.whenReady(() => {
        map.invalidateSize(false);
        map.fitBounds(boundsArea.pad(0.2), {
          paddingTopLeft: [18, 18],
          paddingBottomRight: [18, 18],
        });
      });
    }

    let gridLayer = null;
    let readyNotified = false;
    const finalizarRender = () => {
      if (gridLayer) {
        map.removeLayer(gridLayer);
      }

      map.invalidateSize(false);
      gridLayer = adicionarGrid(map, map.getBounds().pad(0.02));

      if (onReady && !readyNotified) {
        readyNotified = true;
        window.setTimeout(() => onReady(), 150);
      }
    };

    tileLayer.on("load", finalizarRender);
    map.whenReady(finalizarRender);

    return () => {
      tileLayer.off("load", finalizarRender);
      map.remove();
    };
  }, [geojson, overlayLayers, onReady]);

  return (
    <div
      id="mapa-pdf"
      style={{
        width: "500px",
        height: "300px",
        position: "absolute",
        top: "-10000px",
        left: "-10000px",
        zIndex: -1,
        pointerEvents: "none",
      }}
    >
      <img
        src="/icons/north.svg"
        alt="Norte"
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          width: "40px",
          zIndex: 999,
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          background: "rgba(255,255,255,0.8)",
          padding: "2px 6px",
          fontSize: "10px",
          borderRadius: "4px",
          fontFamily: "sans-serif",
          zIndex: 999,
        }}
      >
        --- 100 m
      </div>

      <div
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          zIndex: 999,
        }}
        dangerouslySetInnerHTML={{ __html: montarLegendaHtml(overlayLayers) }}
      />
    </div>
  );
}
