"""
ETL generico de camadas locais.

Importa dados de fontes externas (WFS, ArcGIS) para o PostGIS local.
As camadas sao definidas em config/camadas_locais.py.

Uso:
  # Importar tudo
  python etl/sincronizar.py

  # Importar camadas especificas (pelo nome da tabela)
  python etl/sincronizar.py zsee_rondonia_2005
  python etl/sincronizar.py zsee_rondonia_2005 embargos_ibama
"""

import sys
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Carrega o .env do backend antes de qualquer import que precise das credenciais
_env_path = BACKEND_DIR / ".env"
if _env_path.exists():
    for _line in _env_path.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _key, _val = _line.split("=", 1)
        _key = _key.strip()
        if _key and _key not in os.environ:
            os.environ[_key] = _val.strip().strip('"').strip("'")

from config.camadas_locais import CAMADAS_LOCAIS
from db import get_sqlalchemy_engine


def _importar_wfs(cfg, engine):
    import geopandas as gpd

    url = (
        f"{cfg['wfs_url']}"
        f"?service=WFS"
        f"&version={cfg.get('wfs_version', '2.0.0')}"
        f"&request=GetFeature"
        f"&typeName={cfg['wfs_type_name']}"
        f"&outputFormat=application/json"
    )
    gdf = gpd.read_file(url)

    if gdf.empty:
        raise RuntimeError("WFS retornou zero feicoes. Servidor pode estar fora do ar.")

    if gdf.crs is None or gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    gdf.to_postgis(cfg["tabela"], engine, if_exists="replace", index=False)
    return len(gdf)


def _importar_arcgis(cfg, engine):
    import geopandas as gpd
    import requests

    url = cfg["arcgis_url"]
    page_size = cfg.get("arcgis_page_size", 1000)
    offset = 0
    todos = []

    while True:
        params = {
            "where": cfg.get("arcgis_where", "1=1"),
            "outFields": "*",
            "returnGeometry": "true",
            "f": "geojson",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": page_size,
        }
        resp = requests.get(url, params=params, timeout=60)
        resp.raise_for_status()
        data = resp.json()

        if data.get("error"):
            raise RuntimeError(f"ArcGIS erro: {data['error']}")

        features = data.get("features", [])
        todos.extend(features)

        exceeded = (
            data.get("exceededTransferLimit")
            or data.get("properties", {}).get("exceededTransferLimit")
        )
        if len(features) < page_size or not exceeded:
            break
        offset += page_size

    if not todos:
        raise RuntimeError("ArcGIS retornou zero feicoes.")

    gdf = gpd.GeoDataFrame.from_features(todos, crs=4326)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    gdf.to_postgis(cfg["tabela"], engine, if_exists="replace", index=False)
    return len(gdf)


IMPORTADORES = {
    "wfs": _importar_wfs,
    "arcgis": _importar_arcgis,
}


def sincronizar(tabelas=None):
    try:
        import geopandas  # noqa: F401
    except ImportError as e:
        raise RuntimeError("geopandas nao disponivel no ambiente.") from e

    engine = get_sqlalchemy_engine()
    alvos = [c for c in CAMADAS_LOCAIS if not tabelas or c["tabela"] in tabelas]

    if not alvos:
        print("Nenhuma camada encontrada para as tabelas informadas.")
        return

    erros = []
    for cfg in alvos:
        titulo = cfg["titulo"]
        tipo = cfg.get("tipo_fonte", "wfs")
        importador = IMPORTADORES.get(tipo)

        if not importador:
            print(f"[AVISO] Tipo de fonte '{tipo}' nao suportado para '{titulo}'. Pulando.")
            continue

        print(f"\n[{titulo}]")
        print(f"  Fonte: {tipo.upper()}")
        try:
            total = importador(cfg, engine)
            print(f"  OK: {total} feicoes importadas para '{cfg['tabela']}'.")
        except Exception as e:
            print(f"  ERRO: {e}")
            erros.append(titulo)

    print()
    if erros:
        print(f"Concluido com erros em: {', '.join(erros)}")
    else:
        print("Todas as camadas importadas com sucesso.")


if __name__ == "__main__":
    tabelas = sys.argv[1:] or None
    sincronizar(tabelas)
