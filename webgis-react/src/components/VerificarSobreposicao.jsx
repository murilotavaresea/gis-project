import React from "react";
import * as turf from "@turf/turf";
import gerarRelatorioPDF from "./gerarRelatorioPDF";
import { useMap } from "react-leaflet";
import { filtrarFeatureCollection } from "../utils/filtrarFeatureCollection";

const GEOSERVER_BASE = "http://localhost:8080/geoserver/webgis/ows";
const PROXY_WFS_BASE = "http://localhost:5000/proxy/wfs";

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

  const nomeCamada = camada.nome.includes(":") ? camada.nome : `webgis:${camada.nome}`;

  return (
    `${GEOSERVER_BASE}?service=WFS&version=1.1.0&request=GetFeature` +
    `&typeName=${encodeURIComponent(nomeCamada)}` +
    `&bbox=${bbox.join(",")},EPSG:4326` +
    `&outputFormat=application/json`
  );
}

export default function VerificarSobreposicao({
  carLayerBusca,
  camadas,
  onAtualizarMapaRelatorio,
}) {
  const map = useMap();

  const verificar = async () => {
    if (!carLayerBusca || !carLayerBusca.toGeoJSON) {
      alert("Nenhuma geometria do CAR foi carregada. Use o botao 'Buscar CAR'.");
      return;
    }

    const geojson = carLayerBusca.toGeoJSON();
    const features = geojson.type === "FeatureCollection" ? geojson.features : [geojson];

    if (!features.length || !features[0].geometry) {
      alert("Geometria invalida ou ausente no CAR.");
      return;
    }

    const areaFeature = features[0];

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

    for (const camada of camadas) {
      const nomeBase = (camada.nome || "").toUpperCase();
      if (!camada.nome || nomeBase.includes("ESTADOS")) continue;

      const nomeFormatado = formatarNomeCamada(camada);
      const nomeFormatadoUpper = nomeFormatado.toUpperCase();
      const url = montarUrlConsulta(camada, bbox);

      if (!url) {
        continue;
      }

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
          turf.booleanIntersects(areaFeature, feature)
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
        });
      } catch (error) {
        console.warn(`Erro ao buscar ou processar camada ${nomeFormatado}:`, error);
        resultados.push({
          camada: nomeFormatado,
          sobreposicao: false,
        });
      }
    }

    if (onAtualizarMapaRelatorio) {
      onAtualizarMapaRelatorio({
        areaGeoJSON: carLayerBusca.toGeoJSON(),
        overlayLayers: camadasSobrepostasMapa,
      });

      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    await gerarRelatorioPDF({
      codigoCAR: areaFeature.properties?.cod_imovel || "sem_codigo",
      resultados,
      overlayLayers: camadasSobrepostasMapa,
      map,
      areaGeoJSON: carLayerBusca.toGeoJSON(),
    });
  };

  return (
    <button onClick={verificar} title="Verificar sobreposicao com o CAR buscado">
      {"\uD83D\uDCCB"}
    </button>
  );
}
