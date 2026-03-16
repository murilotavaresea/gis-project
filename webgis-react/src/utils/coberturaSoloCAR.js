function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isTemaRemanescenteVegetacaoNativa(tema) {
  return normalizarTexto(tema).includes("remanescente");
}

export function filtrarCoberturaSoloParaRemanescente(featureCollection) {
  if (!featureCollection || !Array.isArray(featureCollection.features)) {
    return featureCollection;
  }

  return {
    ...featureCollection,
    features: featureCollection.features.filter((feature) =>
      isTemaRemanescenteVegetacaoNativa(feature?.properties?.tema)
    ),
  };
}
