const BASE_STYLE = {
  weight: 1.35,
  opacity: 0.92,
  fillOpacity: 0.1,
  lineCap: "round",
  lineJoin: "round",
};

function criarEstilo({
  color,
  fillColor = color,
  weight = BASE_STYLE.weight,
  fillOpacity = BASE_STYLE.fillOpacity,
  opacity = BASE_STYLE.opacity,
  dashArray,
  fill = true,
}) {
  return {
    ...BASE_STYLE,
    color,
    fillColor,
    weight,
    opacity,
    fill,
    fillOpacity: fill ? fillOpacity : 0,
    ...(dashArray ? { dashArray } : {}),
  };
}

function hashString(value = "") {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function gerarEstiloUnico(nome) {
  const hash = hashString(nome);
  const hue = hash % 360;
  const saturation = 38 + (hash % 18);
  const lightness = 34 + (hash % 10);
  const fillLightness = Math.min(lightness + 28, 78);
  const weight = 1.1 + ((hash % 4) * 0.12);
  const dashOptions = [undefined, "4 3", "2 5", "7 3"];
  const dashArray = dashOptions[hash % dashOptions.length];

  return criarEstilo({
    color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    fillColor: `hsl(${hue}, ${Math.max(saturation - 8, 28)}%, ${fillLightness}%)`,
    weight,
    fillOpacity: 0.07,
    dashArray,
  });
}

export function getEstiloCamada(nome = "") {
  const nomeUpper = String(nome).toUpperCase();

  if (
    nomeUpper.includes("MALHA MUNICIPAL") ||
    nomeUpper.includes("MUNICIPIO") ||
    nomeUpper.includes("MUNICIPIOS")
  ) {
    return criarEstilo({
      color: "#6b7a8f",
      weight: 1.05,
      opacity: 0.88,
      dashArray: "3 4",
      fill: false,
    });
  }

  if (nomeUpper.includes("EMBARGO") && nomeUpper.includes("IBAMA")) {
    return criarEstilo({
      color: "#a14a3b",
      fillColor: "#d9a79d",
      weight: 1.45,
      fillOpacity: 0.05,
      dashArray: "6 4",
    });
  }

  if (nomeUpper.includes("PRODES") && nomeUpper.includes("AMAZONIA")) {
    return criarEstilo({
      color: "#a65f2a",
      fillColor: "#d8b08c",
      weight: 1.4,
      fillOpacity: 0.08,
      dashArray: "5 3",
    });
  }

  if (nomeUpper.includes("PRODES") && nomeUpper.includes("CERRADO")) {
    return criarEstilo({
      color: "#8f7a2a",
      fillColor: "#d7cb8e",
      weight: 1.3,
      fillOpacity: 0.08,
      dashArray: "2 5",
    });
  }

  if (nomeUpper.includes("MAPBIOMAS")) {
    return criarEstilo({
      color: "#3c8a77",
      fillColor: "#9ecfc0",
      weight: 1.25,
      fillOpacity: 0.08,
    });
  }

  if (nomeUpper.includes("APF")) {
    return criarEstilo({
      color: "#476c9b",
      fillColor: "#a9bddb",
      weight: 1.3,
      fillOpacity: 0.08,
      dashArray: "7 2",
    });
  }

  if (nomeUpper.includes("SITIOS ARQUEOLOGICOS") || nomeUpper.includes("IPHAN")) {
    return criarEstilo({
      color: "#8b6b4b",
      fillColor: "#d9c3a3",
      weight: 1.25,
      fillOpacity: 0.06,
      dashArray: "1 4",
    });
  }

  if (nomeUpper.includes("ASSENTAMENTO")) {
    return criarEstilo({
      color: "#5d8f46",
      fillColor: "#b9d4a7",
      weight: 1.3,
      fillOpacity: 0.08,
    });
  }

  if (nomeUpper.includes("QUILOMBOLA")) {
    return criarEstilo({
      color: "#7a5a8f",
      fillColor: "#c8b7d5",
      weight: 1.3,
      fillOpacity: 0.08,
      dashArray: "4 4",
    });
  }

  if (nomeUpper.includes("TERRAS INDIGENAS")) {
    return criarEstilo({
      color: "#b24c5c",
      fillColor: "#e0a8b1",
      weight: 1.35,
      fillOpacity: 0.08,
    });
  }

  if (
    nomeUpper.includes("UNIDADE DE CONSERVACAO") ||
    nomeUpper.includes("UNIDADES DE CONSERVACAO")
  ) {
    return criarEstilo({
      color: "#4d7d5c",
      fillColor: "#afd0b5",
      weight: 1.28,
      fillOpacity: 0.07,
      dashArray: "8 3",
    });
  }

  if (nomeUpper.includes("FLORESTAS PUBLICAS") || nomeUpper.includes("CNFP")) {
    return criarEstilo({
      color: "#416f52",
      fillColor: "#a9c9af",
      weight: 1.25,
      fillOpacity: 0.07,
      dashArray: "3 5",
    });
  }

  return gerarEstiloUnico(nomeUpper);
}
