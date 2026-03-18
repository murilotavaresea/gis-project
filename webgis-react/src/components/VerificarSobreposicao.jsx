import React from "react";
import * as turf from "@turf/turf";
import gerarRelatorioPDF from "./gerarRelatorioPDF";
import { useMap } from "react-leaflet";
import { filtrarFeatureCollection } from "../utils/filtrarFeatureCollection";
import config from "../config";

const PROXY_WFS_BASE = config.PROXY_WFS_BASE_URL;
const MIN_INTERSECTION_AREA_M2 = 1;

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
      valor === "APF"
  );
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
  bboxParam,
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
    `&bbox=${encodeURIComponent(bboxParam)}` +
    (extras ? `&${extras}` : "")
  );
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

  if (camada.externa) {
    return montarConsultaWfs({
      baseUrl: camada.wfsBaseUrl,
      version: camada.wfsVersion || "2.0.0",
      typeName: camada.typeName || camada.nome,
      bboxParam,
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
    const camadasConsultaveis = (camadas || []).filter((camada) => {
      if (!camada?.nome || deveIgnorarNaSobreposicao(camada)) {
        return false;
      }

      return Boolean(montarUrlConsulta(camada, bbox));
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
