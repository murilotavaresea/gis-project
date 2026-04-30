import React from "react";
import * as turf from "@turf/turf";
import gerarRelatorioPDF from "./gerarRelatorioPDF";
import { useMap } from "react-leaflet";
import { filtrarFeatureCollection } from "../utils/filtrarFeatureCollection";
import config from "../config";

const PROXY_WFS_BASE = config.PROXY_WFS_BASE_URL;
const MIN_INTERSECTION_AREA_M2 = 1;
const LISTAS_PRODES_MMA = [
  {
    bioma: "Amazonia",
    url: "https://labdez.mma.gov.br/server/rest/services/Hosted/lista_mcr_amazonia_VF/FeatureServer/0/query",
  },
  {
    bioma: "Mata Atlantica",
    url: "https://labdez.mma.gov.br/server/rest/services/Hosted/lista_mcr_mata_atlantica_VF/FeatureServer/0/query",
  },
  {
    bioma: "Cerrado",
    url: "https://labdez.mma.gov.br/server/rest/services/Hosted/lista_mcr_cerrado_VF/FeatureServer/0/query",
  },
  {
    bioma: "Caatinga",
    url: "https://labdez.mma.gov.br/server/rest/services/Hosted/lista_mcr_caatinga_VF/FeatureServer/0/query",
  },
  {
    bioma: "Pantanal",
    url: "https://labdez.mma.gov.br/server/rest/services/Hosted/lista_mcr_pantanal_VF/FeatureServer/0/query",
  },
  {
    bioma: "Pampa",
    url: "https://labdez.mma.gov.br/server/rest/services/Hosted/lista_mcr_pampa_VF/FeatureServer/0/query",
  },
];

const CAMPOS_LISTA_PRODES_MMA = [
  "cod_imovel",
  "uf",
  "municipio",
  "area_total_ha",
  "soma_desmat",
  "dentro_criterio",
  "criterio_aplicado",
  "resultados",
  "sobrep_prodes_2019",
  "sobrep_prodes_2020",
  "sobrep_prodes_2021",
  "sobrep_prodes_2022",
  "sobrep_prodes_2023",
  "sobrep_prodes_2024",
  "sobrep_prodes_2025",
];

function formatarNomeCamada(camada) {
  if (camada?.titulo) {
    return camada.titulo;
  }

  const nome = camada?.nome || "";
  const base = nome.includes(":") ? nome.split(":")[1] : nome;
  const mapa = {
    Area_do_Imovel: "Area do Imovel",
    APP: "Area de Preservacao Permanente",
    Reserva_Legal: "Reserva Legal",
    Cobertura_do_Solo: "Remanescente de Vegetacao",
    Servidao_Administrativa: "Servidao Administrativa",
    Embargos_IBAMA: "Embargos IBAMA",
    APF: "Autorizacao Provisoria de Funcionamento",
    Assentamento: "Assentamento",
    Terras_Indigenas: "Terras Indigenas",
    Unidades_de_Conservacao: "Unidade de Conservacao",
  };
  return mapa[base] || base.replace(/_/g, " ");
}

function deveIgnorarNaSobreposicao(camada) {
  const identificadores = [
    camada?.titulo,
    camada?.nome,
    camada?.typeName,
  ]
    .filter(Boolean)
    .map((valor) => String(valor).toUpperCase());

  return identificadores.some(
    (valor) =>
      valor.includes("MALHA MUNICIPAL") ||
      valor.includes("CGEO:ANDB2022_020302") ||
      valor.includes("MVW_APF_GEOMETRIA_REGULAR") ||
      valor === "APF" ||
      valor.includes("PLANET RONDONIA")
  );
}

function ehCamadaRaster(camada) {
  return camada?.sourceType === "wms" || camada?.sourceType === "xyz";
}

function obterCodigoCAR(feature) {
  const props = feature?.properties || {};
  const candidatos = [
    props.cod_imovel,
    props.codImovel,
    props.inscricao,
    props.inscricaocar,
    props.codigo,
    props.car,
  ];

  return String(candidatos.find(Boolean) || "").trim().toUpperCase();
}

