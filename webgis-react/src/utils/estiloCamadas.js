const BASE_STYLE = {
  weight: 1.7,
  opacity: 0.98,
  fillOpacity: 0.18,
  lineCap: "round",
  lineJoin: "round",
};

const SVG_NS = "http://www.w3.org/2000/svg";

function createSvgNode(tagName, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tagName);

  Object.entries(attributes).forEach(([key, value]) => {
    node.setAttribute(key, String(value));
  });

  return node;
}

function criarEstilo({
  color,
  fillColor = color,
  weight = BASE_STYLE.weight,
  fillOpacity = BASE_STYLE.fillOpacity,
  opacity = BASE_STYLE.opacity,
  dashArray,
  fill = true,
  fillPattern = null,
}) {
  return {
    ...BASE_STYLE,
    color,
    fillColor,
    weight,
    opacity,
    fill,
    fillOpacity: fill ? fillOpacity : 0,
    fillPattern,
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
  const saturation = 58 + (hash % 20);
  const lightness = 34 + (hash % 8);
  const fillLightness = Math.min(lightness + 16, 68);
  const weight = 1.45 + ((hash % 4) * 0.14);
  const dashOptions = [undefined, "4 3", "2 5", "7 3"];
  const dashArray = dashOptions[hash % dashOptions.length];

  return criarEstilo({
    color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    fillColor: `hsl(${hue}, ${Math.max(saturation - 6, 46)}%, ${fillLightness}%)`,
    weight,
    fillOpacity: 0.18,
    dashArray,
  });
}

const ZSEE_RONDONIA_STYLES = {
  "ZONA 1.1": "#b8322d",
  "ZONA 1.2": "#f47c22",
  "ZONA 1.3": "#ffe13a",
  "ZONA 1.4": "#f7d82c",
  "ZONA 2.1": "#2797a6",
  "ZONA 2.2": "#2589c8",
  "ZONA 3.1": "#80b957",
  "ZONA 3.2": "#2ca468",
  "ZONA 3.3": "#0d7a43",
};

function criarEstiloZseeRondonia(subzona) {
  const color = ZSEE_RONDONIA_STYLES[String(subzona || "").toUpperCase()];

  if (!color) {
    return null;
  }

  return criarEstilo({
    color,
    fillColor: color,
    weight: 1.25,
    opacity: 0.95,
    fillOpacity: 0.62,
  });
}

function getPatternDefinitions() {
  return {
    "pattern-embargo-ibama": {
      width: 10,
      height: 10,
      nodes: [
        createSvgNode("rect", {
          width: 10,
          height: 10,
          fill: "rgba(255, 166, 138, 0.16)",
        }),
        createSvgNode("path", {
          d: "M-2,10 L10,-2 M0,12 L12,0 M6,12 L12,6",
          stroke: "#ff6b57",
          "stroke-width": 1.6,
          "stroke-linecap": "round",
          opacity: 0.9,
        }),
      ],
    },
    "pattern-prodes-amazonia": {
      width: 12,
      height: 12,
      nodes: [
        createSvgNode("rect", {
          width: 12,
          height: 12,
          fill: "rgba(255, 207, 113, 0.14)",
        }),
        createSvgNode("path", {
          d: "M-2,12 L12,-2 M2,14 L14,2",
          stroke: "#ffb347",
          "stroke-width": 1.4,
          "stroke-linecap": "round",
          opacity: 0.95,
        }),
      ],
    },
    "pattern-prodes-cerrado": {
      width: 12,
      height: 12,
      nodes: [
        createSvgNode("rect", {
          width: 12,
          height: 12,
          fill: "rgba(246, 223, 92, 0.14)",
        }),
        createSvgNode("path", {
          d: "M0,0 L12,12 M-2,6 L6,14 M6,-2 L14,6",
          stroke: "#e4c441",
          "stroke-width": 1.3,
          "stroke-linecap": "round",
          opacity: 0.92,
        }),
      ],
    },
  };
}

function ensureMapPatternDefs(map) {
  const overlayPane = map?.getPanes?.()?.overlayPane;
  const svg = overlayPane?.querySelector?.("svg");

  if (!svg) {
    return null;
  }

  let defs = svg.querySelector("defs[data-webgis-patterns='true']");
  if (!defs) {
    defs = createSvgNode("defs", { "data-webgis-patterns": "true" });
    svg.insertBefore(defs, svg.firstChild);
  }

  const patternDefinitions = getPatternDefinitions();

  Object.entries(patternDefinitions).forEach(([patternId, definition]) => {
    if (defs.querySelector(`#${patternId}`)) {
      return;
    }

    const patternNode = createSvgNode("pattern", {
      id: patternId,
      patternUnits: "userSpaceOnUse",
      width: definition.width,
      height: definition.height,
    });

    definition.nodes.forEach((node) => {
      patternNode.appendChild(node);
    });

    defs.appendChild(patternNode);
  });

  return defs;
}

export function aplicarPadraoCamada(layer, estilo, map) {
  if (!estilo?.fillPattern || !layer?.getElement || !map) {
    return;
  }

  const applyPattern = () => {
    const path = layer.getElement();

    if (!path) {
      return;
    }

    if (!ensureMapPatternDefs(map)) {
      return;
    }

    path.setAttribute("fill", `url(#${estilo.fillPattern})`);
    path.setAttribute("fill-opacity", "1");
  };

  requestAnimationFrame(applyPattern);
  layer.on("add", () => requestAnimationFrame(applyPattern));
}

export function getEstiloCamada(nome = "") {
  const nomeUpper = String(nome).toUpperCase();

  if (nomeUpper.includes("ZSEE")) {
    const subzonaMatch = nomeUpper.match(/ZONA\s+[123]\.[1234]|SUBZONA\s+([123]\.[1234])/);
    const estiloZsee = criarEstiloZseeRondonia(
      subzonaMatch?.[0]?.replace("SUBZONA", "ZONA")
    );

    if (estiloZsee) {
      return estiloZsee;
    }
  }

  if (
    nomeUpper.includes("MALHA MUNICIPAL") ||
    nomeUpper.includes("MUNICIPIO") ||
    nomeUpper.includes("MUNICIPIOS")
  ) {
    return criarEstilo({
      color: "#d5e7ff",
      weight: 1.35,
      opacity: 0.96,
      dashArray: "3 4",
      fill: false,
    });
  }

  if (nomeUpper.includes("EMBARGO") && nomeUpper.includes("IBAMA")) {
    return criarEstilo({
      color: "#ff6b57",
      fillColor: "#ffb09f",
      weight: 1.9,
      fillOpacity: 0.22,
      dashArray: "7 4",
      fillPattern: "pattern-embargo-ibama",
    });
  }

  if (nomeUpper.includes("PRODES") && nomeUpper.includes("AMAZONIA")) {
    return criarEstilo({
      color: "#ffb347",
      fillColor: "#ffd08f",
      weight: 1.85,
      fillOpacity: 0.2,
      dashArray: "6 3",
      fillPattern: "pattern-prodes-amazonia",
    });
  }

  if (nomeUpper.includes("PRODES") && nomeUpper.includes("CERRADO")) {
    return criarEstilo({
      color: "#f2d14e",
      fillColor: "#fff0a6",
      weight: 1.8,
      fillOpacity: 0.2,
      dashArray: "3 4",
      fillPattern: "pattern-prodes-cerrado",
    });
  }

  if (nomeUpper.includes("AREA") && nomeUpper.includes("EMBARGADA") && nomeUpper.includes("ICMBIO")) {
    return criarEstilo({
      color: "#d94841",
      fillColor: "#f29f97",
      weight: 2,
      fillOpacity: 0.2,
      dashArray: "6 4",
    });
  }

  if (nomeUpper.includes("AUTO") && nomeUpper.includes("INFRACAO") && nomeUpper.includes("ICMBIO")) {
    return criarEstilo({
      color: "#d96b00",
      fillColor: "#ffb347",
      weight: 2,
      fillOpacity: 0.24,
    });
  }

  if (nomeUpper.includes("MAPBIOMAS") && nomeUpper.includes("ALERTA")) {
    return criarEstilo({
      color: "#ff4d36",
      fillColor: "#ff9a75",
      weight: 2.3,
      fillOpacity: 0.3,
      opacity: 1,
      dashArray: "6 3",
    });
  }

  if (nomeUpper.includes("MAPBIOMAS")) {
    return criarEstilo({
      color: "#20c997",
      fillColor: "#8ae6cb",
      weight: 1.7,
      fillOpacity: 0.18,
    });
  }

  if (nomeUpper.includes("APF")) {
    return criarEstilo({
      color: "#58a6ff",
      fillColor: "#9fd0ff",
      weight: 1.75,
      fillOpacity: 0.18,
      dashArray: "8 3",
    });
  }

  if (nomeUpper.includes("SITIOS ARQUEOLOGICOS") || nomeUpper.includes("IPHAN")) {
    return criarEstilo({
      color: "#f1a95f",
      fillColor: "#ffd59f",
      weight: 1.6,
      fillOpacity: 0.17,
      dashArray: "2 5",
    });
  }

  if (nomeUpper.includes("ASSENTAMENTO")) {
    return criarEstilo({
      color: "#7ed957",
      fillColor: "#b7f18a",
      weight: 1.75,
      fillOpacity: 0.18,
    });
  }

  if (nomeUpper.includes("QUILOMBOLA")) {
    return criarEstilo({
      color: "#c17aff",
      fillColor: "#e0b6ff",
      weight: 1.7,
      fillOpacity: 0.18,
      dashArray: "4 4",
    });
  }

  if (nomeUpper.includes("TERRAS INDIGENAS")) {
    return criarEstilo({
      color: "#ff5f7a",
      fillColor: "#ffb0c0",
      weight: 1.8,
      fillOpacity: 0.18,
    });
  }

  if (
    nomeUpper.includes("UNIDADE DE CONSERVACAO") ||
    nomeUpper.includes("UNIDADES DE CONSERVACAO")
  ) {
    return criarEstilo({
      color: "#5fda84",
      fillColor: "#a6f0bd",
      weight: 1.7,
      fillOpacity: 0.17,
      dashArray: "8 4",
    });
  }

  if (nomeUpper.includes("FLORESTAS PUBLICAS") || nomeUpper.includes("CNFP")) {
    return criarEstilo({
      color: "#33c46f",
      fillColor: "#9ef0ba",
      weight: 1.65,
      fillOpacity: 0.17,
      dashArray: "3 5",
    });
  }

  return gerarEstiloUnico(nomeUpper);
}

export function getEstiloFeatureCamada(nome = "", feature = null) {
  const nomeUpper = String(nome).toUpperCase();

  if (nomeUpper.includes("ZSEE")) {
    const estiloZsee = criarEstiloZseeRondonia(feature?.properties?.SUBZONA);

    if (estiloZsee) {
      return estiloZsee;
    }
  }

  return getEstiloCamada(nome);
}
