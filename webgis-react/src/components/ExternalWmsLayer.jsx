import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { WMSTileLayer, useMap } from "react-leaflet";

const EXTERNAL_WMS_PANE = "external-wms-pane";
const WMS_CRS_BY_CODE = {
  "EPSG:3857": L.CRS.EPSG3857,
  "EPSG:900913": L.CRS.EPSG3857,
  "EPSG:4326": L.CRS.EPSG4326,
};

export default function ExternalWmsLayer({
  baseUrl,
  url,
  layers,
  crsCode,
  useProxy = true,
  visivel,
  minZoom = 7,
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
    let pane = map.getPane(EXTERNAL_WMS_PANE);

    if (!pane) {
      pane = map.createPane(EXTERNAL_WMS_PANE);
    }

    pane.style.zIndex = "350";
    pane.style.pointerEvents = "none";
  }, [map]);

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
      pane={EXTERNAL_WMS_PANE}
      zIndex={350}
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
