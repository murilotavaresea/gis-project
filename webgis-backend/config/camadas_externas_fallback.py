ESTADOS_IMOVEIS_SNCI = [
    ("AC", "Acre"),
    ("AL", "Alagoas"),
    ("AP", "Amapa"),
    ("AM", "Amazonas"),
    ("BA", "Bahia"),
    ("CE", "Ceara"),
    ("DF", "Distrito Federal"),
    ("ES", "Espirito Santo"),
    ("GO", "Goias"),
    ("MA", "Maranhao"),
    ("MT", "Mato Grosso"),
    ("MS", "Mato Grosso do Sul"),
    ("MG", "Minas Gerais"),
    ("PA", "Para"),
    ("PB", "Paraiba"),
    ("PE", "Pernambuco"),
    ("PI", "Piaui"),
    ("PR", "Parana"),
    ("RJ", "Rio de Janeiro"),
    ("RN", "Rio Grande do Norte"),
    ("RS", "Rio Grande do Sul"),
    ("RO", "Rondonia"),
    ("RR", "Roraima"),
    ("SC", "Santa Catarina"),
    ("SP", "Sao Paulo"),
    ("SE", "Sergipe"),
    ("TO", "Tocantins"),
]

ESTADOS_IMOVEIS_SIGEF = [
    ("AC", "Acre"),
    ("AL", "Alagoas"),
    ("AP", "Amapa"),
    ("AM", "Amazonas"),
    ("BA", "Bahia"),
    ("CE", "Ceara"),
    ("DF", "Distrito Federal"),
    ("ES", "Espirito Santo"),
    ("GO", "Goias"),
    ("MA", "Maranhao"),
    ("MT", "Mato Grosso"),
    ("MS", "Mato Grosso do Sul"),
    ("MG", "Minas Gerais"),
    ("PA", "Para"),
    ("PB", "Paraiba"),
    ("PE", "Pernambuco"),
    ("PI", "Piaui"),
    ("PR", "Parana"),
    ("RJ", "Rio de Janeiro"),
    ("RN", "Rio Grande do Norte"),
    ("RS", "Rio Grande do Sul"),
    ("RO", "Rondonia"),
    ("RR", "Roraima"),
    ("SC", "Santa Catarina"),
    ("SP", "Sao Paulo"),
    ("SE", "Sergipe"),
    ("TO", "Tocantins"),
]

EOX_CLOUDLESS_LAYERS = [
    ("2016", "s2cloudless_3857"),
    ("2018", "s2cloudless-2018_3857"),
    ("2019", "s2cloudless-2019_3857"),
    ("2020", "s2cloudless-2020_3857"),
    ("2021", "s2cloudless-2021_3857"),
    ("2022", "s2cloudless-2022_3857"),
    ("2023", "s2cloudless-2023_3857"),
    ("2024", "s2cloudless-2024_3857"),
]

INPE_PRODES_MOSAIC_TIMES = [
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
]

# Todos os biomas usam o virtual service do GeoServer ({workspace}/yearly_deforestation/ows),
# mais estavel que o endpoint generico /geoserver/ows que apresentou erros de uid em 2025.
# prodes-legal-amz mantido para Amazonia (cobre Amazonia Legal, maior que o bioma).
PRODES_BIOMAS_LAYERS = [
    ("Amazonia",       "prodes-legal-amz:yearly_deforestation"),
    ("Cerrado",        "prodes-cerrado-nb:yearly_deforestation"),
    ("Pampa",          "prodes-pampa-nb:yearly_deforestation"),
    ("Mata Atlantica", "prodes-mata-atlantica-nb:yearly_deforestation"),
    ("Caatinga",       "prodes-caatinga-nb:yearly_deforestation"),
    ("Pantanal",       "prodes-pantanal-nb:yearly_deforestation"),
]

PLANET_RONDONIA_2026_LAYERS = [
    ("01", "Janeiro", "planet_012026"),
    ("02", "Fevereiro", "planet_022026"),
    ("03", "Marco", "planet_032026"),
]


