# importer.py
import geopandas as gpd
from sqlalchemy import create_engine
from datetime import datetime
import os, json

forcar_tudo = False  # ⬅️ Coloque True para reimportar todas as camadas

# pasta onde estão os shapefiles
pasta_shapefiles = r"C:\Users\Murilo Tavares\Desktop\DADOS AMBIENTAIS"
controle_path = "controle_importacao.json"

# config do banco
db_config = {
  "usuario": "postgres",
  "senha": "1234",
  "host": "localhost",
  "porta": "5433",
  "banco": "webgis_local"
}
engine = create_engine(
  f"postgresql://{db_config['usuario']}:{db_config['senha']}@"
  f"{db_config['host']}:{db_config['porta']}/{db_config['banco']}"
)

def importar_shapefiles():
  # lê ou inicializa controle
  if os.path.exists(controle_path):
    with open(controle_path, "r") as f:
      controle = json.load(f)
  else:
    controle = {}

  for raiz, _, arquivos in os.walk(pasta_shapefiles):
    for arquivo in arquivos:
      if arquivo.lower().endswith(".shp"):
        caminho = os.path.join(raiz, arquivo)
        tabela = os.path.splitext(arquivo)[0].replace(" ", "_").lower()
        ultima_mod = os.path.getmtime(caminho)
        ultima_mod_str = datetime.fromtimestamp(ultima_mod).isoformat()
        if not forcar_tudo and controle.get(tabela) == ultima_mod_str:
          print(f"⏭️ '{tabela}' sem alterações.")
          continue
        print(f"📤 Importando '{arquivo}' → tabela '{tabela}'…")

        # Tenta ler com UTF-8, senão tenta latin1
        # Tenta ler com UTF-8, senão tenta latin1
        try:
          gdf = gpd.read_file(caminho, encoding="utf-8")
          
        except UnicodeDecodeError:
          print(f"⚠️ Erro de encoding, re-lendo latin1…")
          gdf = gpd.read_file(caminho, encoding="latin1")



        # Define a geometria correta se necessário
        if gdf.geometry.name != 'geometry':
          gdf = gdf.set_geometry(gdf.geometry.name)

        # Importa para o PostGIS
        gdf.to_postgis(tabela, engine, if_exists="replace", index=False)
        controle[tabela] = ultima_mod_str
        print(f"✅ '{tabela}' importada com sucesso.")

  # Atualiza o arquivo de controle
  with open(controle_path, "w") as f:
    json.dump(controle, f, indent=2)

if __name__ == "__main__":
  try:
    with engine.connect() as conn:
      print("✅ Conexão com o banco local bem-sucedida!")
      importar_shapefiles()
  except Exception as e:
    print("❌ Erro ao conectar ao banco:", e)
