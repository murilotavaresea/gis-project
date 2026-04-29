function normalizarValor(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function converterParaNumeroSePossivel(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function filtrarFeatureCollection(featureCollection, featureFilter) {
  if (!featureCollection || !featureFilter?.field) {
    return featureCollection;
  }

  const { field, value, operator = "eq" } = featureFilter;
  const valorEsperado = normalizarValor(value);
  const numeroEsperado = converterParaNumeroSePossivel(value);
  const features = Array.isArray(featureCollection.features)
    ? featureCollection.features
    : [];

  return {
    ...featureCollection,
    features: features.filter((feature) => {
      const valorAtual = feature?.properties?.[field];
      const numeroAtual = converterParaNumeroSePossivel(valorAtual);

      switch (operator) {
        case "gte":
          if (numeroAtual === null || numeroEsperado === null) {
            return false;
          }
          return numeroAtual >= numeroEsperado;
        case "gt":
          if (numeroAtual === null || numeroEsperado === null) {
            return false;
          }
          return numeroAtual > numeroEsperado;
        case "lte":
          if (numeroAtual === null || numeroEsperado === null) {
            return false;
          }
          return numeroAtual <= numeroEsperado;
        case "lt":
          if (numeroAtual === null || numeroEsperado === null) {
            return false;
          }
          return numeroAtual < numeroEsperado;
        case "neq":
          return normalizarValor(valorAtual) !== valorEsperado;
        case "eq":
        default:
          return normalizarValor(valorAtual) === valorEsperado;
      }
    }),
  };
}
