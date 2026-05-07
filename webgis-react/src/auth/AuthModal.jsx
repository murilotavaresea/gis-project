import { useState, useEffect } from "react";
import axios from "axios";
import "./AuthModal.css";
import config from "../config";

export default function AuthModal({ onSuccess }) {
  const [tab, setTab] = useState("login"); // "login" | "register" | "forgot"
  const [visible, setVisible] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const resetForm = () => {
    setNome(""); setEmail(""); setSenha(""); setConfirmarSenha("");
    setErro(""); setInfo("");
  };

  const switchTab = (t) => { setTab(t); resetForm(); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const res = await axios.post(`${config.API_BASE_URL}/auth/login`, { email, senha });
      localStorage.setItem("token", res.data.token);
      onSuccess();
    } catch {
      setErro("Credenciais inválidas. Verifique e tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErro("");
    if (senha !== confirmarSenha) { setErro("As senhas não coincidem."); return; }
    if (senha.length < 6) { setErro("A senha deve ter no mínimo 6 caracteres."); return; }
    setCarregando(true);
    try {
      await axios.post(`${config.API_BASE_URL}/auth/register`, { nome, email, senha });
      const res = await axios.post(`${config.API_BASE_URL}/auth/login`, { email, senha });
      localStorage.setItem("token", res.data.token);
      onSuccess();
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao criar conta.");
    } finally {
      setCarregando(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setErro(""); setInfo("");
    setCarregando(true);
    try {
      const res = await axios.post(`${config.API_BASE_URL}/auth/forgot-password`, { email });
      setInfo(res.data.mensagem);
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao enviar e-mail.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className={`auth-overlay${visible ? " auth-overlay--visible" : ""}`}>
      <div className={`auth-modal${visible ? " auth-modal--visible" : ""}`}>

        <div className="auth-brand">
          <span className="auth-brand-name">LiroGis</span>
          <p>Análise territorial e inteligência espacial</p>
        </div>

        {tab !== "forgot" && (
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab${tab === "login" ? " auth-tab--active" : ""}`}
              onClick={() => switchTab("login")}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`auth-tab${tab === "register" ? " auth-tab--active" : ""}`}
              onClick={() => switchTab("register")}
            >
              Criar conta
            </button>
          </div>
        )}

        {tab === "login" && (
          <form onSubmit={handleLogin}>
            <label className="auth-field">
              <span>E-mail</span>
              <input type="email" placeholder="voce@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label className="auth-field">
              <span>Senha</span>
              <input type="password" placeholder="Sua senha" value={senha}
                onChange={(e) => setSenha(e.target.value)} required />
            </label>
            {erro && <div className="auth-error">{erro}</div>}
            <button type="submit" className="auth-submit" disabled={carregando}>
              {carregando ? "Entrando..." : "Entrar"}
            </button>
            <button type="button" className="auth-link" onClick={() => switchTab("forgot")}>
              Esqueceu a senha?
            </button>
          </form>
        )}

        {tab === "register" && (
          <form onSubmit={handleRegister}>
            <label className="auth-field">
              <span>Nome completo</span>
              <input type="text" placeholder="Ex: João Silva" value={nome}
                onChange={(e) => setNome(e.target.value)} required autoFocus />
            </label>
            <label className="auth-field">
              <span>E-mail</span>
              <input type="email" placeholder="voce@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="auth-field">
              <span>Senha</span>
              <input type="password" placeholder="Mínimo 6 caracteres" value={senha}
                onChange={(e) => setSenha(e.target.value)} required />
            </label>
            <label className="auth-field">
              <span>Confirmar senha</span>
              <input type="password" placeholder="Repita a senha" value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)} required />
            </label>
            {erro && <div className="auth-error">{erro}</div>}
            <button type="submit" className="auth-submit" disabled={carregando}>
              {carregando ? "Criando conta..." : "Criar conta"}
            </button>
          </form>
        )}

        {tab === "forgot" && (
          <form onSubmit={handleForgot}>
            <div className="auth-forgot-header">
              <button type="button" className="auth-back" onClick={() => switchTab("login")}>
                ← Voltar
              </button>
              <p>Informe seu e-mail e enviaremos um link para redefinir a senha.</p>
            </div>
            <label className="auth-field">
              <span>E-mail</span>
              <input type="email" placeholder="voce@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            {erro && <div className="auth-error">{erro}</div>}
            {info && <div className="auth-info">{info}</div>}
            {!info && (
              <button type="submit" className="auth-submit" disabled={carregando}>
                {carregando ? "Enviando..." : "Enviar link"}
              </button>
            )}
          </form>
        )}

      </div>
    </div>
  );
}
