import { useEffect, useRef, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import { filtrarFeatureCollection } from "../utils/filtrarFeatureCollection";

const RETRY_DELAY_MS = 1800;

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function WfsBboxLayer({
  baseUrl,
  wfsBaseUrl,
  typeName,
  visivel,
  minZoom = 7,
  style,
  onEachFeature,
  wfsParams = {},
  wfsVersion = "2.0.0",
  bboxAxisOrder = "lonlat",
  featureFilter = null,
}) {
  const map = useMap();
  const [data, setData] = useState(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const abortRef = useRef(null);
  const lastBboxRef = useRef("");

  async function fetchWithRetry(url, options, retries = 1) {
    let lastResponseText = "";

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const response = await fetch(url, options);
      const text = await response.text();
      lastResponseText = text;

      if (response.ok) {
        return { response, text };
      }

      const isRetriable = response.status === 502 || response.status === 503 || response.status === 504;
      if (!isRetriable || attempt === retries) {
        return { response, text };
      }

      await delay(RETRY_DELAY_MS);
    }

    return {
      response: { ok: false, status: 502 },
      text: lastResponseText,
    };
  }

  async function fetchByBbox({ force = false } = {}) {
    if (!visivel) return;

    const zoomAtual = map.getZoom();
    if (zoomAtual < minZoom) {
      lastBboxRef.current = "";
      setData(null);
      return;
    }

    // Busca uma area um pouco maior que a viewport para evitar "buracos"
    // quando o usuario desloca o mapa em pequenas distancias.
    const bounds = map.getBounds().pad(0.2);
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const bboxCoords =
      bboxAxisOrder === "latlon"
        ? [sw.lat, sw.lng, ne.lat, ne.lng]
        : [sw.lng, sw.lat, ne.lng, ne.lat];
    const bbox = `${bboxCoords.join(",")},EPSG:4326`;

    if (!force && bbox === lastBboxRef.current) {
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const typeParamName = String(wfsVersion).startsWith("2.") ? "typenames" : "typeName";
    const query = new URLSearchParams({
      base: wfsBaseUrl,
      service: "WFS",
      version: wfsVersion,
      request: "GetFeature",
      outputFormat: "application/json",
      srsName: "EPSG:4326",
      bbox,
    });
    query.set(typeParamName, typeName);

    Object.entries(wfsParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    });

    const url = `${baseUrl}?${query.toString()}`;

    try {
      const { response: res, text } = await fetchWithRetry(
        url,
        { signal: abortRef.current.signal },
        1
      );

      if (!res.ok) {
        console.warn(`WFS retornou status ${res.status} para ${typeName}.`, text.slice(0, 200));
        setData(null);
        return;
      }

      if (text.trim().startsWith("<")) {
        console.warn(`WFS retornou XML para ${typeName}.`, text.slice(0, 200));
        setData(null);
        return;
      }

      const json = JSON.parse(text);
      const filteredJson = filtrarFeatureCollection(json, featureFilter);
      lastBboxRef.current = bbox;
      setData(filteredJson);
      setRenderVersion((prev) => prev + 1);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn(`Erro ao carregar WFS por BBOX para ${typeName}:`, err);
      setData(null);
    }
  }

  useEffect(() => {
    if (!visivel) {
      lastBboxRef.current = "";
      setData(null);
      return;
    }

    fetchByBbox({ force: true });

    const onMoveEnd = () => fetchByBbox();
    map.on("moveend", onMoveEnd);
    map.on("zoomend", onMoveEnd);

    return () => {
      map.off("moveend", onMoveEnd);
      map.off("zoomend", onMoveEnd);
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visivel,
    typeName,
    baseUrl,
    wfsBaseUrl,
    minZoom,
    wfsParams,
    wfsVersion,
    bboxAxisOrder,
    featureFilter,
  ]);

  if (!visivel || !data) return null;

  return (
    <GeoJSON
      key={`${typeName}-${renderVersion}`}
      data={data}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}
