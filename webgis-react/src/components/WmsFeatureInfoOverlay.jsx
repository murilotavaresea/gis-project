import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import {
  booleanPointInPolygon,
  point as turfPoint,
  pointToLineDistance,
} from "@turf/turf";
import formatarPopupAtributos from "../utils/formatarPopupAtributos";

const DRAW_INTERACTION_COOLDOWN_MS = 300;

function parsePlainTextFeatureInfo(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const attrs = {};

  lines.forEach((line) => {
    if (
      /^GetFeatureInfo results:/i.test(line) ||
      /^Layer ['"].*['"]$/i.test(line) ||
      /^Feature\s+\d+/i.test(line) ||
      /^Search returned no results/i.test(line)
    ) {
      return;
    }

    const match = line.match(/^([^=:]+?)\s*[=:]\s*(.+)$/);
    if (match) {
      attrs[match[1].trim()] = match[2].trim();
    }
  });

  return Object.keys(attrs).length > 0 ? attrs : null;
}

function parseHtmlFeatureInfo(text) {
  try {
    const doc = new DOMParser().parseFromString(text, "text/html");
    const rows = [...doc.querySelectorAll("tr")];
    const attrs = {};

    rows.forEach((row) => {
      const cells = [...row.querySelectorAll("th, td")];
      if (cells.length < 2) {
        return;
      }

      const key = cells[0].textContent?.trim();
      const value = cells[1].textContent?.trim();

      if (key) {
        attrs[key] = value ?? "";
      }
    });

    return Object.keys(attrs).length > 0 ? attrs : null;
  } catch {
    return null;
  }
}

function hasNoResults(text) {
  return /Search returned no results/i.test(text);
}

function buildFeatureInfoPopupContent(results = []) {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  if (results.length === 1) {
    return formatarPopupAtributos(results[0].attrs);
  }

  const root = document.createElement("div");
  root.className = "feature-info-popup";

  const sidebar = document.createElement("div");
  sidebar.className = "feature-info-sidebar";

  const title = document.createElement("div");
  title.className = "feature-info-title";
  title.textContent = "Resultados encontrados";
  sidebar.appendChild(title);

  const list = document.createElement("div");
  list.className = "feature-info-list";

  const content = document.createElement("div");
  content.className = "feature-info-content";

  const renderActiveResult = (index) => {
    const activeResult = results[index];
    content.innerHTML = formatarPopupAtributos(activeResult.attrs) || "";

    [...list.querySelectorAll(".feature-info-item")].forEach((button, buttonIndex) => {
      button.classList.toggle("is-active", buttonIndex === index);
    });
  };

  results.forEach((result, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "feature-info-item";
    button.textContent = result.label;
    button.addEventListener("click", () => renderActiveResult(index));
    list.appendChild(button);
  });

  sidebar.appendChild(list);
  root.appendChild(sidebar);
  root.appendChild(content);

  renderActiveResult(0);

  return root;
}

function buildOrderedVisibleLayers(camadas = [], orderedLayerNames = []) {
  const visibles = (camadas || []).filter((camada) => camada?.externa && camada?.visivel);

  return [
    ...orderedLayerNames
      .map((nome) => visibles.find((camada) => camada.nome === nome))
      .filter(Boolean),
    ...visibles.filter((camada) => !orderedLayerNames.includes(camada.nome)),
  ];
}

function buildToleranceMeters(map, latlng, pixels = 10) {
  const point = map.latLngToContainerPoint(latlng);
  const shiftedLatLng = map.containerPointToLatLng([point.x + pixels, point.y]);
  return map.distance(latlng, shiftedLatLng);
}

function featureMatchesClick(feature, map, latlng, toleranceMeters) {
  const geometry = feature?.geometry;
  if (!geometry?.type) {
    return false;
  }

  const clickPoint = turfPoint([latlng.lng, latlng.lat]);

  switch (geometry.type) {
    case "Point":
      return (
        map.distance(latlng, L.latLng(geometry.coordinates[1], geometry.coordinates[0])) <=
        toleranceMeters
      );
    case "MultiPoint":
      return geometry.coordinates.some(
        (coords) => map.distance(latlng, L.latLng(coords[1], coords[0])) <= toleranceMeters
      );
    case "Polygon":
    case "MultiPolygon":
      return booleanPointInPolygon(clickPoint, feature);
    case "LineString":
    case "MultiLineString":
      return pointToLineDistance(clickPoint, feature, { units: "meters" }) <= toleranceMeters;
    default:
      return false;
  }
}

function collectVectorResults({ layers, featureCollectionsExternas, map, latlng }) {
  const toleranceMeters = buildToleranceMeters(map, latlng);
  const results = [];

  layers.forEach((layer) => {
    if (!layer || layer.sourceType === "wms") {
      return;
    }

    const collection = featureCollectionsExternas?.[layer.nome];
    const features = collection?.features || [];
    let matchedInLayer = 0;

    features.forEach((feature) => {
      if (!featureMatchesClick(feature, map, latlng, toleranceMeters)) {
        return;
      }

      matchedInLayer += 1;
      results.push({
        layer,
        attrs: feature,
        label:
          matchedInLayer > 1
            ? `${layer.titulo || layer.nome} · Feicao ${matchedInLayer}`
            : layer.titulo || layer.nome,
      });
    });
  });

  return results;
}

function collectImportedLayerResults({ camadasImportadas = [], map, latlng }) {
  const toleranceMeters = buildToleranceMeters(map, latlng);
  const results = [];

  camadasImportadas
    .filter((camada) => camada?.visivel !== false && camada?.layer?.toGeoJSON)
    .forEach((camada) => {
      const geojson = camada.layer.toGeoJSON();
      const features =
        geojson?.type === "FeatureCollection"
          ? geojson.features || []
          : geojson?.type === "Feature"
            ? [geojson]
            : [];
      let matchedInLayer = 0;

      features.forEach((feature) => {
        if (!featureMatchesClick(feature, map, latlng, toleranceMeters)) {
          return;
        }

        matchedInLayer += 1;
        results.push({
          layer: camada,
          attrs: feature,
          label:
            matchedInLayer > 1
              ? `${camada.rotulo || camada.nome || "Camada importada"} · Feicao ${matchedInLayer}`
              : camada.rotulo || camada.nome || "Camada importada",
        });
      });
    });

  return results;
}

async function requestFeatureInfo({ proxyBaseUrl, layer, map, latlng, signal }) {
  const size = map.getSize();
  const bounds = map.getBounds();
  const point = map.latLngToContainerPoint(latlng).round();
  const bbox = [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ].join(",");
  const formats = ["text/plain", "text/html"];

  for (const infoFormat of formats) {
    const query = new URLSearchParams({
      service: "WMS",
      version: "1.1.1",
      request: "GetFeatureInfo",
      layers: layer.wmsLayers || layer.typeName || layer.nome,
      query_layers: layer.wmsLayers || layer.typeName || layer.nome,
      styles: "",
      srs: "EPSG:4326",
      bbox,
      width: String(size.x),
      height: String(size.y),
      x: String(point.x),
      y: String(point.y),
      info_format: infoFormat,
      feature_count: "5",
      format: "image/png",
      transparent: "true",
    });

    const identifyUrl = `${proxyBaseUrl}?base=${encodeURIComponent(layer.wmsBaseUrl)}&${query.toString()}`;
    const response = await fetch(identifyUrl, { signal });
    const text = await response.text();

    if (!response.ok) {
      continue;
    }

    if (!text.trim() || hasNoResults(text)) {
      continue;
    }

    const attrs =
      infoFormat === "text/html"
        ? parseHtmlFeatureInfo(text)
        : parsePlainTextFeatureInfo(text);

    if (!attrs) {
      continue;
    }

    return attrs;
  }

  return null;
}

export default function WmsFeatureInfoOverlay({
  camadas,
  camadasImportadas = [],
  featureCollectionsExternas = {},
  orderedLayerNames = [],
  proxyBaseUrl,
}) {
  const map = useMap();
  const abortRef = useRef(null);
  const drawInteractionActiveRef = useRef(false);
  const suppressClicksUntilRef = useRef(0);
  const orderedVisibleLayers = useMemo(
    () => buildOrderedVisibleLayers(camadas, orderedLayerNames),
    [camadas, orderedLayerNames]
  );
  const activeIdentifyLayers = useMemo(
    () =>
      orderedVisibleLayers.filter(
        (camada) =>
          camada?.sourceType === "wms" &&
          camada?.identifyEnabled &&
          camada?.wmsBaseUrl
      ),
    [orderedVisibleLayers]
  );

  useEffect(() => {
    const activateSuppression = () => {
      drawInteractionActiveRef.current = true;
      suppressClicksUntilRef.current = Date.now() + DRAW_INTERACTION_COOLDOWN_MS;
      map.closePopup();
    };

    const releaseSuppression = () => {
      drawInteractionActiveRef.current = false;
      suppressClicksUntilRef.current = Date.now() + DRAW_INTERACTION_COOLDOWN_MS;
    };

    map.on("draw:drawstart", activateSuppression);
    map.on("draw:editstart", activateSuppression);
    map.on("draw:deletestart", activateSuppression);
    map.on("draw:created", releaseSuppression);
    map.on("draw:drawstop", releaseSuppression);
    map.on("draw:editstop", releaseSuppression);
    map.on("draw:deletestop", releaseSuppression);

    return () => {
      map.off("draw:drawstart", activateSuppression);
      map.off("draw:editstart", activateSuppression);
      map.off("draw:deletestart", activateSuppression);
      map.off("draw:created", releaseSuppression);
      map.off("draw:drawstop", releaseSuppression);
      map.off("draw:editstop", releaseSuppression);
      map.off("draw:deletestop", releaseSuppression);
    };
  }, [map]);

  useEffect(() => {
    if (orderedVisibleLayers.length === 0) {
      return undefined;
    }

    const handleClick = async (event) => {
      if (
        drawInteractionActiveRef.current ||
        Date.now() < suppressClicksUntilRef.current
      ) {
        return;
      }

      const results = collectVectorResults({
        layers: orderedVisibleLayers,
        featureCollectionsExternas,
        map,
        latlng: event.latlng,
      });
      results.push(
        ...collectImportedLayerResults({
          camadasImportadas,
          map,
          latlng: event.latlng,
        })
      );

      if (abortRef.current) {
        abortRef.current.abort();
      }

      abortRef.current = new AbortController();

      if (proxyBaseUrl) {
        for (const layer of activeIdentifyLayers) {
          if (map.getZoom() < (layer.minZoom ?? 7)) {
            continue;
          }

          try {
            const attrs = await requestFeatureInfo({
              proxyBaseUrl,
              layer,
              map,
              latlng: event.latlng,
              signal: abortRef.current.signal,
            });

            if (!attrs) {
              continue;
            }

            results.push({
              layer,
              attrs,
              label: layer.titulo || layer.nome,
            });
          } catch (error) {
            if (error?.name === "AbortError") {
              return;
            }
          }
        }
      }

      if (results.length === 0) {
        return;
      }

      const popupContent = buildFeatureInfoPopupContent(results);
      if (!popupContent) {
        return;
      }

      map.openPopup(
        L.popup({ maxWidth: 620, className: "feature-info-leafletPopup" })
          .setLatLng(event.latlng)
          .setContent(popupContent)
      );
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [
    activeIdentifyLayers,
    camadasImportadas,
    featureCollectionsExternas,
    map,
    orderedVisibleLayers,
    proxyBaseUrl,
  ]);

  return null;
}
