import { useEffect, useMemo, useState } from "react";
import { WMSTileLayer, useMap } from "react-leaflet";

const EXTERNAL_WMS_PANE = "external-wms-pane";

export default function ExternalWmsLayer({
  baseUrl,
  url,
  layers,
  visivel,
  minZoom = 7,
  opacity = 1,
  params = {},
}) {
  const map = useMap();
  const [zoomAtual, setZoomAtual] = useState(map.getZoom());
  const useProxy = Boolean(baseUrl && url);
  const tileUrl = useProxy ? `${baseUrl}?base=${encodeURIComponent(url)}` : url;
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
      {...wmsParams}
    />
  );
}
