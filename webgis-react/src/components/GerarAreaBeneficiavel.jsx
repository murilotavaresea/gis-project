import React from "react";
import L from "leaflet";
import * as turf from "@turf/turf";
import config from "../config";
import { filtrarCoberturaSoloParaRemanescente } from "../utils/coberturaSoloCAR";

const UFS_VALIDAS = new Set([
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
]);

function obterFeaturePrincipal(layer) {
  const geojson = layer?.toGeoJSON?.();
  if (!geojson) {
    return null;
  }

  if (geojson.type === "FeatureCollection") {
    return geojson.features?.[0] || null;
  }

  return geojson.type === "Feature" ? geojson : null;
}

function obterColecaoGeoJSON(layer) {
  const geojson = layer?.toGeoJSON?.();
  if (!geojson) {
    return null;
  }

  if (geojson.type === "FeatureCollection") {
    return geojson;
  }

  if (geojson.type === "Feature") {
    return {
      type: "FeatureCollection",
      features: [geojson],
    };
  }

  return null;
}

function obterColecaoCoberturaSoloFiltrada(layer) {
  const geojson = obterColecaoGeoJSON(layer);
  if (!geojson) {
    return null;
  }

  const filtrado = filtrarCoberturaSoloParaRemanescente(geojson);
  return filtrado?.features?.length ? filtrado : null;
}

function extrairUfDoCAR(feature) {
  const props = feature?.properties || {};
  const candidatos = [
    props.uf,
    props.estado,
    props.cod_imovel,
    props.codImovel,
    props.inscricao,
    props.inscricaocar,
    props.codigo,
  ];

  for (const valorBruto of candidatos) {
    if (!valorBruto) {
      continue;
    }

    const valor = String(valorBruto).trim().toUpperCase();

    if (UFS_VALIDAS.has(valor)) {
      return valor;
    }

    if (valor.includes("MATO GROSSO")) {
      return "MT";
    }

    const matchPrefixo = valor.match(/^([A-Z]{2})(?=[-_:/\s])/);
    if (matchPrefixo && UFS_VALIDAS.has(matchPrefixo[1])) {
      return matchPrefixo[1];
    }

    const matchTexto = valor.match(/\b([A-Z]{2})\b/);
    if (matchTexto && UFS_VALIDAS.has(matchTexto[1])) {
      return matchTexto[1];
    }

    const prefixo = valor.slice(0, 2);
    if (UFS_VALIDAS.has(prefixo)) {
      return prefixo;
    }
  }

  return null;
}

function obterConfigApf(camadas = []) {
  return (
    camadas.find((camada) => {
      if (!camada?.externa) {
        return false;
      }

      const identificadores = [
        camada.analysisTypeName,
        camada.typeName,
        camada.titulo,
        camada.nome,
      ]
        .filter(Boolean)
        .map((valor) => String(valor).toUpperCase());

      return identificadores.some((valor) => valor.includes("MVW_APF_GEOMETRIA_REGULAR"));
    }) || null
  );
}

async function buscarApfExterna(featureImovel, camadas = []) {
  const camadaApf = obterConfigApf(camadas);
  if (!camadaApf) {
    throw new Error("Camada externa APF nao encontrada no catalogo atual.");
  }

  const baseUrl = camadaApf.analysisWfsBaseUrl || camadaApf.wfsBaseUrl;
  const typeName = camadaApf.analysisTypeName || camadaApf.typeName;
  const version = camadaApf.analysisWfsVersion || camadaApf.wfsVersion || "2.0.0";
  const extraParams = camadaApf.analysisWfsParams || camadaApf.wfsParams || {};

  if (!baseUrl || !typeName) {
    throw new Error("Configuracao da camada APF externa esta incompleta.");
  }

  const buffer = turf.buffer(featureImovel, 1, { units: "kilometers" });
  const bbox = `${turf.bbox(buffer).join(",")},EPSG:4326`;
  const typeParam = String(version).startsWith("2.") ? "typenames" : "typeName";

  const query = new URLSearchParams({
    base: baseUrl,
    service: "WFS",
    version,
    request: "GetFeature",
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    bbox,
  });
  query.set(typeParam, typeName);

  Object.entries(extraParams).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") {
      query.set(chave, String(valor));
    }
  });

  const response = await fetch(`${config.PROXY_WFS_BASE_URL}?${query.toString()}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Falha ao consultar APF externa: ${response.status}`);
  }

  if (!text.trim() || text.trim().startsWith("<")) {
    throw new Error("APF externa retornou resposta invalida.");
  }

  const geojson = JSON.parse(text);
  if (!geojson?.features?.length) {
    throw new Error("Nenhuma APF encontrada para o CAR informado.");
  }

  return geojson;
}

