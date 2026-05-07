import datetime
import os
import secrets

import jwt
import resend
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
                "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=12),
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


@auth_bp.route("/register", methods=["POST"])
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
                "INSERT INTO usuarios (nome, email, senha_hash) VALUES (%s, %s, %s)",
                (nome, email, senha_hash),
            )
            conn.commit()

        return jsonify({"mensagem": "Usuario criado com sucesso"}), 201
    except Exception as error:
        return jsonify({"erro": str(error)}), 500
    finally:
        if conn is not None:
            conn.close()


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.json or {}
    email = data.get("email", "").strip()

    if not email:
        return jsonify({"erro": "E-mail obrigatorio"}), 400

    conn = None

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
            usuario = cur.fetchone()

            # Retorna sucesso mesmo se o e-mail não existir (evita enumeração)
            if not usuario:
                return jsonify({"mensagem": "Se o e-mail estiver cadastrado, você receberá o link em breve."})

            token = secrets.token_urlsafe(32)
            expires = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2)

            cur.execute(
                "UPDATE usuarios SET reset_token = %s, reset_token_expires = %s WHERE email = %s",
                (token, expires, email),
            )
            conn.commit()

        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        link = f"{frontend_url}/redefinir-senha?token={token}"
        _enviar_email_reset(email, link)

        return jsonify({"mensagem": "Se o e-mail estiver cadastrado, você receberá o link em breve."})
    except Exception as error:
        return jsonify({"erro": str(error)}), 500
    finally:
        if conn is not None:
            conn.close()


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.json or {}
    token = data.get("token", "").strip()
    nova_senha = data.get("senha", "")

    if not token or not nova_senha:
        return jsonify({"erro": "Token e senha sao obrigatorios"}), 400

    if len(nova_senha) < 6:
        return jsonify({"erro": "A senha deve ter no minimo 6 caracteres"}), 400

    conn = None

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, reset_token_expires FROM usuarios WHERE reset_token = %s",
                (token,),
            )
            usuario = cur.fetchone()

            if not usuario:
                return jsonify({"erro": "Token invalido ou expirado"}), 400

            expires = usuario["reset_token_expires"]
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=datetime.timezone.utc)

            if datetime.datetime.now(datetime.timezone.utc) > expires:
                return jsonify({"erro": "Token expirado. Solicite um novo link."}), 400

            senha_hash = generate_password_hash(nova_senha)
            cur.execute(
                """
                UPDATE usuarios
                SET senha_hash = %s, reset_token = NULL, reset_token_expires = NULL
                WHERE id = %s
                """,
                (senha_hash, usuario["id"]),
            )
            conn.commit()

        return jsonify({"mensagem": "Senha redefinida com sucesso"})
    except Exception as error:
        return jsonify({"erro": str(error)}), 500
    finally:
        if conn is not None:
            conn.close()


def _enviar_email_reset(destinatario: str, link: str) -> None:
    api_key = os.getenv("RESEND_API_KEY", "")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY nao configurado no .env")

    remetente = os.getenv("RESEND_FROM", "LiroGis <onboarding@resend.dev>")

    html = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f6f5f0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#faf9f4;border:1px solid rgba(109,97,104,0.12);max-width:480px;width:100%;">
        <tr>
          <td style="padding:32px 36px 24px;border-bottom:1px solid rgba(109,97,104,0.1);">
            <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.1em;
                      text-transform:uppercase;color:rgba(78,69,75,0.56);">LiroGis</p>
            <h1 style="margin:10px 0 0;font-size:22px;font-weight:800;color:#4e454b;line-height:1.2;">
              Redefinição de senha
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px;">
            <p style="margin:0 0 20px;font-size:14px;color:rgba(78,69,75,0.8);line-height:1.65;">
              Recebemos uma solicitação para redefinir a senha da sua conta.
              Clique no botão abaixo para criar uma nova senha.
              O link é válido por <strong>2 horas</strong>.
            </p>
            <a href="{link}"
               style="display:inline-block;padding:13px 28px;background:#2f2f2f;color:#f8faf6;
                      font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;
                      text-decoration:none;">
              Redefinir senha
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:rgba(78,69,75,0.56);line-height:1.55;">
              Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 36px;border-top:1px solid rgba(109,97,104,0.1);
                     font-size:10px;color:rgba(78,69,75,0.4);">
            LiroGis · Sistema cartográfico para análise e monitoramento territorial
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

    resend.api_key = api_key
    resend.Emails.send({
        "from": remetente,
        "to": [destinatario],
        "subject": "Redefinição de senha — LiroGis",
        "html": html,
    })
