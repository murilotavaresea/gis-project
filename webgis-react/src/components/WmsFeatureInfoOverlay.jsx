import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import formatarPopupAtributos from "../utils/formatarPopupAtributos";

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

export default function WmsFeatureInfoOverlay({ camadas, proxyBaseUrl }) {
  const map = useMap();
  const abortRef = useRef(null);
  const activeIdentifyLayers = useMemo(
    () =>
      (camadas || []).filter(
        (camada) =>
          camada?.externa &&
          camada?.sourceType === "wms" &&
          camada?.visivel &&
          camada?.identifyEnabled &&
          camada?.wmsBaseUrl
      ),
    [camadas]
  );

  useEffect(() => {
    if (!proxyBaseUrl || activeIdentifyLayers.length === 0) {
      return undefined;
    }

    const handleClick = async (event) => {
      const orderedLayers = [...activeIdentifyLayers].reverse();

      if (abortRef.current) {
        abortRef.current.abort();
      }

      abortRef.current = new AbortController();

      for (const layer of orderedLayers) {
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

          const popupHtml = formatarPopupAtributos(attrs);
          if (!popupHtml) {
            return;
          }

          map.openPopup(
            L.popup({ maxWidth: 420 })
              .setLatLng(event.latlng)
              .setContent(popupHtml)
          );
          return;
        } catch (error) {
          if (error?.name === "AbortError") {
            return;
          }
        }
      }
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [activeIdentifyLayers, map, proxyBaseUrl]);

  return null;
}
