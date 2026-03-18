import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { WMSTileLayer, useMap } from "react-leaflet";

const WMS_CRS_BY_CODE = {
  "EPSG:3857": L.CRS.EPSG3857,
  "EPSG:900913": L.CRS.EPSG3857,
  "EPSG:4326": L.CRS.EPSG4326,
};

function buildPaneName(paneKey) {
  return `external-wms-${String(paneKey || "default").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export default function ExternalWmsLayer({
  baseUrl,
  url,
  layers,
  crsCode,
  paneKey,
  useProxy = true,
  visivel,
  minZoom = 7,
  zIndex = 350,
  opacity = 1,
  params = {},
  onLoadingChange,
}) {
  const map = useMap();
  const [zoomAtual, setZoomAtual] = useState(map.getZoom());
  const pendingTilesRef = useRef(0);
  const onLoadingChangeRef = useRef(onLoadingChange);
  const shouldUseProxy = Boolean(useProxy && baseUrl && url);
  const tileUrl = shouldUseProxy ? `${baseUrl}?base=${encodeURIComponent(url)}` : url;
  const wmsCrs = useMemo(() => WMS_CRS_BY_CODE[crsCode] ?? undefined, [crsCode]);
  const paneName = useMemo(() => buildPaneName(paneKey || layers), [paneKey, layers]);
  const wmsParams = useMemo(
    () => ({
      version: "1.1.1",
      format: "image/png",
      transparent: true,
      ...params,
    }),
    [params]
  );

  useEffect(() => {
    onLoadingChangeRef.current = onLoadingChange;
  }, [onLoadingChange]);

  useEffect(() => {
    let pane = map.getPane(paneName);

    if (!pane) {
      pane = map.createPane(paneName);
    }

    pane.style.zIndex = String(zIndex);
    pane.style.pointerEvents = "none";
  }, [map, paneName, zIndex]);

  useEffect(() => {
    const atualizarZoom = () => setZoomAtual(map.getZoom());

    map.on("zoomend", atualizarZoom);
    return () => {
      map.off("zoomend", atualizarZoom);
    };
  }, [map]);

  useEffect(() => {
    if (!visivel || zoomAtual < minZoom) {
      pendingTilesRef.current = 0;
      onLoadingChangeRef.current?.(false);
    }
  }, [visivel, zoomAtual, minZoom]);

  if (!visivel || zoomAtual < minZoom) {
    return null;
  }

  return (
    <WMSTileLayer
      url={tileUrl}
      layers={layers}
      pane={paneName}
      zIndex={zIndex}
      opacity={opacity}
      crs={wmsCrs}
      eventHandlers={{
        loading: () => {
          onLoadingChangeRef.current?.(true);
        },
        tileloadstart: () => {
          pendingTilesRef.current += 1;
          onLoadingChangeRef.current?.(true);
        },
        tileload: () => {
          pendingTilesRef.current = Math.max(0, pendingTilesRef.current - 1);
          if (pendingTilesRef.current === 0) {
            onLoadingChangeRef.current?.(false);
          }
        },
        tileerror: () => {
          pendingTilesRef.current = Math.max(0, pendingTilesRef.current - 1);
          if (pendingTilesRef.current === 0) {
            onLoadingChangeRef.current?.(false);
          }
        },
        load: () => {
          pendingTilesRef.current = 0;
          onLoadingChangeRef.current?.(false);
        },
      }}
      {...wmsParams}
    />
  );
}
