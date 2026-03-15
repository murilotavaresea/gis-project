from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
import jwt
import datetime
from db import conn


auth_bp = Blueprint("auth_bp", __name__, url_prefix="/auth")

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    senha = data.get("senha")

    cur = conn.cursor()
    cur.execute("SELECT id, senha_hash FROM usuarios WHERE email = %s", (email,))
    usuario = cur.fetchone()

    if not usuario or not check_password_hash(usuario["senha_hash"], senha):
        return jsonify({"erro": "Credenciais inválidas"}), 401

    token = jwt.encode({
        "user_id": usuario["id"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12)
    }, "chave_super_secreta", algorithm="HS256")

    return jsonify({"token": token})

from werkzeug.security import generate_password_hash

@auth_bp.route("/dev-register", methods=["POST"])
def cadastrar_usuario():
    data = request.json
    nome = data.get("nome")
    email = data.get("email")
    senha = data.get("senha")

    if not nome or not email or not senha:
        return jsonify({"erro": "Preencha todos os campos"}), 400

    cur = conn.cursor()
    cur.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
    if cur.fetchone():
        return jsonify({"erro": "Usuário já existe"}), 400

    senha_hash = generate_password_hash(senha)
    cur.execute("""
        INSERT INTO usuarios (nome, email, senha_hash)
        VALUES (%s, %s, %s)
    """, (nome, email, senha_hash))
    conn.commit()

    return jsonify({"mensagem": "Usuário criado com sucesso"}), 201