SIGEF_USAR_WFS = False

INCRA_I3GEO_BASE = "http://acervofundiario.incra.gov.br/i3geo/ogc.php"


def criar_camadas_imoveis(estados, tema_prefixo, subgrupo_externo, source_type="wms"):
    camadas = []
    for uf, nome_estado in estados:
        type_name = f"{tema_prefixo}_{uf.lower()}"
        base = {
            "titulo": nome_estado,
            "typeName": type_name,
            "identifyEnabled": True,
            "opacity": 0.42,
            "minZoom": 7,
            "sourceType": source_type,
            "grupoExterno": "Imoveis",
            "subgrupoExterno": subgrupo_externo,
        }
        if source_type == "wfs":
            camadas.append({**base, "wfs": INCRA_I3GEO_BASE, "useProxy": "always", "requestTimeoutMs": 90000})
        else:
            camadas.append({**base, "wms": f"{INCRA_I3GEO_BASE}?tema={type_name}"})
    return camadas


def criar_camadas_areas_atribuidas():
    categorias = [
        ("Assentamento", "assentamento", "areasatribuidas2023_assentamento"),
        ("Quilombola", "quilombola", "areasatribuidas2023_quilombola"),
        (
            "Unidade de Conservacao",
            "unidade de conservacao",
            "areasatribuidas2023_unidade_conservacao",
        ),
    ]

    return [
        {
            "id": identificador,
            "titulo": titulo,
            "typeName": "geonode:areasatribuidas2023",
            "wfs": "https://geoinfo.dados.embrapa.br/geoserver/wfs",
            "minZoom": 6,
            "sourceType": "wfs",
            "wfsVersion": "2.0.0",
            "grupoExterno": "Fontes Externas",
            "featureFilter": {
                "field": "categoria",
                "value": categoria,
            },
        }
        for titulo, categoria, identificador in categorias
    ]


def criar_camadas_eox_cloudless():
    return [
        {
            "id": f"eox-s2cloudless-{ano}",
            "titulo": f"Sentinel-2 {ano}",
            "typeName": layer_name,
            "wmsLayers": layer_name,
            "wms": "https://tiles.maps.eox.at/wms",
            "useProxy": False,
            "minZoom": 1,
            "opacity": 1,
            "sourceType": "wms",
            "grupoExterno": "Mosaicos",
            "subgrupoExterno": "Sentinel cloudless",
            "wmsParams": {
                "format": "image/jpeg",
                "transparent": False,
            },
        }
        for ano, layer_name in EOX_CLOUDLESS_LAYERS
    ]


def criar_camadas_inpe_prodes_mosaico():
    return [
        {
            "id": f"inpe-prodes-mosaico-{time_value[:4]}",
            "titulo": f"Mosaico PRODES {time_value[:4]}",
            "typeName": "temporal_mosaic_legal_amazon",
            "wmsLayers": "temporal_mosaic_legal_amazon",
            "wms": "https://terrabrasilis.dpi.inpe.br/geoserver/prodes-legal-amz/wms",
            "useProxy": False,
            "minZoom": 4,
            "opacity": 1,
            "sourceType": "wms",
            "grupoExterno": "Mosaicos",
            "subgrupoExterno": "PRODES Amazônia Legal",
            "wmsCrs": "EPSG:4326",
            "wmsParams": {
                "version": "1.3.0",
                "format": "image/png",
                "transparent": False,
                "time": time_value,
            },
        }
        for time_value in INPE_PRODES_MOSAIC_TIMES
    ]