function ehCamadaZseeRondonia(camada) {
  const identificadores = [
    camada?.id,
    camada?.titulo,
    camada?.nome,
    camada?.typeName,
  ]
    .filter(Boolean)
    .map((valor) => String(valor).toUpperCase());

  return identificadores.some(
    (valor) =>
      valor.includes("ZSEE RONDONIA") ||
      valor.includes("ZSEE_2APROX_2005_312_SIRGAS2000_4674")
  );
}

function camadaCompativelComCAR(camada, codigoCAR) {
  if (ehCamadaZseeRondonia(camada)) {
    return codigoCAR.startsWith("RO");
  }

  return true;
}

function montarQueryString(params = {}) {
  return Object.entries(params)
    .filter(([, valor]) => valor !== undefined && valor !== null && valor !== "")
    .map(([chave, valor]) => `${encodeURIComponent(chave)}=${encodeURIComponent(String(valor))}`)
    .join("&");
}

function montarConsultaWfs({
  baseUrl,
  version = "2.0.0",
  typeName,
  bboxParam = null,
  extraParams = {},
}) {
  const typeParam = String(version).startsWith("2.") ? "typenames" : "typeName";
  const extras = montarQueryString(extraParams);

  return (
    `${PROXY_WFS_BASE}?base=${encodeURIComponent(baseUrl)}` +
    `&service=WFS&version=${encodeURIComponent(version)}&request=GetFeature` +
    `&${typeParam}=${encodeURIComponent(typeName)}` +
    `&outputFormat=application/json` +
    `&srsName=EPSG:4326` +
    (bboxParam ? `&bbox=${encodeURIComponent(bboxParam)}` : "") +
    (extras ? `&${extras}` : "")
  );
}

function escaparSqlLiteral(valor = "") {
  return String(valor).replace(/'/g, "''");
}

function formatarNumeroPtBr(valor, casas = 2) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    return null;
  }

  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  });
}

function extrairAtributosArcgis(feature) {
  return feature?.attributes || feature?.properties || feature || {};
}

function montarUrlConsultaListaProdesMma(lista, codigoCAR) {
  const query = montarQueryString({
    base: lista.url,
    where: `cod_imovel='${escaparSqlLiteral(codigoCAR)}'`,
    outFields: CAMPOS_LISTA_PRODES_MMA.join(","),
    returnGeometry: "false",
    resultRecordCount: 5,
    f: "json",
  });

  return `${PROXY_WFS_BASE}?${query}`;
}

function resumirRegistroProdesMma(bioma, atributos) {
  const anosComSobreposicao = CAMPOS_LISTA_PRODES_MMA
    .filter((campo) => campo.startsWith("sobrep_prodes_"))
    .map((campo) => ({
      ano: campo.replace("sobrep_prodes_", ""),
      area: Number(atributos?.[campo] || 0),
    }))
    .filter((item) => Number.isFinite(item.area) && item.area > 0)
    .map((item) => {
      const area = formatarNumeroPtBr(item.area);
      return area ? `${item.ano}: ${area}` : item.ano;
    });

  const detalhes = [
    bioma,
    atributos?.municipio ? `Municipio: ${atributos.municipio}` : null,
    atributos?.uf ? `UF: ${atributos.uf}` : null,
    atributos?.resultados ? `Resultado: ${atributos.resultados}` : null,
    atributos?.dentro_criterio ? `Dentro do criterio: ${atributos.dentro_criterio}` : null,
    atributos?.criterio_aplicado ? `Criterio: ${atributos.criterio_aplicado}` : null,
    formatarNumeroPtBr(atributos?.soma_desmat)
      ? `Soma desmat.: ${formatarNumeroPtBr(atributos.soma_desmat)} ha`
      : null,
    anosComSobreposicao.length ? `PRODES por ano: ${anosComSobreposicao.join(", ")}` : null,
  ].filter(Boolean);

  return detalhes.join(" | ");
}

