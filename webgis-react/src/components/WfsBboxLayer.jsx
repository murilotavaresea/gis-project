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
  wfsPageSize = null,
  wfsMaxPages = 1,
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
    const maxParamName = String(wfsVersion).startsWith("2.") ? "count" : "maxFeatures";

    const buildQuery = (pageIndex = 0) => {
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

      if (wfsPageSize) {
        query.set(maxParamName, String(wfsPageSize));
        query.set("startIndex", String(pageIndex * wfsPageSize));
      }

      return query;
    };

    try {
      const totalPages = Math.max(1, wfsPageSize ? wfsMaxPages : 1);
      let allFeatures = [];
      let collectionType = "FeatureCollection";

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        const url = `${baseUrl}?${buildQuery(pageIndex).toString()}`;
        const { response: res, text } = await fetchWithRetry(
          url,
          { signal: abortRef.current.signal },
          1
        );

        if (!res.ok) {
          console.warn(
            `WFS retornou status ${res.status} para ${typeName}.`,
            {
              proxyTransform: res.headers.get("X-Proxy-Transform"),
              featureCount: res.headers.get("X-Feature-Count"),
              contentType: res.headers.get("Content-Type"),
              body: text.slice(0, 400),
            }
          );
          setData(null);
          return;
        }

        if (text.trim().startsWith("<")) {
          console.warn(
            `WFS retornou XML para ${typeName}.`,
            {
              proxyTransform: res.headers.get("X-Proxy-Transform"),
              featureCount: res.headers.get("X-Feature-Count"),
              contentType: res.headers.get("Content-Type"),
              body: text.slice(0, 400),
            }
          );
          setData(null);
          return;
        }

        const json = JSON.parse(text);
        const filteredJson = filtrarFeatureCollection(json, featureFilter);
        const pageFeatures = filteredJson?.features || [];

        console.info(`WFS carregado para ${typeName}.`, {
          pageIndex,
          pageFeatures: pageFeatures.length,
          proxyTransform: res.headers.get("X-Proxy-Transform"),
          featureCount: res.headers.get("X-Feature-Count"),
        });

        collectionType = filteredJson?.type || collectionType;
        allFeatures = [...allFeatures, ...pageFeatures];

        setData({
          type: collectionType,
          features: allFeatures,
        });
        setRenderVersion((prev) => prev + 1);

        if (!wfsPageSize || pageFeatures.length < wfsPageSize) {
          break;
        }
      }

      lastBboxRef.current = bbox;
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
    wfsPageSize,
    wfsMaxPages,
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
