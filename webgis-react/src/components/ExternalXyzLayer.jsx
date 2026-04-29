import { useEffect, useMemo, useRef, useState } from "react";
import { TileLayer, useMap } from "react-leaflet";

function buildPaneName(paneKey) {
  return `external-xyz-${String(paneKey || "default").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function buildXyzProxyUrl(url, proxyBaseUrl) {
  if (!url || !proxyBaseUrl) {
    return url;
  }

  const base = String(url).replace(/\/\{z\}\/\{x\}\/\{y\}\/?$/, "");
  return `${proxyBaseUrl}/{z}/{x}/{y}?base=${encodeURIComponent(base)}`;
}

export default function ExternalXyzLayer({
  url,
  proxyBaseUrl,
  useProxy = true,
  paneKey,
  visivel,
  minZoom = 1,
  maxZoom = 20,
  zIndex = 350,
  opacity = 1,
  options = {},
  onLoadingChange,
}) {
  const map = useMap();
  const [zoomAtual, setZoomAtual] = useState(map.getZoom());
  const pendingTilesRef = useRef(0);
  const onLoadingChangeRef = useRef(onLoadingChange);
  const paneName = useMemo(() => buildPaneName(paneKey || url), [paneKey, url]);
  const tileUrl = useMemo(
    () => (useProxy && proxyBaseUrl ? buildXyzProxyUrl(url, proxyBaseUrl) : url),
    [proxyBaseUrl, url, useProxy]
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

  if (!visivel || zoomAtual < minZoom || !tileUrl) {
    return null;
  }

  return (
    <TileLayer
      key={`${paneName}-${tileUrl}`}
      url={tileUrl}
      pane={paneName}
      zIndex={zIndex}
      opacity={opacity}
      maxZoom={maxZoom}
      crossOrigin
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
      {...options}
    />
  );
}