async function consultarListasProdesMma(codigoCAR) {
  if (!codigoCAR) {
    return {
      camada: "Listas PRODES MMA (MCR)",
      sobreposicao: false,
      erroConsulta: true,
      statusTexto: "Nao verificada",
      detalhes: ["Codigo CAR indisponivel para consulta nas listas MCR/PRODES MMA."],
    };
  }

  const encontrados = [];
  const falhas = [];

  await Promise.all(
    LISTAS_PRODES_MMA.map(async (lista) => {
      try {
        const res = await fetch(montarUrlConsultaListaProdesMma(lista, codigoCAR));
        const text = await res.text();

        if (!res.ok || text.trim().startsWith("<")) {
          throw new Error(`Resposta invalida para ${lista.bioma}`);
        }

        const data = JSON.parse(text);
        const features = Array.isArray(data?.features) ? data.features : [];

        features.forEach((feature) => {
          encontrados.push({
            bioma: lista.bioma,
            atributos: extrairAtributosArcgis(feature),
          });
        });
      } catch (error) {
        console.warn(`Erro ao consultar lista PRODES MMA - ${lista.bioma}:`, error);
        falhas.push(lista.bioma);
      }
    })
  );

  if (encontrados.length) {
    return {
      camada: "Listas PRODES MMA (MCR)",
      sobreposicao: true,
      erroConsulta: false,
      statusTexto: "Consta",
      detalhes: encontrados.map((item) => resumirRegistroProdesMma(item.bioma, item.atributos)),
    };
  }

  return {
    camada: "Listas PRODES MMA (MCR)",
    sobreposicao: false,
    erroConsulta: falhas.length === LISTAS_PRODES_MMA.length,
    statusTexto: falhas.length ? "Parcial" : "Nao consta",
    detalhes: falhas.length
      ? [`CAR nao localizado nas listas consultadas. Falha em: ${falhas.join(", ")}.`]
      : ["CAR nao localizado nas listas MCR/PRODES MMA dos biomas consultados."],
  };
}

function montarUrlConsulta(camada, bbox) {
  const bboxCoords =
    camada.bboxAxisOrder === "latlon"
      ? [bbox[1], bbox[0], bbox[3], bbox[2]]
      : bbox;
  const bboxParam = `${bboxCoords.join(",")},EPSG:4326`;

  if (camada.externa && camada.sourceType === "arcgis-feature") {
    const envelope = {
      xmin: bbox[0],
      ymin: bbox[1],
      xmax: bbox[2],
      ymax: bbox[3],
      spatialReference: { wkid: 4326 },
    };
    const extras = montarQueryString({
      where: camada.arcgisParams?.where || "1=1",
      returnGeometry: "true",
      outFields: "*",
      f: "geojson",
      geometryType: "esriGeometryEnvelope",
      geometry: JSON.stringify(envelope),
      inSR: 4326,
      outSR: 4326,
      spatialRel: "esriSpatialRelIntersects",
      ...(camada.arcgisParams ?? {}),
    });

    return `${PROXY_WFS_BASE}?base=${encodeURIComponent(camada.arcgisQueryUrl)}&${extras}`;
  }

  if (camada.externa && camada.sourceType === "wms") {
    return null;
  }

  if (camada.externa && camada.sourceType === "mapbiomas-alerta") {
    return (
      `${config.MAPBIOMAS_ALERTA_PROXY_URL}?bbox=${encodeURIComponent(bbox.join(","))}` +
      `&startDate=${encodeURIComponent(camada.mapbiomasStartDate || "2019-01-01")}` +
      `&pageSize=${encodeURIComponent(String(camada.mapbiomasPageSize || 100))}` +
      `&maxPages=${encodeURIComponent(String(camada.mapbiomasMaxPages || 3))}` +
      `&sources=${encodeURIComponent((camada.mapbiomasSources || ["All"]).join(","))}` +
      (camada.mapbiomasEndDate
        ? `&endDate=${encodeURIComponent(camada.mapbiomasEndDate)}`
        : "")
    );
  }

  if (camada.externa) {
    return montarConsultaWfs({
      baseUrl: camada.wfsBaseUrl,
      version: camada.wfsVersion || "2.0.0",
      typeName: camada.typeName || camada.nome,
      bboxParam: camada.useBbox === false ? null : bboxParam,
      extraParams: camada.wfsParams,
    });
  }

  return null;
}

function isPolygonalGeometry(feature) {
  const geometryType = feature?.geometry?.type || "";
  return geometryType === "Polygon" || geometryType === "MultiPolygon";
}

