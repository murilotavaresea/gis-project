import json

from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash

from db import conn
from importer import importar_shapefiles
from config.camadas_externas import camadas_externas
from routes.auth import auth_bp
from routes.diferenca import diferenca_bp
from routes.ibama import ibama_bp
from routes.importar_car import importar_car_bp


app = Flask(__name__)
CORS(
    app,
    resources={
        r"/*": {
            "origins": [
                "http://localhost:3000",
                "https://gis-project-azsp.onrender.com",
            ]
        }
    },
)

app.register_blueprint(diferenca_bp)
app.register_blueprint(importar_car_bp)
app.register_blueprint(ibama_bp)
app.register_blueprint(auth_bp)


@app.route("/camadas_externas")
def listar_camadas_externas():
    return jsonify(camadas_externas)


@app.route("/atualizar", methods=["GET"])
def atualizar_shapefiles():
    try:
        importar_shapefiles()
        return {"status": "sucesso", "mensagem": "Importacao concluida com sucesso!"}
    except Exception as e:
        return {"status": "erro", "mensagem": str(e)}, 500


@app.route("/status")
def status():
    return {"status": "ok"}


@app.route("/camadas", methods=["GET"])
def listar_camadas_disponiveis():
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.columns
            WHERE column_name = 'geometry'
            AND table_schema = 'public'
            """
        )
        tabelas = [row["table_name"] for row in cur.fetchall()]
        return jsonify(tabelas)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.route("/<tabela>", methods=["GET"])
def dados_geojson(tabela):
    if tabela == "importar_car":
        return jsonify({"erro": "Tabela nao acessivel diretamente"}), 400

    try:
        cur = conn.cursor()
        conn.rollback()
        cur.execute(f'SELECT ST_AsGeoJSON(geometry) AS geom FROM "{tabela}"')
        linhas = cur.fetchall()
        features = []

        for linha in linhas:
            geom = linha["geom"]
            if geom:
                features.append(
                    {
                        "type": "Feature",
                        "geometry": json.loads(geom),
                        "properties": {},
                    }
                )

        return jsonify(features)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


def criar_usuario_teste():
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM usuarios WHERE email = %s", ("admin@teste.com",))
        if not cur.fetchone():
            senha_hash = generate_password_hash("123456")
            cur.execute(
                "INSERT INTO usuarios (nome, email, senha_hash) VALUES (%s, %s, %s)",
                ("Usuario de Teste", "admin@teste.com", senha_hash),
            )
            conn.commit()
            print("Usuario de teste criado: admin@teste.com / 123456")
        else:
            print("Usuario de teste ja existe.")
    except Exception as e:
        print("Erro ao criar usuario de teste:", str(e))


if __name__ == "__main__":
    criar_usuario_teste()
    app.run(debug=True, port=5000, threaded=True)
