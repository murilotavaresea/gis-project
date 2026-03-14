import { useEffect, useMemo, useState } from "react";
import { WMSTileLayer, useMap } from "react-leaflet";

export default function ExternalWmsLayer({
  url,
  layers,
  visivel,
  minZoom = 7,
  params = {},
}) {
  const map = useMap();
  const [zoomAtual, setZoomAtual] = useState(map.getZoom());
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
    const atualizarZoom = () => setZoomAtual(map.getZoom());

    map.on("zoomend", atualizarZoom);
    return () => {
      map.off("zoomend", atualizarZoom);
    };
  }, [map]);

  if (!visivel || zoomAtual < minZoom) {
    return null;
  }

  return <WMSTileLayer url={url} layers={layers} {...wmsParams} />;
}
