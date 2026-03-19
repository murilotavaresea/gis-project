import { useEffect, useMemo } from "react";
import L from "leaflet";
import config from "../config";
import {
  buildExternalRequestUrl,
  canUseProxy,
} from "../utils/externalSourceUtils";

const WMS_CRS_BY_CODE = {
  "EPSG:3857": L.CRS.EPSG3857,
  "EPSG:900913": L.CRS.EPSG3857,
  "EPSG:4326": L.CRS.EPSG4326,
};

function obterEstiloAreaReferencia() {
  return {
    color: "#8f0aa8",
    weight: 2.6,
    opacity: 0.96,
    fillColor: "#c026d3",
    fillOpacity: 0.08,
  };
}

function criarCamadaRaster(layer) {
  if (!layer) {
    return null;
  }

  if (layer.sourceType === "wms" && layer.wmsBaseUrl) {
    const shouldUseProxy = canUseProxy(layer.useProxy, `${config.API_BASE_URL}/proxy/wms`);
    const rasterUrl = buildExternalRequestUrl({
      targetUrl: layer.wmsBaseUrl,
      proxyBaseUrl: `${config.API_BASE_URL}/proxy/wms`,
      useProxy: shouldUseProxy,
    });

    return L.tileLayer.wms(rasterUrl, {
      layers: layer.wmsLayers || layer.typeName || layer.nome,
      version: "1.1.1",
      format: "image/png",
      transparent: true,
      opacity: layer.opacity ?? 1,
      updateWhenIdle: true,
      ...(layer.wmsParams || {}),
      crs: WMS_CRS_BY_CODE[layer.wmsCrs] || undefined,
    });
  }

  const xyzUrl = layer.xyzUrl || layer.tileUrlTemplate || layer.urlTemplate;
  if (layer.sourceType === "xyz" && xyzUrl) {
    return L.tileLayer(xyzUrl, {
      opacity: layer.opacity ?? 1,
      crossOrigin: true,
      updateWhenIdle: true,
      ...(layer.xyzOptions || {}),
    });
  }

  return null;
}

export default function MapaRelatorioTemporal({
  geojson,
  layer,
  onReady,
}) {
  const mapaId = useMemo(() => "mapa-temporal-pdf", []);

  useEffect(() => {
    const container = document.getElementById(mapaId);
    if (!container || !geojson || !layer) {
      return undefined;
    }

    container.innerHTML = "";

    const map = L.map(container, {
      attributionControl: false,
      zoomControl: false,
      center: [0, 0],
      zoom: 15,
      minZoom: 1,
      maxZoom: 19,
      inertia: false,
      preferCanvas: true,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
    });

    const rasterLayer = criarCamadaRaster(layer);
    const areaLayer = L.geoJSON(geojson, {
      style: obterEstiloAreaReferencia,
    }).addTo(map);

    const boundsArea = areaLayer.getBounds();
    let readyNotified = false;
    let fallbackTimeout = null;
    let pendingTiles = 0;
    let sawTileRequest = false;
    let settleTimeout = null;
    let fitCompleted = !boundsArea.isValid();
    let fitGuardTimeout = null;

    const finalizarRender = () => {
      if (readyNotified) {
        return;
      }

      readyNotified = true;
      if (fallbackTimeout) {
        window.clearTimeout(fallbackTimeout);
      }

      window.setTimeout(() => {
        onReady?.();
      }, 180);
    };

    const scheduleFinalize = (delayMs = 420) => {
      if (readyNotified) {
        return;
      }

      if (settleTimeout) {
        window.clearTimeout(settleTimeout);
      }

      settleTimeout = window.setTimeout(() => {
        const layerStillLoading =
          typeof rasterLayer?.isLoading === "function" ? rasterLayer.isLoading() : false;

        if (fitCompleted && pendingTiles === 0 && !layerStillLoading) {
          finalizarRender();
        }
      }, delayMs);
    };

    const handleTileLoadStart = () => {
      sawTileRequest = true;
      pendingTiles += 1;
      if (settleTimeout) {
        window.clearTimeout(settleTimeout);
        settleTimeout = null;
      }
    };

    const handleTileDone = () => {
      pendingTiles = Math.max(0, pendingTiles - 1);

      if (pendingTiles === 0) {
        scheduleFinalize();
      }
    };

    const handleTileError = () => {
      handleTileDone();
    };

    const handleLayerLoad = () => {
      if (!sawTileRequest || pendingTiles === 0) {
        scheduleFinalize(1100);
      }
    };

    const handleViewSettled = () => {
      fitCompleted = true;
      scheduleFinalize(1100);
    };

    if (rasterLayer) {
      rasterLayer.addTo(map);
      areaLayer.bringToFront();
      rasterLayer.on("tileloadstart", handleTileLoadStart);
      rasterLayer.on("tileload", handleTileDone);
      rasterLayer.on("tileerror", handleTileError);
      rasterLayer.on("load", handleLayerLoad);
    } else {
      container.style.background =
        "linear-gradient(180deg, rgba(240,244,242,1) 0%, rgba(222,232,227,1) 100%)";
    }

    if (boundsArea.isValid()) {
      map.whenReady(() => {
        map.invalidateSize(false);
        map.once("moveend", handleViewSettled);
        map.fitBounds(boundsArea.pad(0.04), {
          paddingTopLeft: [10, 10],
          paddingBottomRight: [10, 10],
          maxZoom: 18,
        });

        fitGuardTimeout = window.setTimeout(() => {
          if (!fitCompleted) {
            handleViewSettled();
          }
        }, 2500);
      });
    }

    fallbackTimeout = window.setTimeout(() => {
      const layerStillLoading =
        typeof rasterLayer?.isLoading === "function" ? rasterLayer.isLoading() : false;

      if (!readyNotified && fitCompleted && pendingTiles === 0 && !layerStillLoading) {
        finalizarRender();
      }
    }, 12000);

    map.whenReady(() => {
      if (!rasterLayer) {
        finalizarRender();
      }
    });

    return () => {
      if (fallbackTimeout) {
        window.clearTimeout(fallbackTimeout);
      }
      if (fitGuardTimeout) {
        window.clearTimeout(fitGuardTimeout);
      }
      if (settleTimeout) {
        window.clearTimeout(settleTimeout);
      }
      if (rasterLayer) {
        rasterLayer.off("tileloadstart", handleTileLoadStart);
        rasterLayer.off("tileload", handleTileDone);
        rasterLayer.off("tileerror", handleTileError);
        rasterLayer.off("load", handleLayerLoad);
      }
      map.off("moveend", handleViewSettled);
      map.remove();
    };
  }, [geojson, layer, mapaId, onReady]);

  return (
    <div
      id={mapaId}
      style={{
        width: "540px",
        height: "340px",
        position: "absolute",
        top: "-10000px",
        left: "-10000px",
        zIndex: -1,
        pointerEvents: "none",
        overflow: "hidden",
        background: "#e7efeb",
      }}
    />
  );
}
