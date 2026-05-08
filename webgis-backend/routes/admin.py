import datetime
import os
from functools import wraps

import jwt
from flask import Blueprint, jsonify, request

from db import get_db_connection

admin_bp = Blueprint("admin_bp", __name__, url_prefix="/admin")
JWT_SECRET = os.getenv("JWT_SECRET", "chave_super_secreta")


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


@admin_bp.route("/stats", methods=["GET"])
@admin_required
def stats():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM usuarios")
            total_usuarios = cur.fetchone()["total"]

            cur.execute("SELECT COALESCE(role, 'user') AS role, COUNT(*) AS total FROM usuarios GROUP BY role")
            por_role = {row["role"]: row["total"] for row in cur.fetchall()}

            cur.execute(
                "SELECT COUNT(*) AS total FROM usuarios WHERE created_at >= date_trunc('month', NOW())"
            )
            novos_mes = cur.fetchone()["total"]

            cur.execute(
                """
                SELECT COUNT(*) AS total FROM usuarios
                WHERE created_at >= date_trunc('month', NOW() - interval '1 month')
                  AND created_at < date_trunc('month', NOW())
                """
            )
            novos_mes_anterior = cur.fetchone()["total"]

            cur.execute(
                "SELECT COUNT(*) AS total FROM usuarios WHERE last_login >= NOW() - interval '7 days'"
            )
            ativos_7d = cur.fetchone()["total"]

            cur.execute(
                "SELECT COUNT(*) AS total FROM usuarios WHERE last_login >= NOW() - interval '30 days'"
            )
            ativos_30d = cur.fetchone()["total"]

            cur.execute(
                """
                SELECT to_char(date_trunc('month', created_at), 'Mon/YY') AS mes,
                       date_trunc('month', created_at) AS mes_dt,
                       COUNT(*) AS total
                FROM usuarios
                WHERE created_at >= NOW() - interval '6 months'
                GROUP BY date_trunc('month', created_at)
                ORDER BY date_trunc('month', created_at)
                """
            )
            crescimento = [{"mes": r["mes"], "total": r["total"]} for r in cur.fetchall()]

            cur.execute(
                """
                SELECT COUNT(DISTINCT table_name) AS total
                FROM information_schema.columns
                WHERE column_name = 'geometry' AND table_schema = 'public'
                """
            )
            total_camadas = cur.fetchone()["total"]

        return jsonify({
            "usuarios": {
                "total": total_usuarios,
                "por_role": por_role,
                "novos_mes": novos_mes,
                "novos_mes_anterior": novos_mes_anterior,
                "ativos_7d": ativos_7d,
                "ativos_30d": ativos_30d,
                "crescimento": crescimento,
            },
            "camadas": {
                "total_tabelas_geo": total_camadas,
            },
            "gerado_em": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        })
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn is not None:
            conn.close()


@admin_bp.route("/logs", methods=["GET"])
@admin_required
def logs():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ferramenta,
                       COUNT(*) AS total,
                       SUM(CASE WHEN NOT sucesso THEN 1 ELSE 0 END) AS erros
                FROM logs_atividade
                GROUP BY ferramenta
                ORDER BY total DESC
                """
            )
            uso = [
                {"ferramenta": r["ferramenta"], "total": r["total"], "erros": r["erros"]}
                for r in cur.fetchall()
            ]

            cur.execute(
                """
                SELECT l.ferramenta, l.acao, l.erro, l.created_at,
                       u.nome, u.email
                FROM logs_atividade l
                LEFT JOIN usuarios u ON l.user_id = u.id
                WHERE NOT l.sucesso
                ORDER BY l.created_at DESC
                LIMIT 20
                """
            )
            erros = [
                {
                    "ferramenta": r["ferramenta"],
                    "acao": r["acao"],
                    "erro": r["erro"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    "usuario": r["nome"],
                    "email": r["email"],
                }
                for r in cur.fetchall()
            ]

        return jsonify({"uso": uso, "erros_recentes": erros})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn is not None:
            conn.close()


@admin_bp.route("/usuarios", methods=["GET"])
@admin_required
def listar_usuarios():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, nome, email, COALESCE(role, 'user') AS role,
                       created_at, last_login
                FROM usuarios ORDER BY id DESC
                """
            )
            usuarios = [
                {
                    "id": row["id"],
                    "nome": row["nome"],
                    "email": row["email"],
                    "role": row["role"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "last_login": row["last_login"].isoformat() if row["last_login"] else None,
                }
                for row in cur.fetchall()
            ]
        return jsonify(usuarios)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn is not None:
            conn.close()
