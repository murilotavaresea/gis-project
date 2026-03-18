import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";

const RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const LAST_RESPONSE_BY_LAYER = new Map();

function buildPaneName(paneKey) {
  return `external-mapbiomas-${String(paneKey || "default").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function buildLayerCacheKey({
  url,
  startDate,
  endDate,
  sources,
  pageSize,
  maxPages,
}) {
  return JSON.stringify({
    url,
    startDate,
    endDate,
    sources,
    pageSize,
    maxPages,
  });
}

export default function MapbiomasAlertLayer({
  url,
  paneKey,
  visivel,
  minZoom = 6,
  zIndex = 410,
  style,
  onEachFeature,
  startDate = "2019-01-01",
  endDate = null,
  sources = ["All"],
  pageSize = 100,
  maxPages = 3,
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
    buildLayerCacheKey({ url, startDate, endDate, sources, pageSize, maxPages })
  );
  const paneName = useMemo(() => buildPaneName(paneKey || "mapbiomas-alerta"), [paneKey]);

  useEffect(() => {
    onLoadingChangeRef.current = onLoadingChange;
  }, [onLoadingChange]);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    layerCacheKeyRef.current = buildLayerCacheKey({
      url,
      startDate,
      endDate,
      sources,
      pageSize,
      maxPages,
    });
  }, [url, startDate, endDate, sources, pageSize, maxPages]);

  useEffect(() => {
    let pane = map.getPane(paneName);

    if (!pane) {
      pane = map.createPane(paneName);
    }

    pane.style.zIndex = String(zIndex);
    pane.style.pointerEvents = "auto";
  }, [map, paneName, zIndex]);

  async function fetchByBbox({ force = false } = {}) {
    if (!visivel) {
      return;
    }

    const zoomAtual = map.getZoom();
    if (zoomAtual < minZoom) {
      lastBboxRef.current = "";
      setData(null);
      onDataChangeRef.current?.(null);
      onLoadingChangeRef.current?.(false);
      return;
    }

    const bounds = map.getBounds().pad(0.2);
    const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    const bboxKey = bbox.join(",");

    if (!force && bboxKey === lastBboxRef.current) {
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }

    abortRef.current = new AbortController();
    onLoadingChangeRef.current?.(true);

    const query = new URLSearchParams({
      bbox: bbox.join(","),
      startDate,
      pageSize: String(pageSize),
      maxPages: String(maxPages),
      sources: (sources || []).join(","),
    });
    if (endDate) {
      query.set("endDate", endDate);
    }
    const requestUrl = `${url}?${query.toString()}`;
    const requestKey = requestUrl;
    const cachedEntry = LAST_RESPONSE_BY_LAYER.get(layerCacheKeyRef.current);
    if (
      cachedEntry &&
      cachedEntry.requestKey === requestKey &&
      cachedEntry.expiresAt > Date.now()
    ) {
      lastBboxRef.current = bboxKey;
      setData(cachedEntry.data);
      setRenderVersion((prev) => prev + 1);
      onDataChangeRef.current?.(cachedEntry.data);
      onLoadingChangeRef.current?.(false);
      return;
    }

    try {
      const response = await fetch(requestUrl, { signal: abortRef.current.signal });
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (text.trim().startsWith("<")) {
        throw new Error("Resposta HTML/XML inesperada do backend MapBiomas.");
      }

      const collection = JSON.parse(text);

      lastBboxRef.current = bboxKey;
      LAST_RESPONSE_BY_LAYER.set(layerCacheKeyRef.current, {
        requestKey,
        expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
        data: collection,
      });
      setData(collection);
      onDataChangeRef.current?.(collection);
      setRenderVersion((prev) => prev + 1);
      onLoadingChangeRef.current?.(false);
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      console.warn("Erro ao carregar alertas do MapBiomas por BBOX:", error);
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
      if (abortRef.current) {
        abortRef.current.abort();
      }
      onLoadingChangeRef.current?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, url, minZoom, startDate, endDate, pageSize, maxPages, sources]);

  if (!visivel || !data) {
    return null;
  }

  return (
    <GeoJSON
      key={`${paneKey}-${renderVersion}`}
      data={data}
      pane={paneName}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}
