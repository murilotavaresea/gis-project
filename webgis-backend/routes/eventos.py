import os
from functools import wraps

import jwt
from flask import Blueprint, jsonify, request

from db import get_db_connection

eventos_bp = Blueprint("eventos_bp", __name__, url_prefix="/eventos")
JWT_SECRET = os.getenv("JWT_SECRET", "chave_super_secreta")


def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"erro": "Token nao fornecido"}), 401
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            request.user_id = payload.get("user_id")
        except jwt.ExpiredSignatureError:
            return jsonify({"erro": "Token expirado"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"erro": "Token invalido"}), 401
        return f(*args, **kwargs)
    return decorated


@eventos_bp.route("/log", methods=["POST"])
@auth_required
def log_evento():
    data = request.json or {}
    ferramenta = str(data.get("ferramenta", ""))[:100]
    acao = str(data.get("acao", ""))[:100]
    sucesso = bool(data.get("sucesso", True))
    erro = data.get("erro")
    if erro:
        erro = str(erro)[:500]

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO logs_atividade (user_id, ferramenta, acao, sucesso, erro)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (request.user_id, ferramenta, acao, sucesso, erro),
            )
            conn.commit()
        return jsonify({"ok": True}), 201
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn is not None:
            conn.close()
