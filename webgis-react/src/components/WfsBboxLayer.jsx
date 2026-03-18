import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import { filtrarFeatureCollection } from "../utils/filtrarFeatureCollection";

const RETRY_DELAY_MS = 1800;
const RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const LAST_RESPONSE_BY_LAYER = new Map();

function buildPaneName(paneKey) {
  return `external-wfs-${String(paneKey || "default").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildLayerCacheKey({ baseUrl, wfsBaseUrl, typeName, wfsVersion, wfsPageSize, wfsMaxPages }) {
  return JSON.stringify({
    baseUrl,
    wfsBaseUrl,
    typeName,
    wfsVersion,
    wfsPageSize: wfsPageSize || null,
    wfsMaxPages: wfsMaxPages || 1,
  });
}

export default function WfsBboxLayer({
  baseUrl,
  wfsBaseUrl,
  typeName,
  paneKey,
  visivel,
  minZoom = 7,
  zIndex = 410,
  style,
  onEachFeature,
  wfsParams = {},
  wfsVersion = "2.0.0",
  bboxAxisOrder = "lonlat",
  featureFilter = null,
  wfsPageSize = null,
  wfsMaxPages = 1,
  onLoadingChange,
  onDataChange,
}) {
  const map = useMap();
  const [data, setData] = useState(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const abortRef = useRef(null);
  const lastBboxRef = useRef("");
  const onLoadingChangeRef = useRef(onLoadingChange);
  const onDataChangeRef = useRef(onDataChange);
  const layerCacheKeyRef = useRef(
    buildLayerCacheKey({ baseUrl, wfsBaseUrl, typeName, wfsVersion, wfsPageSize, wfsMaxPages })
  );
  const paneName = useMemo(() => buildPaneName(paneKey || typeName), [paneKey, typeName]);

  useEffect(() => {
    layerCacheKeyRef.current = buildLayerCacheKey({
      baseUrl,
      wfsBaseUrl,
      typeName,
      wfsVersion,
      wfsPageSize,
      wfsMaxPages,
    });
  }, [baseUrl, wfsBaseUrl, typeName, wfsVersion, wfsPageSize, wfsMaxPages]);

  useEffect(() => {
    onLoadingChangeRef.current = onLoadingChange;
  }, [onLoadingChange]);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    let pane = map.getPane(paneName);

    if (!pane) {
      pane = map.createPane(paneName);
    }

    pane.style.zIndex = String(zIndex);
    pane.style.pointerEvents = "auto";
  }, [map, paneName, zIndex]);

  async function fetchWithRetry(url, options, retries = 1) {
    let lastResponseText = "";

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(url, options);
        const text = await response.text();
        lastResponseText = text;

        if (response.ok) {
          return { response, text };
        }

        const isRetriable =
          response.status === 429 ||
          response.status === 500 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504;
        if (!isRetriable || attempt === retries) {
          return { response, text };
        }
      } catch (error) {
        if (error?.name === "AbortError") {
          throw error;
        }

        if (attempt === retries) {
          throw error;
        }
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
      onLoadingChangeRef.current?.(false);
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
    onLoadingChangeRef.current?.(true);

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

    const firstRequestKey = `${baseUrl}?${buildQuery(0).toString()}`;
    const cachedEntry = LAST_RESPONSE_BY_LAYER.get(layerCacheKeyRef.current);
    if (
      cachedEntry &&
      cachedEntry.requestKey === firstRequestKey &&
      cachedEntry.expiresAt > Date.now()
    ) {
      lastBboxRef.current = bbox;
      setData(cachedEntry.data);
      setRenderVersion((prev) => prev + 1);
      onDataChangeRef.current?.(cachedEntry.data);
      onLoadingChangeRef.current?.(false);
      return;
    }

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
          onDataChangeRef.current?.(null);
          onLoadingChangeRef.current?.(false);
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
          onDataChangeRef.current?.(null);
          onLoadingChangeRef.current?.(false);
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
        onDataChangeRef.current?.({
          type: collectionType,
          features: allFeatures,
        });
        setRenderVersion((prev) => prev + 1);

        if (!wfsPageSize || pageFeatures.length < wfsPageSize) {
          break;
        }
      }

      lastBboxRef.current = bbox;
      LAST_RESPONSE_BY_LAYER.set(layerCacheKeyRef.current, {
        requestKey: firstRequestKey,
        expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
        data: {
          type: collectionType,
          features: allFeatures,
        },
      });
      onLoadingChangeRef.current?.(false);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn(`Erro ao carregar WFS por BBOX para ${typeName}:`, err);
      setData(null);
      onDataChangeRef.current?.(null);
      onLoadingChangeRef.current?.(false);
    }
  }

  useEffect(() => {
    if (!visivel) {
      lastBboxRef.current = "";
      setData(null);
      onDataChangeRef.current?.(null);
      onLoadingChangeRef.current?.(false);
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
      onLoadingChangeRef.current?.(false);
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
      pane={paneName}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}