def criar_camadas_planet_rondonia():
    return [
        {
            "id": f"sedam-ro-planet-2026-{mes}",
            "titulo": f"Planet Rondonia {nome_mes} 2026",
            "typeName": layer_name,
            "xyzUrl": f"https://api-geoportal.sedam.ro.gov.br/tilesapi/tiles/planet/2026/{layer_name}/{{z}}/{{x}}/{{y}}",
            "minZoom": 1,
            "maxZoom": 20,
            "opacity": 1,
            "sourceType": "xyz",
            "useProxy": "always",
            "grupoExterno": "Mosaicos",
            "subgrupoExterno": "Rondonia",
            "temporalReportEnabled": True,
        }
        for mes, nome_mes, layer_name in PLANET_RONDONIA_2026_LAYERS
    ]


def criar_camadas_mapbiomas_alerta():
    return [
        {
            "id": "mapbiomas-alerta-publicados",
            "titulo": "MapBiomas Alerta - Publicados",
            "typeName": "mapbiomas-alerta-publicados",
            "sourceType": "mapbiomas-alerta",
            "grupoExterno": "Alertas",
            "subgrupoExterno": "MapBiomas Alerta",
            "minZoom": 6,
            "mapbiomasProxyPath": "/proxy/mapbiomas-alerta",
            "mapbiomasStartDate": "2019-01-01",
            "mapbiomasSources": ["All"],
            "mapbiomasPageSize": 20,
            "mapbiomasMaxPages": 1,
        }
    ]


def criar_camadas_prodes_biomas():
    return [
        {
            "titulo": f"PRODES {bioma} - Desmatamento anual",
            "typeName": type_name,
            "wfs": f"https://terrabrasilis.dpi.inpe.br/geoserver/{type_name.split(':')[0]}/yearly_deforestation/ows",
            "featureFilter": {
                "field": "year",
                "operator": "gte",
                "value": 2019,
            },
            "minZoom": 7,
            "sourceType": "wfs",
            "grupoExterno": "Alertas",
            "subgrupoExterno": "PRODES",
        }
        for bioma, type_name in PRODES_BIOMAS_LAYERS
    ]


def criar_camadas_zsee_rondonia():
    return [
        {
            "id": "zsee-rondonia-2005",
            "titulo": "ZSEE Rondonia 2005",
            "sourceType": "geojson-static",
            "geojsonPath": "/camadas/local/zsee_rondonia_2005",
            "minZoom": 6,
            "opacity": 0.82,
            "grupoExterno": "Fontes Externas",
            "subgrupoExterno": "SEDAM RO",
        }
    ]


