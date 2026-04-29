const CAMPOS_CODIGO_CAR = [
  "recibo",
  "cod_imovel",
  "codImovel",
  "inscricao",
  "inscricaocar",
  "codigo_car",
  "codigo",
];

const ORDEM_TIPOS_CAMADA = {
  area_imovel: 0,
  area_beneficiavel: 1,
  reserva_legal: 2,
  app: 3,
  cobertura_solo: 4,
  servidao_administrativa: 5,
  marcadores_app: 6,
  outro: 99,
};

function gerarIdCamadaImportada() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `camada-importada-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extrairProperties(item) {
  if (!item || typeof item !== "object") {
    return {};
  }

  if (item.properties && typeof item.properties === "object") {
    return item.properties;
  }

  return item;
}

export function normalizarCodigoCAR(valor = "") {
  return String(valor)
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

export function extrairCodigoCAR(item) {
  const props = extrairProperties(item);

  for (const campo of CAMPOS_CODIGO_CAR) {
    const valor = props?.[campo];
    if (!valor) {
      continue;
    }

    const codigo = normalizarCodigoCAR(valor);
    if (codigo) {
      return codigo;
    }
  }

  return "";
}

export function extrairCodigoCARDeGeoJSON(geojson) {
  if (!geojson) {
    return "";
  }

  if (geojson.type === "FeatureCollection") {
    for (const feature of geojson.features || []) {
      const codigo = extrairCodigoCAR(feature);
      if (codigo) {
        return codigo;
      }
    }

    return "";
  }

  if (geojson.type === "Feature") {
    return extrairCodigoCAR(geojson);
  }

  return extrairCodigoCAR(geojson);
}

export function identificarTipoCamadaCAR(nome = "") {
  const valor = String(nome);

  if (valor.includes("Area_Beneficiavel")) {
    return "area_beneficiavel";
  }

  if (valor.includes("Area_do_Imovel")) {
    return "area_imovel";
  }

  if (valor.includes("Reserva_Legal")) {
    return "reserva_legal";
  }

  if (valor.includes("MARCADORES_Area_de_Preservacao_Permanente")) {
    return "marcadores_app";
  }

  if (valor.includes("Area_de_Preservacao_Permanente")) {
    return "app";
  }

  if (valor.includes("Cobertura_do_Solo")) {
    return "cobertura_solo";
  }

  if (valor.includes("Servidao_Administrativa")) {
    return "servidao_administrativa";
  }

  return "outro";
}

export function criarRegistroCamadaImportada({
  id,
  nome,
  layer,
  visivel = true,
  exportavel = false,
  carCodigo = "",
  tipoCamada,
  rotulo,
  origem = "local",
}) {
  return {
    id: id || gerarIdCamadaImportada(),
    nome,
    layer,
    visivel,
    exportavel,
    carCodigo: normalizarCodigoCAR(carCodigo),
    tipoCamada: tipoCamada || identificarTipoCamadaCAR(nome),
    rotulo: rotulo || "",
    origem,
  };
}

export function agruparCamadasImportadasPorCAR(camadasImportadas = []) {
  const grupos = new Map();

  camadasImportadas.forEach((camada, index) => {
    const codigo = normalizarCodigoCAR(camada?.carCodigo);
    const chave = codigo || "sem-codigo";

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        id: chave,
        carCodigo: codigo,
        title: codigo || "Outras importadas",
        camadas: [],
        ordem: index,
      });
    }

    grupos.get(chave).camadas.push(camada);
  });

  return [...grupos.values()]
    .sort((a, b) => a.ordem - b.ordem)
    .map((grupo) => {
      const camadasOrdenadas = [...grupo.camadas].sort((camadaA, camadaB) => {
        const ordemA = ORDEM_TIPOS_CAMADA[camadaA?.tipoCamada] ?? ORDEM_TIPOS_CAMADA.outro;
        const ordemB = ORDEM_TIPOS_CAMADA[camadaB?.tipoCamada] ?? ORDEM_TIPOS_CAMADA.outro;

        if (ordemA !== ordemB) {
          return ordemA - ordemB;
        }

        return String(camadaA?.nome || "").localeCompare(String(camadaB?.nome || ""), "pt-BR");
      });

      return {
        ...grupo,
        camadas: camadasOrdenadas,
        camadaImovel:
          camadasOrdenadas.find((camada) => camada?.tipoCamada === "area_imovel") || null,
      };
    });
}