function normalizarAreaAnalise(geojson) {
  const features = geojson?.type === "FeatureCollection" ? geojson.features : [geojson];
  const featuresValidas = (features || []).filter((feature) => feature?.geometry);

  if (!featuresValidas.length) {
    return null;
  }

  if (featuresValidas.length === 1) {
    return featuresValidas[0];
  }

  const colecao = turf.featureCollection(featuresValidas);
  const uniao = turf.union(colecao);

  if (uniao?.geometry) {
    return {
      ...uniao,
      properties: {
        ...(featuresValidas[0]?.properties || {}),
      },
    };
  }

  return featuresValidas[0];
}

function possuiSobreposicaoReal(areaFeature, feature) {
  if (!areaFeature?.geometry || !feature?.geometry) {
    return false;
  }

  const areaPoligonal = isPolygonalGeometry(areaFeature);
  const featurePoligonal = isPolygonalGeometry(feature);

  if (areaPoligonal && featurePoligonal) {
    try {
      const intersecao = turf.intersect(
        turf.featureCollection([areaFeature, feature])
      );

      if (!intersecao?.geometry) {
        return false;
      }

      return turf.area(intersecao) > MIN_INTERSECTION_AREA_M2;
    } catch (error) {
      console.warn("Falha ao calcular area de intersecao; usando intersects como fallback.", error);
    }
  }

  return turf.booleanIntersects(areaFeature, feature);
}

function normalizarSubzonaZsee(valor) {
  const texto = String(valor || "").trim().toUpperCase();

  if (!texto) {
    return null;
  }

  const match = texto.match(/(?:ZONA|SUBZONA)\s*([0-9.]+)/);
  return match ? `ZONA ${match[1]}` : texto;
}

