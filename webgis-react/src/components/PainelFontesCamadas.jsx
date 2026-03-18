import React, { useMemo } from "react";
import formatarNomeCamada from "../utils/formatarNomeCamada";
import config from "../config";

const GEOSERVER_INTERNO_URL = config.GEOSERVER_BASE_URL;
const ACERVO_FUNDIARIO_OGC_URL = "http://acervofundiario.incra.gov.br/i3geo/ogc.php";
const MAPBIOMAS_ALERTA_GRAPHQL_URL = "https://plataforma.alerta.mapbiomas.org/api/v2/graphql";

function normalizarUrlFonte(url = "") {
  if (!url) {
    return "";
  }

  if (url.includes("acervofundiario.incra.gov.br/i3geo/ogc.php")) {
    return ACERVO_FUNDIARIO_OGC_URL;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function identificarFonte(url = "") {
  try {
    const { hostname } = new URL(url);

    if (hostname.includes("siscom.ibama.gov.br")) {
      return "IBAMA";
    }

    if (hostname.includes("terrabrasilis.dpi.inpe.br")) {
      return "INPE / TerraBrasilis";
    }

    if (hostname.includes("portal.iphan.gov.br")) {
      return "IPHAN";
    }

    if (hostname.includes("tiles.maps.eox.at")) {
      return "EOX";
    }

    if (hostname.includes("geoservicos.ibge.gov.br")) {
      return "IBGE";
    }

    if (hostname.includes("geo.sema.mt.gov.br")) {
      return "SEMA-MT";
    }

    if (hostname.includes("smapas.florestal.gov.br")) {
      return "Servico Florestal Brasileiro";
    }

    if (hostname.includes("geoserver.funai.gov.br")) {
      return "FUNAI";
    }

    if (hostname.includes("geoinfo.dados.embrapa.br")) {
      return "Embrapa";
    }

    if (hostname.includes("plataforma.alerta.mapbiomas.org")) {
      return "MapBiomas Alerta";
    }

    if (hostname.includes("acervofundiario.incra.gov.br")) {
      return "Acervo Fundiario / INCRA";
    }

    if (hostname.includes("localhost")) {
      return "GeoServer local";
    }

    return hostname;
  } catch {
    return "Fonte externa";
  }
}

function resumirCamada(camada) {
  if (!camada?.externa) {
    return {
      grupo: "Banco de Dados Interno",
      orgao: "GeoServer local",
      servico: "WFS interno",
      url: normalizarUrlFonte(GEOSERVER_INTERNO_URL),
      camada: formatarNomeCamada(camada),
    };
  }

  if (camada.sourceType === "wms") {
    return {
      grupo: "Fontes Externas",
      orgao: identificarFonte(camada.wmsBaseUrl),
      servico: "WMS",
      url: normalizarUrlFonte(camada.wmsBaseUrl),
      camada: formatarNomeCamada(camada),
    };
  }

  if (camada.sourceType === "arcgis-feature") {
    return {
      grupo: "Fontes Externas",
      orgao: identificarFonte(camada.arcgisQueryUrl),
      servico: "ArcGIS Feature Service",
      url: normalizarUrlFonte(camada.arcgisQueryUrl),
      camada: formatarNomeCamada(camada),
    };
  }

  if (camada.sourceType === "mapbiomas-alerta") {
    return {
      grupo: "Fontes Externas",
      orgao: "MapBiomas Alerta",
      servico: "Proxy backend / GraphQL API",
      url: normalizarUrlFonte(camada.mapbiomasApiUrl || MAPBIOMAS_ALERTA_GRAPHQL_URL),
      camada: formatarNomeCamada(camada),
    };
  }

  return {
    grupo: "Fontes Externas",
    orgao: identificarFonte(camada.wfsBaseUrl),
    servico: "WFS",
    url: normalizarUrlFonte(camada.wfsBaseUrl),
    camada: formatarNomeCamada(camada),
  };
}

function agruparFontes(camadas = []) {
  const mapa = new Map();

  camadas.forEach((camada) => {
    const resumo = resumirCamada(camada);
    const chave = [resumo.grupo, resumo.orgao, resumo.servico, resumo.url].join("::");

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        ...resumo,
        quantidade: 0,
        exemplos: [],
      });
    }

    const grupo = mapa.get(chave);
    grupo.quantidade += 1;

    if (!grupo.exemplos.includes(resumo.camada) && grupo.exemplos.length < 4) {
      grupo.exemplos.push(resumo.camada);
    }
  });

  return [...mapa.values()].sort((a, b) => {
    if (a.grupo !== b.grupo) {
      return a.grupo.localeCompare(b.grupo);
    }

    return a.orgao.localeCompare(b.orgao);
  });
}

export default function PainelFontesCamadas({ camadas, onClose, variant = "floating" }) {
  const fontes = useMemo(() => agruparFontes(camadas), [camadas]);
  const externas = fontes.filter((item) => item.grupo === "Fontes Externas");
  const className = variant === "inline" ? "painel-fontes painel-fontesInline" : "painel-fontes";

  return (
    <div className={className}>
      <div className="painel-fontesHeader">
        <div>
          <strong className="painel-fontesTitle">Fontes das camadas</strong>
          <p className="painel-fontesIntro">
            Catalogo consolidado a partir dos metadados atuais do mapa.
          </p>
        </div>
        {onClose && (
          <button className="close-button" onClick={onClose} type="button">
            x
          </button>
        )}
      </div>

      <div className="painel-fontesBody">
        <div className="painel-fontesSection">
          <div className="painel-fontesSectionTitle">Fontes externas</div>
          {externas.map((fonte) => (
            <div key={`${fonte.grupo}-${fonte.orgao}-${fonte.servico}-${fonte.url}`} className="painel-fontesCard">
              <div className="painel-fontesRow">
                <strong>{fonte.orgao}</strong>
                <span className="painel-fontesTag">{fonte.servico}</span>
              </div>
              <div className="painel-fontesMeta">{fonte.quantidade} camadas vinculadas</div>
              <div className="painel-fontesUrl">{fonte.url}</div>
              <div className="painel-fontesLayers">
                {fonte.exemplos.map((nome) => (
                  <span key={nome} className="painel-fontesLayerTag">
                    {nome}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {externas.length === 0 && (
            <div className="painel-fontesCard">
              <div className="painel-fontesMeta">Nenhuma fonte externa catalogada no momento.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