CAMADAS_EXTERNAS_FALLBACK = [
    {
        "titulo": "Embargos IBAMA",
        "typeName": "ibama-adm-embargos-a",
        "sourceType": "arcgis-feature",
        "arcgisQueryUrl": "https://pamgia.ibama.gov.br/server/rest/services/01_Publicacoes_Bases/adm_embargos_ibama_a/MapServer/0/query",
        "minZoom": 7,
        "grupoExterno": "Fontes Externas",
    },
    *criar_camadas_prodes_biomas(),
    {
        "titulo": "Sitios Arqueologicos (IPHAN)",
        "typeName": "SICG:sitios",
        "wfs": "https://geoserver.iphan.gov.br/geoserver/SICG/ows",
        "wfsVersion": "1.0.0",
        "useProxy": "always",
        "minZoom": 7,
        "sourceType": "wfs",
        "grupoExterno": "Fontes Externas",
    },
    {
        "titulo": "Malha municipal 2020",
        "typeName": "CGEO:andb2022_020302",
        "wfs": "https://geoservicos.ibge.gov.br/geoserver/ows",
        "minZoom": 5,
        "sourceType": "wfs",
        "grupoExterno": "Fontes Externas",
    },
    *criar_camadas_zsee_rondonia(),
    {
        "titulo": "APF geometria regular (SEMA-MT)",
        "typeName": "Geoportal:MVW_APF_GEOMETRIA_REGULAR",
        "wfs": "https://geo.sema.mt.gov.br/geoserver/wfs",
        "minZoom": 7,
        "sourceType": "wfs",
        "grupoExterno": "Fontes Externas",
        "subgrupoExterno": "SEMA-MT",
        "wfsParams": {
            "authkey": "541085de-9a2e-454e-bdba-eb3d57a2f492",
        },
        "analysisWfsBaseUrl": "https://geo.sema.mt.gov.br/geoserver/wfs",
        "analysisTypeName": "Geoportal:MVW_APF_GEOMETRIA_REGULAR",
        "analysisWfsParams": {
            "authkey": "541085de-9a2e-454e-bdba-eb3d57a2f492",
        },
    },
    {
        "titulo": "Areas Embargadas SEMA-MT",
        "typeName": "Geoportal:AREAS_EMBARGADAS_SEMA",
        "wfs": "https://geo.sema.mt.gov.br/geoserver/wfs",
        "minZoom": 7,
        "sourceType": "wfs",
        "grupoExterno": "Fontes Externas",
        "subgrupoExterno": "SEMA-MT",
        "wfsParams": {
            "authkey": "541085de-9a2e-454e-bdba-eb3d57a2f492",
        },
        "analysisWfsBaseUrl": "https://geo.sema.mt.gov.br/geoserver/wfs",
        "analysisTypeName": "Geoportal:AREAS_EMBARGADAS_SEMA",
        "analysisWfsParams": {
            "authkey": "541085de-9a2e-454e-bdba-eb3d57a2f492",
        },
    },
    {
        "titulo": "Cadastro Nacional de Florestas Publicas (2024)",
        "typeName": "arcgis-cnfp-2024",
        "sourceType": "arcgis-feature",
        "arcgisQueryUrl": "https://smapas.florestal.gov.br/server/rest/services/Hosted/Cadastro_Nacional_de_Florestas_P%C3%BAblicas_Atualiza%C3%A7%C3%A3o_2024_Retificado/FeatureServer/0/query",
        "minZoom": 7,
        "grupoExterno": "Fontes Externas",
        "arcgisParams": {
            "where": "tipo = 'TIPO B'",
        },
    },
    {
        "titulo": "Terras Indigenas",
        "typeName": "Funai:tis_poligonais",
        "wfs": "https://geoserver.funai.gov.br/geoserver/Funai/wfs",
        "minZoom": 5,
        "sourceType": "wfs",
        "wfsVersion": "2.0.0",
        "grupoExterno": "Fontes Externas",
    },
    {
        "titulo": "Areas embargadas - ICMBio",
        "typeName": "ICMBio:embargos_icmbio",
        "wfs": "https://geoservicos.inde.gov.br/geoserver/ICMBio/wfs",
        "minZoom": 6,
        "sourceType": "wfs",
        "wfsVersion": "2.0.0",
        "useProxy": "always",
        "grupoExterno": "Fontes Externas",
        "subgrupoExterno": "ICMBio",
    },
    {
        "titulo": "Autos de Infracao - ICMBio",
        "typeName": "ICMBio:autos_infracao_icmbio",
        "wfs": "https://geoservicos.inde.gov.br/geoserver/ICMBio/wfs",
        "minZoom": 7,
        "sourceType": "wfs",
        "wfsVersion": "2.0.0",
        "useProxy": "always",
        "grupoExterno": "Fontes Externas",
        "subgrupoExterno": "ICMBio",
    },
    *criar_camadas_mapbiomas_alerta(),
    *criar_camadas_eox_cloudless(),
    *criar_camadas_inpe_prodes_mosaico(),
    *criar_camadas_planet_rondonia(),
    *criar_camadas_areas_atribuidas(),
    *criar_camadas_imoveis(
        ESTADOS_IMOVEIS_SNCI,
        "imoveiscertificados_privado",
        "Imoveis Privados SNCI",
    ),
    *criar_camadas_imoveis(
        ESTADOS_IMOVEIS_SIGEF,
        "certificada_sigef_particular",
        "Imoveis Privados SIGEF",
        "wfs" if SIGEF_USAR_WFS else "wms",
    ),
]