export default function GerarAreaBeneficiavel({
  map,
  drawnItemsRef,
  camadasImportadas,
  setCamadasImportadas,
  camadas,
  showProcessingOverlay,
  hideProcessingOverlay,
}) {
  const gerar = async () => {
    if (!map || !drawnItemsRef.current) {
      console.warn("Referencias do mapa ou itens desenhados nao estao disponiveis.");
      return;
    }

    const obterCamada = (nomeParcial) =>
      camadasImportadas.find((camada) => camada.nome.includes(nomeParcial));

    const camadaImovel = obterCamada("Area_do_Imovel");
    const camadaRL = obterCamada("Reserva_Legal");
    const camadaAPP = obterCamada("Area_de_Preservacao_Permanente");
    const camadaCoberturaSolo = obterCamada("Cobertura_do_Solo");
    const camadaServidao = obterCamada("Servidao_Administrativa");

    if (!camadaImovel) {
      alert("Area do imovel nao encontrada.");
      return;
    }

    const featureImovel = obterFeaturePrincipal(camadaImovel.layer);
    if (!featureImovel?.geometry) {
      alert("Geometria da area do imovel nao esta disponivel.");
      return;
    }

    const ufCAR = extrairUfDoCAR(featureImovel);
    const exigeApf = ufCAR === "MT";

    const impeditivas = [
      obterColecaoGeoJSON(camadaRL?.layer),
      obterColecaoGeoJSON(camadaAPP?.layer),
      obterColecaoCoberturaSoloFiltrada(camadaCoberturaSolo?.layer),
      obterColecaoGeoJSON(camadaServidao?.layer),
    ].filter(Boolean);

    let apfGeojson = null;
    let processamentoAtivo = false;

    try {
      processamentoAtivo = true;
      showProcessingOverlay?.({
        title: "Gerando area beneficiavel",
        message: exigeApf
          ? "Consultando a APF externa antes de aplicar as restricoes espaciais."
          : "Aplicando as restricoes espaciais para calcular a area final.",
      });

      if (exigeApf) {
        try {
          apfGeojson = await buscarApfExterna(featureImovel, camadas);
        } catch (error) {
          console.error("Erro ao buscar APF externa:", error);
          alert(
            "Para CAR do Mato Grosso, a area beneficiavel precisa ser intersectada com a APF. Nao foi possivel validar a APF externa."
          );
          return;
        }
      }

      showProcessingOverlay?.({
        title: "Gerando area beneficiavel",
        message: "Calculando a geometria final para adicionar o resultado ao mapa.",
      });

      const response = await fetch(config.GENERATE_AREA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imovel: featureImovel,
          impeditivas,
          apf: apfGeojson,
          estado: exigeApf ? "MT" : ufCAR || "NA",
        }),
      });

      const resultado = await response.json();

      if (!response.ok || resultado.erro) {
        alert(`Erro ao calcular area beneficiavel: ${resultado.erro || response.status}`);
        return;
      }

      const novaLayer = new L.GeoJSON(resultado, {
        style: { color: "#27ae60", weight: 1, fillOpacity: 0.5 },
      });

      if (!novaLayer.getLayers().length) {
        alert("A area beneficiavel resultou vazia apos aplicar as restricoes.");
        return;
      }

      novaLayer.addTo(drawnItemsRef.current);
      map.fitBounds(novaLayer.getBounds());

      setCamadasImportadas((prev) => [
        ...prev,
        {
          nome: "Área Beneficiável",
          layer: novaLayer,
          visivel: true,
          exportavel: true,
        },
      ]);
    } catch (error) {
      console.error("Erro ao gerar area beneficiavel:", error);
      alert("Erro ao gerar area beneficiavel.");
    } finally {
      if (processamentoAtivo) {
        hideProcessingOverlay?.();
      }
    }
  };

  return (
    <button onClick={gerar} title="Gerar Área Beneficiável">
      <img src="/icons/plant.svg" alt="Área Beneficiável" style={{ width: "22px", height: "22px" }} />
    </button>
  );
}