function ehCamadaProdes(camada) {
  const identificadores = [
    camada?.titulo,
    camada?.nome,
    camada?.typeName,
    camada?.subgrupoExterno,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  return identificadores.includes("PRODES");
}

function extrairAnoProdes(feature) {
  const props = feature?.properties || {};
  const candidatos = [
    props.year,
    props.YEAR,
    props.ano,
    props.ANO,
    props.anodetec,
    props.ANODETEC,
    props.year_deforestation,
    props.YEAR_DEFORESTATION,
  ];

  for (const valor of candidatos) {
    const texto = String(valor ?? "").trim();
    const match = texto.match(/\b(19|20)\d{2}\b/);

    if (match) {
      return match[0];
    }
  }

  return null;
}

function obterDetalhesSobreposicao(camada, featuresSobrepostas = []) {
  const identificador = [
    camada?.titulo,
    camada?.nome,
    camada?.typeName,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (!identificador.includes("ZSEE")) {
    if (!ehCamadaProdes(camada)) {
      return [];
    }

    const anos = [
      ...new Set(
        featuresSobrepostas
          .map((feature) => extrairAnoProdes(feature))
          .filter(Boolean)
      ),
    ].sort((a, b) => Number(a) - Number(b));

    return anos.length ? [`Ano(s) PRODES incidente(s): ${anos.join(", ")}`] : [];
  }

  const subzonas = [
    ...new Set(
      featuresSobrepostas
        .map((feature) => normalizarSubzonaZsee(feature?.properties?.SUBZONA))
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  if (!subzonas.length) {
    return [];
  }

  return [`Subzona incidente: ${subzonas.join(", ")}`];
}

export default function VerificarSobreposicao({
  carLayerBusca,
  camadas,
  onPrepararMapaRelatorio,
  onLimparMapaRelatorio,
  showProcessingOverlay,
  hideProcessingOverlay,
}) {
  const map = useMap();
  const iconStyle = { width: "22px", height: "22px" };

  const verificar = async () => {
    if (!carLayerBusca || !carLayerBusca.toGeoJSON) {
      alert("Nenhuma geometria do CAR foi carregada. Use o botao 'Buscar CAR'.");
      return;
    }

    const geojson = carLayerBusca.toGeoJSON();
    const areaFeature = normalizarAreaAnalise(geojson);

    if (!areaFeature?.geometry) {
      alert("Geometria invalida ou ausente no CAR.");
      return;
    }

    let buffer;
    try {
      buffer = turf.buffer(areaFeature, 1, { units: "kilometers" });
    } catch (error) {
      console.error("Erro ao gerar buffer para bbox:", error);
      alert("Erro ao processar geometria do CAR.");
      return;
    }

    const bbox = turf.bbox(buffer);
    const resultados = [];
    const camadasSobrepostasMapa = [];
    const codigoCAR = obterCodigoCAR(areaFeature);
    const camadasConsultaveis = (camadas || []).filter((camada) => {
      if (
        !camada?.nome ||
        deveIgnorarNaSobreposicao(camada) ||
        ehCamadaRaster(camada)
      ) {
        return false;
      }

      return camadaCompativelComCAR(camada, codigoCAR) && Boolean(montarUrlConsulta(camada, bbox));
    });
    const totalCamadas = camadasConsultaveis.length;

    try {
      showProcessingOverlay?.({
        title: "Gerando relatorio",
        message: "Consultando as camadas disponiveis para verificar sobreposicoes.",
      });

      for (let index = 0; index < camadasConsultaveis.length; index += 1) {
        const camada = camadasConsultaveis[index];
        const nomeFormatado = formatarNomeCamada(camada);
        const nomeFormatadoUpper = nomeFormatado.toUpperCase();
        const url = montarUrlConsulta(camada, bbox);

        if (!url) {
          continue;
        }

        showProcessingOverlay?.({
          title: "Gerando relatorio",
          message: `Consultando camada ${index + 1} de ${totalCamadas}: ${nomeFormatado}.`,
        });

        try {
          const res = await fetch(url);
          const text = await res.text();

          if (!res.ok || text.trim().startsWith("<")) {
            throw new Error(`Resposta invalida para ${nomeFormatado}`);
          }

          const data = filtrarFeatureCollection(
            JSON.parse(text),
            camada.featureFilter
          );

          const featuresSobrepostas = (data.features || []).filter((feature) =>
            possuiSobreposicaoReal(areaFeature, feature)
          );
          const intersecta = featuresSobrepostas.length > 0;

          if (intersecta) {
            if (
              !nomeFormatadoUpper.includes("MUNICIPIO") &&
              !nomeFormatadoUpper.includes("MUNICIPIOS") &&
              !nomeFormatadoUpper.includes("MALHA MUNICIPAL")
            ) {
              camadasSobrepostasMapa.push({
                nome: nomeFormatado,
                geojson: {
                  type: "FeatureCollection",
                  features: featuresSobrepostas,
                },
              });
            }
          }

          resultados.push({
            camada: nomeFormatado,
            sobreposicao: !!intersecta,
            erroConsulta: false,
            detalhes: intersecta
              ? obterDetalhesSobreposicao(camada, featuresSobrepostas)
              : [],
          });
        } catch (error) {
          console.warn(`Erro ao buscar ou processar camada ${nomeFormatado}:`, error);
          resultados.push({
            camada: nomeFormatado,
            sobreposicao: false,
            erroConsulta: true,
          });
        }
      }

      showProcessingOverlay?.({
        title: "Gerando relatorio",
        message: "Consultando as listas MCR/PRODES MMA pelo codigo do CAR.",
      });
      resultados.push(await consultarListasProdesMma(codigoCAR));

      if (onPrepararMapaRelatorio) {
        await onPrepararMapaRelatorio({
          areaGeoJSON: areaFeature,
          overlayLayers: camadasSobrepostasMapa,
        });
      }

      showProcessingOverlay?.({
        title: "Gerando relatorio",
        message: "Montando o PDF final com o mapa e os resultados encontrados.",
      });

      await gerarRelatorioPDF({
        codigoCAR: areaFeature.properties?.cod_imovel || "sem_codigo",
        resultados,
        overlayLayers: camadasSobrepostasMapa,
        map,
        areaGeoJSON: areaFeature,
      });
    } finally {
      onLimparMapaRelatorio?.();
      hideProcessingOverlay?.();
    }
  };

  return (
    <button onClick={verificar} title="Verificar sobreposicao com o CAR buscado">
      <img src="/icons/clipboard-minus.svg" alt="Verificar sobreposição" style={iconStyle} />
    </button>
  );
}
