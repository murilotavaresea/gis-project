import json
import os
from datetime import datetime

from db import get_sqlalchemy_engine


FORCAR_TUDO = os.getenv("FORCAR_REIMPORTACAO", "").lower() == "true"
PASTA_SHAPEFILES = os.getenv(
    "SHAPEFILES_DIR", r"C:\Users\Murilo Tavares\Desktop\DADOS AMBIENTAIS"
)
CONTROLE_PATH = "controle_importacao.json"


def importar_shapefiles():
    try:
        import geopandas as gpd
    except ImportError as error:
        raise RuntimeError(
            "geopandas nao esta disponivel no ambiente para importar shapefiles."
        ) from error

    if not os.path.isdir(PASTA_SHAPEFILES):
        raise RuntimeError(
            f"Diretorio de shapefiles nao encontrado: {PASTA_SHAPEFILES}"
        )

    engine = get_sqlalchemy_engine()

    if os.path.exists(CONTROLE_PATH):
        with open(CONTROLE_PATH, "r", encoding="utf-8") as file:
            controle = json.load(file)
    else:
        controle = {}

    for raiz, _, arquivos in os.walk(PASTA_SHAPEFILES):
        for arquivo in arquivos:
            if not arquivo.lower().endswith(".shp"):
                continue

            caminho = os.path.join(raiz, arquivo)
            tabela = os.path.splitext(arquivo)[0].replace(" ", "_").lower()
            ultima_mod = os.path.getmtime(caminho)
            ultima_mod_str = datetime.fromtimestamp(ultima_mod).isoformat()

            if not FORCAR_TUDO and controle.get(tabela) == ultima_mod_str:
                print(f"'{tabela}' sem alteracoes.")
                continue

            print(f"Importando '{arquivo}' para a tabela '{tabela}'...")

            try:
                gdf = gpd.read_file(caminho, encoding="utf-8")
            except UnicodeDecodeError:
                print("Erro de encoding; tentando novamente com latin1...")
                gdf = gpd.read_file(caminho, encoding="latin1")

            if gdf.geometry.name != "geometry":
                gdf = gdf.set_geometry(gdf.geometry.name)

            gdf.to_postgis(tabela, engine, if_exists="replace", index=False)
            controle[tabela] = ultima_mod_str
            print(f"'{tabela}' importada com sucesso.")

    with open(CONTROLE_PATH, "w", encoding="utf-8") as file:
        json.dump(controle, file, indent=2)


if __name__ == "__main__":
    try:
        with get_sqlalchemy_engine().connect():
            print("Conexao com o banco bem-sucedida.")
        importar_shapefiles()
    except Exception as error:
        print("Erro ao importar shapefiles:", error)
