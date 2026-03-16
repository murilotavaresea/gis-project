import tokml from "tokml";

function normalizarNomeArquivo(nome = "camada") {
  return String(nome)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export default function exportarLayerComoKml(layer, nomeArquivo = "camada") {
  if (!layer?.toGeoJSON) {
    return;
  }

  const geojson = layer.toGeoJSON();
  const kml = tokml(geojson);
  const blob = new Blob([kml], {
    type: "application/vnd.google-earth.kml+xml",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${normalizarNomeArquivo(nomeArquivo)}.kml`;
  link.click();

  URL.revokeObjectURL(url);
}
