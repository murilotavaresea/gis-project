"""
Registro de camadas locais — fonte externa → PostGIS local.

Para adicionar uma nova camada:
  1. Acrescente uma entrada nesta lista.
  2. Rode:  python etl/sincronizar.py
  3. Adicione no camadasExternasFallback.js (JS) ou camadas_externas_fallback.py:
       sourceType: "geojson-static"
       geojsonPath: "/camadas/local/<tabela>"

Tipos de fonte suportados
  "wfs"      — WFS OGC (GeoServer, MapServer, etc.)
  "arcgis"   — ArcGIS Feature/Map Server REST query endpoint
"""

CAMADAS_LOCAIS = [
    {
        "tabela": "zsee_rondonia_2005",
        "titulo": "ZSEE Rondonia 2005",
        "tipo_fonte": "wfs",
        "wfs_url": "https://geoportal.sedam.ro.gov.br/geoserver/ows",
        "wfs_type_name": "cogeo:ZSEE_2Aprox_2005_312_SIRGAS2000_4674",
        "wfs_version": "2.0.0",
    },

    # Exemplo ArcGIS (descomente e ajuste quando precisar):
    # {
    #     "tabela": "embargos_ibama",
    #     "titulo": "Embargos IBAMA",
    #     "tipo_fonte": "arcgis",
    #     "arcgis_url": "https://pamgia.ibama.gov.br/server/rest/services/01_Publicacoes_Bases/adm_embargos_ibama_a/MapServer/0/query",
    # },
]
