import json
import os
import re
from hashlib import sha1
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

from flask import Flask, jsonify, request
from flask_cors import CORS
from psycopg2 import sql
from werkzeug.security import generate_password_hash

from config.camadas_externas import camadas_externas
from db import get_db_connection
from importer import importar_shapefiles
from routes.admin import admin_bp
from routes.auth import auth_bp
from routes.eventos import eventos_bp
from routes.diferenca import diferenca_bp
from routes.ibama import ibama_bp
from routes.importar_car import importar_car_bp
from routes.feedback import feedback_bp
from blueprints.mapbiomas_bp import mapbiomas_bp
from blueprints.camadas_locais_bp import camadas_locais_bp


def _load_allowed_origins():
    origins = [
        re.compile(r"^http://localhost(:\d+)?$"),
        re.compile(r"^http://127\.0\.0\.1(:\d+)?$"),
        "http://localhost:3000",
        "https://gis-project-azsp.onrender.com",
        "https://gis-reactb.onrender.com",
    ]

    extra_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
    for origin in extra_origins.split(","):
        origin = origin.strip()
        if origin:
            origins.append(origin)

    return origins


app = Flask(__name__)
CORS(
    app,
    resources={
        r"/*": {
            "origins": _load_allowed_origins()
        }
    },
)

app.register_blueprint(admin_bp)
app.register_blueprint(eventos_bp)
app.register_blueprint(diferenca_bp)
app.register_blueprint(importar_car_bp)
app.register_blueprint(ibama_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(feedback_bp)
app.register_blueprint(mapbiomas_bp, url_prefix="/mapbiomas")
app.register_blueprint(camadas_locais_bp, url_prefix="/camadas")


def init_db():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS usuarios (
                    id SERIAL PRIMARY KEY,
                    nome VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    senha_hash VARCHAR(255) NOT NULL,
                    reset_token VARCHAR(255),
                    reset_token_expires TIMESTAMPTZ
                )
                """
            )
            cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)")
            cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ")
            cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'")
            cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()")
            cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ")
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS logs_atividade (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
                    ferramenta VARCHAR(100),
                    acao VARCHAR(100),
                    sucesso BOOLEAN DEFAULT TRUE,
                    erro TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS feedbacks (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
                    tipo VARCHAR(50) NOT NULL DEFAULT 'sugestao',
                    titulo VARCHAR(200) NOT NULL,
                    descricao TEXT,
                    ferramenta VARCHAR(100),
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
            admin_email = os.getenv("ADMIN_EMAIL", "")
            if admin_email:
                cur.execute("UPDATE usuarios SET role = 'admin' WHERE email = %s", (admin_email,))
            conn.commit()
        print("Tabela 'usuarios' verificada/criada.")
    except Exception as error:
        print("Erro ao inicializar banco:", str(error))
    finally:
        if conn is not None:
            conn.close()


@app.route("/camadas_externas")
def listar_camadas_externas():
    response = jsonify(camadas_externas)
    response.cache_control.public = True
    response.cache_control.max_age = 600
    response.set_etag(
        sha1(
            json.dumps(
                camadas_externas,
                sort_keys=True,
                ensure_ascii=True,
            ).encode("utf-8")
        ).hexdigest()
    )
    response.make_conditional(request)
    return response


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


init_db()

if os.getenv("CREATE_TEST_USER", "").lower() == "true":
    criar_usuario_teste()

# Inicia o scheduler apenas no processo principal (nao no reloader do Flask dev)
if os.getenv("ETL_SCHEDULER_ENABLED", "true").lower() == "true" and \
        os.environ.get("WERKZEUG_RUN_MAIN") != "true":
    from scheduler import iniciar_scheduler
    iniciar_scheduler()


if __name__ == "__main__":
    app.run(debug=True, port=5000, threaded=True)
