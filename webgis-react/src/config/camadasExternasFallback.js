const ESTADOS_IMOVEIS_SNCI = [
  ["AL", "Alagoas"],
  ["AP", "Amapa"],
  ["AM", "Amazonas"],
  ["BA", "Bahia"],
  ["ES", "Espirito Santo"],
  ["GO", "Goias"],
  ["MA", "Maranhao"],
  ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"],
  ["PA", "Para"],
  ["PB", "Paraiba"],
  ["PR", "Parana"],
  ["PE", "Pernambuco"],
  ["RJ", "Rio de Janeiro"],
  ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"],
  ["RO", "Rondonia"],
  ["RR", "Roraima"],
  ["SC", "Santa Catarina"],
  ["SP", "Sao Paulo"],
  ["SE", "Sergipe"],
  ["TO", "Tocantins"],
];

const ESTADOS_IMOVEIS_SIGEF = [
  ["AC", "Acre"],
  ["AL", "Alagoas"],
  ["AP", "Amapa"],
  ["AM", "Amazonas"],
  ["BA", "Bahia"],
  ["ES", "Espirito Santo"],
  ["GO", "Goias"],
  ["MA", "Maranhao"],
  ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"],
  ["PB", "Paraiba"],
  ["PR", "Parana"],
  ["PE", "Pernambuco"],
  ["RJ", "Rio de Janeiro"],
  ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"],
  ["RO", "Rondonia"],
  ["RR", "Roraima"],
  ["SC", "Santa Catarina"],
  ["SP", "Sao Paulo"],
  ["SE", "Sergipe"],
  ["TO", "Tocantins"],
];

const EOX_CLOUDLESS_LAYERS = [
  ["2016", "s2cloudless_3857"],
  ["2017", "s2cloudless-2017_3857"],
  ["2018", "s2cloudless-2018_3857"],
  ["2019", "s2cloudless-2019_3857"],
  ["2020", "s2cloudless-2020_3857"],
  ["2021", "s2cloudless-2021_3857"],
  ["2022", "s2cloudless-2022_3857"],
  ["2023", "s2cloudless-2023_3857"],
  ["2024", "s2cloudless-2024_3857"],
];

const INPE_PRODES_MOSAIC_TIMES = [
  "2000-01-01T00:00:00.000Z",
  "2001-01-01T00:00:00.000Z",
  "2002-01-01T00:00:00.000Z",
  "2003-01-01T00:00:00.000Z",
  "2004-01-01T00:00:00.000Z",
  "2005-01-01T00:00:00.000Z",
  "2006-01-01T00:00:00.000Z",
  "2007-01-01T00:00:00.000Z",
  "2008-01-01T00:00:00.000Z",
  "2009-01-01T00:00:00.000Z",
  "2010-01-01T00:00:00.000Z",
  "2011-01-01T00:00:00.000Z",
  "2012-01-01T00:00:00.000Z",
  "2013-01-01T00:00:00.000Z",
  "2014-01-01T00:00:00.000Z",
  "2015-01-01T00:00:00.000Z",
  "2016-01-01T00:00:00.000Z",
  "2017-01-01T00:00:00.000Z",
  "2018-01-01T00:00:00.000Z",
  "2019-01-01T00:00:00.000Z",
  "2020-01-01T00:00:00.000Z",
  "2021-01-01T00:00:00.000Z",
  "2022-01-01T00:00:00.000Z",
  "2023-01-01T00:00:00.000Z",
  "2024-01-01T00:00:00.000Z",
];

function criarCamadasImoveis(estados, temaPrefixo, subgrupoExterno) {
  return estados.map(([uf, nomeEstado]) => ({
    titulo: nomeEstado,
    typeName: `${temaPrefixo}_${uf.toLowerCase()}`,
    wms: `http://acervofundiario.incra.gov.br/i3geo/ogc.php?tema=${temaPrefixo}_${uf.toLowerCase()}`,
    identifyEnabled: true,
    opacity: 0.42,
    minZoom: 7,
    sourceType: "wms",
    grupoExterno: "Imoveis",
    subgrupoExterno,
  }));
}

function criarCamadasAreasAtribuidas() {
  const categorias = [
    ["Assentamento", "assentamento", "areasatribuidas2023_assentamento"],
    ["Quilombola", "quilombola", "areasatribuidas2023_quilombola"],
    [
      "Unidade de Conservacao",
      "unidade de conservacao",
      "areasatribuidas2023_unidade_conservacao",
    ],
  ];

  return categorias.map(([titulo, categoria, id]) => ({
    id,
    titulo,
    typeName: "geonode:areasatribuidas2023",
    wfs: "https://geoinfo.dados.embrapa.br/geoserver/wfs",
    minZoom: 6,
    sourceType: "wfs",
    wfsVersion: "2.0.0",
    grupoExterno: "Fontes Externas",
    featureFilter: {
      field: "categoria",
      value: categoria,
    },
  }));
}

function criarCamadasEoxCloudless() {
  return EOX_CLOUDLESS_LAYERS.map(([ano, layerName]) => ({
    id: `eox-s2cloudless-${ano}`,
    titulo: `Sentinel-2 ${ano}`,
    typeName: layerName,
    wmsLayers: layerName,
    wms: "https://tiles.maps.eox.at/wms",
    useProxy: false,
    minZoom: 1,
    opacity: 1,
    sourceType: "wms",
    grupoExterno: "Mosaicos",
    subgrupoExterno: "Sentinel cloudless",
    wmsParams: {
      format: "image/jpeg",
      transparent: false,
    },
  }));
}

