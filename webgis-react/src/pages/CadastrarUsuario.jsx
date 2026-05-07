import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "./CadastrarUsuario.css";
import config from "../config";

export default function CadastrarUsuario() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");

    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    if (senha.length < 6) {
      setErro("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setCarregando(true);
    try {
      await axios.post(`${config.API_BASE_URL}/auth/register`, { nome, email, senha });
      setSucesso(true);
    } catch (err) {
      const msg = err.response?.data?.erro || "Erro inesperado ao criar conta.";
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  };

  const resetForm = () => {
    setSucesso(false);
    setNome("");
    setEmail("");
    setSenha("");
    setConfirmarSenha("");
    setErro("");
  };

  if (sucesso) {
    return (
      <div className="cad-container">
        <div className="cad-backdrop" />
        <div className="cad-success-card">
          <div className="cad-success-icon">✓</div>
          <h2>Conta criada!</h2>
          <p>
            Seu cadastro foi realizado com sucesso. Você já pode entrar no sistema.
          </p>
          <div className="cad-success-actions">
            <button onClick={resetForm}>Cadastrar outra</button>
            <Link to="/login">Entrar agora</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cad-container">
      <div className="cad-backdrop" />

      <div className="cad-shell">
        <section className="cad-brandPanel">
          <div className="cad-brandBadge">Novo acesso</div>
          <h1>Crie sua conta no sistema</h1>
          <p>
            Registre-se para acessar o painel cartográfico, visualizar camadas, importar
            arquivos e conduzir análises espaciais.
          </p>

          <div className="cad-brandStats">
            <div>
              <strong>Acesso seguro</strong>
              <span>Senha armazenada com criptografia</span>
            </div>
            <div>
              <strong>Sessão JWT</strong>
              <span>Autenticação com token de 12h</span>
            </div>
          </div>

          <Link to="/login" className="cad-backLink">
            ← Já tenho uma conta
          </Link>
        </section>

        <form className="cad-box" onSubmit={handleSubmit}>
          <div className="cad-cardEyebrow">Cadastro gratuito</div>
          <h2>Criar conta</h2>
          <p className="cad-helper">Preencha seus dados para começar.</p>

          <label className="cad-field">
            <span>Nome completo</span>
            <input
              type="text"
              placeholder="Ex: João Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </label>

          <label className="cad-field">
            <span>E-mail</span>
            <input
              type="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="cad-field">
            <span>Senha</span>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </label>

          <label className="cad-field">
            <span>Confirmar senha</span>
            <input
              type="password"
              placeholder="Repita a senha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
            />
          </label>

          {erro && <div className="cad-error">{erro}</div>}

          <button type="submit" disabled={carregando}>
            {carregando ? "Criando conta..." : "Criar conta"}
          </button>

          <p className="cad-login-link">
            Já tem uma conta?{" "}
            <Link to="/login">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
