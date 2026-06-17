import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";

function buildPaneName(paneKey) {
  return `external-static-${String(paneKey || "default").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export default function StaticGeoJsonLayer({
  url,
  paneKey,
  visivel,
  minZoom = 6,
  zIndex = 410,
  style,
  pointToLayer,
  onEachFeature,
  onLoadingChange,
  onDataChange,
}) {
  const map = useMap();
  const [data, setData] = useState(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const [zoom, setZoom] = useState(() => map.getZoom());
  const fetchedRef = useRef(false);
  const onLoadingChangeRef = useRef(onLoadingChange);
  const onDataChangeRef = useRef(onDataChange);
  const paneName = useMemo(() => buildPaneName(paneKey || url), [paneKey, url]);

  useEffect(() => { onLoadingChangeRef.current = onLoadingChange; }, [onLoadingChange]);
  useEffect(() => { onDataChangeRef.current = onDataChange; }, [onDataChange]);

  useEffect(() => {
    let pane = map.getPane(paneName);
    if (!pane) pane = map.createPane(paneName);
    pane.style.zIndex = String(zIndex);
    pane.style.pointerEvents = "auto";
  }, [map, paneName, zIndex]);

  useEffect(() => {
    const onZoomEnd = () => setZoom(map.getZoom());
    map.on("zoomend", onZoomEnd);
    return () => { map.off("zoomend", onZoomEnd); };
  }, [map]);

  useEffect(() => {
    if (!visivel || fetchedRef.current) return;
    fetchedRef.current = true;
    onLoadingChangeRef.current?.(true);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setRenderVersion((v) => v + 1);
        onDataChangeRef.current?.(json);
        onLoadingChangeRef.current?.(false);
      })
      .catch((err) => {
        console.warn(`Erro ao carregar camada estatica ${url}:`, err);
        onLoadingChangeRef.current?.(false);
      });
  }, [visivel, url]);

  if (!visivel || !data || zoom < minZoom) return null;

  return (
    <GeoJSON
      key={`static-${url}-${renderVersion}`}
      data={data}
      pane={paneName}
      style={style}
      pointToLayer={pointToLayer}
      onEachFeature={onEachFeature}
    />
  );
}
