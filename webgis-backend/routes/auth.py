import datetime
import os

import jwt
from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from db import get_db_connection


auth_bp = Blueprint("auth_bp", __name__, url_prefix="/auth")
JWT_SECRET = os.getenv("JWT_SECRET", "chave_super_secreta")


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    email = data.get("email")
    senha = data.get("senha")

    conn = None

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id, senha_hash FROM usuarios WHERE email = %s", (email,))
            usuario = cur.fetchone()

        if not usuario or not check_password_hash(usuario["senha_hash"], senha):
            return jsonify({"erro": "Credenciais invalidas"}), 401

        token = jwt.encode(
            {
                "user_id": usuario["id"],
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12),
            },
            JWT_SECRET,
            algorithm="HS256",
        )

        return jsonify({"token": token})
    except Exception as error:
        return jsonify({"erro": str(error)}), 500
    finally:
        if conn is not None:
            conn.close()


@auth_bp.route("/dev-register", methods=["POST"])
def cadastrar_usuario():
    data = request.json or {}
    nome = data.get("nome")
    email = data.get("email")
    senha = data.get("senha")

    if not nome or not email or not senha:
        return jsonify({"erro": "Preencha todos os campos"}), 400

    conn = None

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
            if cur.fetchone():
                return jsonify({"erro": "Usuario ja existe"}), 400

            senha_hash = generate_password_hash(senha)
            cur.execute(
                """
                INSERT INTO usuarios (nome, email, senha_hash)
                VALUES (%s, %s, %s)
                """,
                (nome, email, senha_hash),
            )
            conn.commit()

        return jsonify({"mensagem": "Usuario criado com sucesso"}), 201
    except Exception as error:
        return jsonify({"erro": str(error)}), 500
    finally:
        if conn is not None:
            conn.close()