function criarCamadasInpeProdesMosaico() {
  return INPE_PRODES_MOSAIC_TIMES.map((timeValue) => {
    const ano = timeValue.slice(0, 4);

    return {
      id: `inpe-prodes-mosaico-${ano}`,
      titulo: `Mosaico PRODES ${ano}`,
      typeName: "temporal_mosaic_legal_amazon",
      wmsLayers: "temporal_mosaic_legal_amazon",
      wms: "https://terrabrasilis.dpi.inpe.br/geoserver/prodes-legal-amz/wms",
      useProxy: false,
      minZoom: 4,
      opacity: 1,
      sourceType: "wms",
      grupoExterno: "Mosaicos",
      subgrupoExterno: "PRODES Amazônia Legal",
      wmsCrs: "EPSG:4326",
      wmsParams: {
        version: "1.3.0",
        format: "image/png",
        transparent: false,
        time: timeValue,
      },
    };
  });
}

function criarCamadasMapbiomasAlerta() {
  return [
    {
      id: "mapbiomas-alerta-publicados",
      titulo: "MapBiomas Alerta - Publicados",
      typeName: "mapbiomas-alerta-publicados",
      sourceType: "mapbiomas-alerta",
      grupoExterno: "Alertas",
      subgrupoExterno: "MapBiomas Alerta",
      minZoom: 6,
      mapbiomasProxyPath: "/proxy/mapbiomas-alerta",
      mapbiomasStartDate: "2019-01-01",
      mapbiomasSources: ["All"],
      mapbiomasPageSize: 20,
      mapbiomasMaxPages: 1,
    },
  ];
}

const camadasExternasFallback = [
  {
    titulo: "Embargos IBAMA",
    typeName: "publica:vw_brasil_adm_embargo_a",
    wfs: "https://siscom.ibama.gov.br/geoserver/ows",
    minZoom: 7,
    sourceType: "wfs",
    grupoExterno: "Fontes Externas",
  },
  {
    titulo: "PRODES Amazonia - Desmatamento anual",
    typeName: "prodes-legal-amz:yearly_deforestation",
    wfs: "https://terrabrasilis.dpi.inpe.br/geoserver/ows",
    minZoom: 7,
    sourceType: "wfs",
    grupoExterno: "Alertas",
    subgrupoExterno: "PRODES",
  },
  {
    titulo: "PRODES Cerrado - Desmatamento anual",
    typeName: "prodes-cerrado-nb:accumulated_deforestation_2000",
    wfs: "https://terrabrasilis.dpi.inpe.br/geoserver/ows",
    minZoom: 7,
    sourceType: "wfs",
    grupoExterno: "Alertas",
    subgrupoExterno: "PRODES",
  },
  {
    titulo: "Sitios Arqueologicos (IPHAN)",
    typeName: "SICG:sitios",
    wfs: "https://portal.iphan.gov.br/geoserver/SICG/ows",
    minZoom: 7,
    sourceType: "wfs",
    grupoExterno: "Fontes Externas",
  },
  {
    titulo: "Malha municipal 2020",
    typeName: "CGEO:andb2022_020302",
    wfs: "https://geoservicos.ibge.gov.br/geoserver/ows",
    minZoom: 7,
    sourceType: "wfs",
    grupoExterno: "Fontes Externas",
  },
  {
    titulo: "APF geometria regular (SEMA-MT)",
    typeName: "Geoportal:MVW_APF_GEOMETRIA_REGULAR",
    wfs: "https://geo.sema.mt.gov.br/geoserver/wfs",
    minZoom: 7,
    sourceType: "wfs",
    grupoExterno: "Fontes Externas",
    wfsParams: {
      authkey: "541085de-9a2e-454e-bdba-eb3d57a2f492",
    },
    analysisWfsBaseUrl: "https://geo.sema.mt.gov.br/geoserver/wfs",
    analysisTypeName: "Geoportal:MVW_APF_GEOMETRIA_REGULAR",
    analysisWfsParams: {
      authkey: "541085de-9a2e-454e-bdba-eb3d57a2f492",
    },
  },
  {
    titulo: "Cadastro Nacional de Florestas Publicas (2024)",
    typeName: "arcgis-cnfp-2024",
    sourceType: "arcgis-feature",
    arcgisQueryUrl:
      "https://smapas.florestal.gov.br/server/rest/services/Hosted/Cadastro_Nacional_de_Florestas_P%C3%BAblicas_Atualiza%C3%A7%C3%A3o_2024_Retificado/FeatureServer/0/query",
    minZoom: 7,
    grupoExterno: "Fontes Externas",
    arcgisParams: {
      where: "tipo = 'TIPO B'",
    },
  },
  {
    titulo: "Terras Indigenas",
    typeName: "Funai:tis_poligonais",
    wfs: "https://geoserver.funai.gov.br/geoserver/Funai/wfs",
    minZoom: 5,
    sourceType: "wfs",
    wfsVersion: "2.0.0",
    grupoExterno: "Fontes Externas",
  },
  ...criarCamadasMapbiomasAlerta(),
  ...criarCamadasEoxCloudless(),
  ...criarCamadasInpeProdesMosaico(),
  ...criarCamadasAreasAtribuidas(),
  ...criarCamadasImoveis(
    ESTADOS_IMOVEIS_SNCI,
    "imoveiscertificados_privado",
    "Imoveis Privados SNCI"
  ),
  ...criarCamadasImoveis(
    ESTADOS_IMOVEIS_SIGEF,
    "certificada_sigef_particular",
    "Imoveis Privados SIGEF"
  ),
];

export default camadasExternasFallback;
