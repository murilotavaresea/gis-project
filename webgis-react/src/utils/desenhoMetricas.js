import * as turf from "@turf/turf";

function normalizarFeature(layer) {
  const geojson = layer?.toGeoJSON?.();

  if (!geojson) {
    return null;
  }

  if (geojson.type === "FeatureCollection") {
    return geojson.features?.[0] || null;
  }

  return geojson;
}

function formatarNumero(valor, casas = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor);
}

function formatarArea(areaM2) {
  if (!Number.isFinite(areaM2) || areaM2 <= 0) {
    return null;
  }

  if (areaM2 < 10000) {
    return `${formatarNumero(areaM2, 4)} m2`;
  }

  if (areaM2 < 1000000) {
    return `${formatarNumero(areaM2 / 10000, 4)} ha`;
  }

  return `${formatarNumero(areaM2 / 1000000, 4)} km2`;
}

function formatarDistancia(distanciaKm) {
  if (!Number.isFinite(distanciaKm) || distanciaKm <= 0) {
    return null;
  }

  if (distanciaKm < 1) {
    return `${formatarNumero(distanciaKm * 1000, 0)} m`;
  }

  return `${formatarNumero(distanciaKm, 2)} km`;
}

function formatarCoordenadas(coordinates = []) {
  const [lng, lat] = coordinates;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return `${formatarNumero(lat, 5)}, ${formatarNumero(lng, 5)}`;
}

export function obterResumoDesenho(layer) {
  const feature = normalizarFeature(layer);
  const geometry = feature?.geometry;

  if (!geometry?.type) {
    return null;
  }

  switch (geometry.type) {
    case "Polygon":
    case "MultiPolygon": {
      const areaM2 = turf.area(feature);
      const valor = formatarArea(areaM2);

      return valor ? { rotulo: "Area", valor } : null;
    }
    case "LineString":
    case "MultiLineString": {
      const distanciaKm = turf.length(feature, { units: "kilometers" });
      const valor = formatarDistancia(distanciaKm);

      return valor ? { rotulo: "Extensao", valor } : null;
    }
    case "Point": {
      const valor = formatarCoordenadas(geometry.coordinates);
      return valor ? { rotulo: "Coordenadas", valor } : null;
    }
    case "MultiPoint": {
      const valor = geometry.coordinates?.length
        ? `${geometry.coordinates.length} pontos`
        : null;

      return valor ? { rotulo: "Geometria", valor } : null;
    }
    default:
      return null;
  }
}
