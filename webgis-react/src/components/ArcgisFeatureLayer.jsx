import { useEffect, useRef, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";

const RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const LAST_RESPONSE_BY_LAYER = new Map();

export default function ArcgisFeatureLayer({
  baseUrl,
  queryUrl,
  visivel,
  minZoom = 7,
  style,
  onEachFeature,
  queryParams = {},
  onLoadingChange,
}) {
  const map = useMap();
  const [data, setData] = useState(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const abortRef = useRef(null);
  const lastEnvelopeRef = useRef("");
  const onLoadingChangeRef = useRef(onLoadingChange);
  const layerCacheKeyRef = useRef(JSON.stringify({ baseUrl, queryUrl }));

  useEffect(() => {
    onLoadingChangeRef.current = onLoadingChange;
  }, [onLoadingChange]);

  useEffect(() => {
    layerCacheKeyRef.current = JSON.stringify({ baseUrl, queryUrl });
  }, [baseUrl, queryUrl]);

  async function fetchByBbox({ force = false } = {}) {
    if (!visivel) return;

    const zoomAtual = map.getZoom();
    if (zoomAtual < minZoom) {
      lastEnvelopeRef.current = "";
      setData(null);
      onLoadingChangeRef.current?.(false);
      return;
    }

    const bounds = map.getBounds().pad(0.2);
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const envelope = {
      xmin: sw.lng,
      ymin: sw.lat,
      xmax: ne.lng,
      ymax: ne.lat,
      spatialReference: { wkid: 4326 },
    };
    const envelopeKey = JSON.stringify(envelope);

    if (!force && envelopeKey === lastEnvelopeRef.current) {
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    onLoadingChangeRef.current?.(true);

    const where = queryParams.where || "1=1";

    const query = new URLSearchParams({
      base: queryUrl,
      where,
      returnGeometry: "true",
      outFields: "*",
      f: "geojson",
      geometryType: "esriGeometryEnvelope",
      geometry: JSON.stringify(envelope),
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
    });

    Object.entries(queryParams).forEach(([key, value]) => {
      if (key === "where") {
        return;
      }
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    });

    const url = `${baseUrl}?${query.toString()}`;
    const cachedEntry = LAST_RESPONSE_BY_LAYER.get(layerCacheKeyRef.current);
    if (cachedEntry && cachedEntry.requestKey === url && cachedEntry.expiresAt > Date.now()) {
      lastEnvelopeRef.current = envelopeKey;
      setData(cachedEntry.data);
      setRenderVersion((prev) => prev + 1);
      onLoadingChangeRef.current?.(false);
      return;
    }

    try {
      const res = await fetch(url, { signal: abortRef.current.signal });
      const text = await res.text();

      if (!res.ok) {
        console.warn(`ArcGIS retornou status ${res.status} para ${queryUrl}.`, text.slice(0, 200));
        setData(null);
        onLoadingChangeRef.current?.(false);
        return;
      }

      if (text.trim().startsWith("<")) {
        console.warn(`ArcGIS retornou HTML/XML para ${queryUrl}.`, text.slice(0, 200));
        setData(null);
        onLoadingChangeRef.current?.(false);
        return;
      }

      const json = JSON.parse(text);

      if (json?.error) {
        console.warn(`ArcGIS retornou erro para ${queryUrl}.`, json.error);
        setData(null);
        onLoadingChangeRef.current?.(false);
        return;
      }

      if (json?.properties?.exceededTransferLimit) {
        console.warn(`ArcGIS atingiu limite de transferencia para ${queryUrl}.`);
      }

      lastEnvelopeRef.current = envelopeKey;
      LAST_RESPONSE_BY_LAYER.set(layerCacheKeyRef.current, {
        requestKey: url,
        expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
        data: json,
      });
      setData(json);
      setRenderVersion((prev) => prev + 1);
      onLoadingChangeRef.current?.(false);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn(`Erro ao carregar FeatureServer por BBOX para ${queryUrl}:`, err);
      setData(null);
      onLoadingChangeRef.current?.(false);
    }
  }

  useEffect(() => {
    if (!visivel) {
      lastEnvelopeRef.current = "";
      setData(null);
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
  }, [visivel, queryUrl, baseUrl, minZoom, queryParams]);

  if (!visivel || !data) return null;

  return (
    <GeoJSON
      key={`${queryUrl}-${renderVersion}`}
      data={data}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}
