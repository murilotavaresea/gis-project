import json
import os
from pathlib import Path


def _load_local_env():
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue

        os.environ[key] = value.strip().strip('"').strip("'")


_load_local_env()

from flask import Flask, jsonify
from flask_cors import CORS
from psycopg2 import sql
from werkzeug.security import generate_password_hash

from config.camadas_externas import camadas_externas
from db import get_db_connection
from importer import importar_shapefiles
from routes.auth import auth_bp
from routes.diferenca import diferenca_bp
from routes.ibama import ibama_bp
from routes.importar_car import importar_car_bp


def _load_allowed_origins():
    origins = {
        "http://localhost:3000",
        "https://gis-project-azsp.onrender.com",
        "https://gis-reactb.onrender.com",
    }

    extra_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
    for origin in extra_origins.split(","):
        origin = origin.strip()
        if origin:
            origins.add(origin)

    return sorted(origins)


app = Flask(__name__)
CORS(
    app,
    resources={
        r"/*": {
            "origins": _load_allowed_origins()
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
    except Exception as error:
        return {"status": "erro", "mensagem": str(error)}, 500


@app.route("/status")
def status():
    return {"status": "ok"}


@app.route("/camadas", methods=["GET"])
def listar_camadas_disponiveis():
    conn = None

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
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
    except Exception as error:
        return jsonify({"erro": str(error)}), 500
    finally:
        if conn is not None:
            conn.close()


@app.route("/<tabela>", methods=["GET"])
def dados_geojson(tabela):
    if tabela == "importar_car":
        return jsonify({"erro": "Tabela nao acessivel diretamente"}), 400

    conn = None

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL('SELECT ST_AsGeoJSON(geometry) AS geom FROM {}').format(
                    sql.Identifier(tabela)
                )
            )
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
    except Exception as error:
        return jsonify({"erro": str(error)}), 500
    finally:
        if conn is not None:
            conn.close()


def criar_usuario_teste():
    conn = None

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM usuarios WHERE email = %s", ("admin@teste.com",))
            if cur.fetchone():
                print("Usuario de teste ja existe.")
                return

            senha_hash = generate_password_hash("123456")
            cur.execute(
                "INSERT INTO usuarios (nome, email, senha_hash) VALUES (%s, %s, %s)",
                ("Usuario de Teste", "admin@teste.com", senha_hash),
            )
            conn.commit()

        print("Usuario de teste criado: admin@teste.com / 123456")
    except Exception as error:
        print("Erro ao criar usuario de teste:", str(error))
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    if os.getenv("CREATE_TEST_USER", "").lower() == "true":
        criar_usuario_teste()

    app.run(debug=True, port=5000, threaded=True)
