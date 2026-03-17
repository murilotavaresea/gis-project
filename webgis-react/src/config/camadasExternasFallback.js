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
    grupoExterno: "Fontes Externas",
  },
  {
    titulo: "PRODES Cerrado - Desmatamento anual",
    typeName: "prodes-cerrado-nb:accumulated_deforestation_2000",
    wfs: "https://terrabrasilis.dpi.inpe.br/geoserver/ows",
    minZoom: 7,
    sourceType: "wfs",
    grupoExterno: "Fontes Externas",
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
