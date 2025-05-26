from flask import Flask, jsonify
from flask_cors import CORS
from importer import importar_shapefiles
from routes.importar_car import importar_car_bp
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from routes.diferenca import diferenca_bp




app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://seufront.onrender.com"}})


app.register_blueprint(diferenca_bp)

# 👇 Registra a rota externa de importação do CAR
app.register_blueprint(importar_car_bp)

# 🔌 Conexão com o banco
conn = psycopg2.connect(
    host="webgis.cbiqq00q28p0.us-east-2.rds.amazonaws.com",  # ✅ aqui vai o endpoint
    port="5432",
    database="postgres",  # ✅ nome do banco, que por padrão é "postgres"
    user="murilotavares",
    password="Mu12rilo",
    cursor_factory=RealDictCursor
)
# 🔁 Rota para atualizar shapefiles manualmente
@app.route('/atualizar', methods=['GET'])
def atualizar_shapefiles():
    try:
        importar_shapefiles()
        return {'status': 'sucesso', 'mensagem': 'Importação concluída com sucesso!'}
    except Exception as e:
        return {'status': 'erro', 'mensagem': str(e)}, 500

# 🔎 Rota simples de status
@app.route('/status')
def status():
    return {'status': 'ok'}

# 📦 Lista de tabelas com coluna geometry
@app.route("/camadas", methods=["GET"])
def listar_camadas_disponiveis():
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name
            FROM information_schema.columns
            WHERE column_name = 'geometry'
            AND table_schema = 'public'
        """)
        tabelas = [row["table_name"] for row in cur.fetchall()]
        return jsonify(tabelas)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

# 📍 Rota dinâmica para buscar os GeoJSON
@app.route("/<tabela>", methods=["GET"])
def dados_geojson(tabela):
    if tabela == 'importar_car':  # evita conflito
        return jsonify({"erro": "Tabela não acessível diretamente"}), 400
    try:
        cur = conn.cursor()
        conn.rollback()
        cur.execute(f'SELECT ST_AsGeoJSON(geometry) AS geom FROM "{tabela}"')
        linhas = cur.fetchall()
        features = []
        for linha in linhas:
            geom = linha["geom"]
            if geom:
                features.append({
                    "type": "Feature",
                    "geometry": json.loads(geom),
                    "properties": {}
                })
        return jsonify(features)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

# 🚀 Início do servidor
if __name__ == '__main__':
    app.run(debug=True, port=5000)
