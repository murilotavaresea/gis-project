import formatarNomeCamada from "./formatarNomeCamada";

const GEOSERVER_INTERNO_URL = "";
const ACERVO_FUNDIARIO_OGC_URL = "http://acervofundiario.incra.gov.br/i3geo/ogc.php";
const MAPBIOMAS_ALERTA_GRAPHQL_URL = "https://plataforma.alerta.mapbiomas.org/api/v2/graphql";

export function normalizarUrlFonte(url = "") {
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

export function identificarFonte(url = "") {
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

    if (hostname.includes("api.planet.com")) {
      return "Planet";
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

export function resumirCamadaFonte(camada, geoserverBaseUrl = GEOSERVER_INTERNO_URL) {
  if (!camada?.externa) {
    return {
      grupo: "Banco de Dados Interno",
      orgao: "GeoServer local",
      servico: "WFS interno",
      url: normalizarUrlFonte(geoserverBaseUrl),
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

  if (camada.sourceType === "xyz") {
    const baseUrl = camada.xyzUrl || camada.tileUrlTemplate || camada.urlTemplate || "";

    return {
      grupo: "Fontes Externas",
      orgao: identificarFonte(baseUrl),
      servico: "XYZ Tiles",
      url: normalizarUrlFonte(baseUrl),
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
