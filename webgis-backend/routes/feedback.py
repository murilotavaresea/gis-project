import os
from functools import wraps

import jwt
from flask import Blueprint, jsonify, request

from db import get_db_connection

feedback_bp = Blueprint("feedback_bp", __name__, url_prefix="/feedback")
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


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"erro": "Token nao fornecido"}), 401
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            if payload.get("role") != "admin":
                return jsonify({"erro": "Acesso restrito a administradores"}), 403
        except jwt.ExpiredSignatureError:
            return jsonify({"erro": "Token expirado"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"erro": "Token invalido"}), 401
        return f(*args, **kwargs)
    return decorated


@feedback_bp.route("", methods=["POST"])
@auth_required
def enviar_feedback():
    data = request.json or {}
    tipo = str(data.get("tipo", "sugestao"))[:50]
    titulo = str(data.get("titulo", "")).strip()[:200]
    descricao = str(data.get("descricao", "")).strip()[:2000]
    ferramenta = data.get("ferramenta")
    if ferramenta:
        ferramenta = str(ferramenta)[:100]

    if not titulo:
        return jsonify({"erro": "Titulo obrigatorio"}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO feedbacks (user_id, tipo, titulo, descricao, ferramenta)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (request.user_id, tipo, titulo, descricao or None, ferramenta or None),
            )
            conn.commit()
        return jsonify({"ok": True}), 201
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn is not None:
            conn.close()


@feedback_bp.route("/admin", methods=["GET"])
@admin_required
def listar_feedbacks():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT f.id, f.tipo, f.titulo, f.descricao, f.ferramenta, f.created_at,
                       u.nome AS usuario, u.email
                FROM feedbacks f
                LEFT JOIN usuarios u ON f.user_id = u.id
                ORDER BY f.created_at DESC
                LIMIT 200
                """
            )
            feedbacks = [
                {
                    "id": r["id"],
                    "tipo": r["tipo"],
                    "titulo": r["titulo"],
                    "descricao": r["descricao"],
                    "ferramenta": r["ferramenta"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    "usuario": r["usuario"],
                    "email": r["email"],
                }
                for r in cur.fetchall()
            ]
        return jsonify(feedbacks)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn is not None:
            conn.close()
