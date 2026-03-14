import { useEffect, useRef, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";

export default function ArcgisFeatureLayer({
  baseUrl,
  queryUrl,
  visivel,
  minZoom = 7,
  style,
  onEachFeature,
  queryParams = {},
}) {
  const map = useMap();
  const [data, setData] = useState(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const abortRef = useRef(null);
  const lastEnvelopeRef = useRef("");

  async function fetchByBbox({ force = false } = {}) {
    if (!visivel) return;

    const zoomAtual = map.getZoom();
    if (zoomAtual < minZoom) {
      lastEnvelopeRef.current = "";
      setData(null);
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

    try {
      const res = await fetch(url, { signal: abortRef.current.signal });
      const text = await res.text();

      if (!res.ok) {
        console.warn(`ArcGIS retornou status ${res.status} para ${queryUrl}.`, text.slice(0, 200));
        setData(null);
        return;
      }

      if (text.trim().startsWith("<")) {
        console.warn(`ArcGIS retornou HTML/XML para ${queryUrl}.`, text.slice(0, 200));
        setData(null);
        return;
      }

      const json = JSON.parse(text);

      if (json?.error) {
        console.warn(`ArcGIS retornou erro para ${queryUrl}.`, json.error);
        setData(null);
        return;
      }

      if (json?.properties?.exceededTransferLimit) {
        console.warn(`ArcGIS atingiu limite de transferencia para ${queryUrl}.`);
      }

      lastEnvelopeRef.current = envelopeKey;
      setData(json);
      setRenderVersion((prev) => prev + 1);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn(`Erro ao carregar FeatureServer por BBOX para ${queryUrl}:`, err);
      setData(null);
    }
  }

  useEffect(() => {
    if (!visivel) {
      lastEnvelopeRef.current = "";
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
