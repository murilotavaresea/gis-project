function normalizarValor(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function filtrarFeatureCollection(featureCollection, featureFilter) {
  if (!featureCollection || !featureFilter?.field) {
    return featureCollection;
  }

  const { field, value } = featureFilter;
  const valorEsperado = normalizarValor(value);
  const features = Array.isArray(featureCollection.features)
    ? featureCollection.features
    : [];

  return {
    ...featureCollection,
    features: features.filter((feature) => {
      const valorAtual = feature?.properties?.[field];
      return normalizarValor(valorAtual) === valorEsperado;
    }),
  };
}
