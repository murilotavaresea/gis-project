import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "./RedefinirSenha.css";
import config from "../config";

export default function RedefinirSenha() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!token) setErro("Link inválido. Solicite um novo e-mail de redefinição.");
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");

    if (senha !== confirmarSenha) { setErro("As senhas não coincidem."); return; }
    if (senha.length < 6) { setErro("A senha deve ter no mínimo 6 caracteres."); return; }

    setCarregando(true);
    try {
      await axios.post(`${config.API_BASE_URL}/auth/reset-password`, { token, senha });
      setSucesso(true);
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao redefinir senha.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="rs-container">
      <div className="rs-backdrop" />
      <div className={`rs-card${visible ? " rs-card--visible" : ""}`}>

        <div className="rs-brand">
          <span>LiroGis</span>
          <p>Redefinição de senha</p>
        </div>

        {sucesso ? (
          <div className="rs-success">
            <div className="rs-success-icon">✓</div>
            <p>Senha redefinida com sucesso!</p>
            <button className="rs-submit" onClick={() => navigate("/webgis")}>
              Ir para o mapa
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="rs-field">
              <span>Nova senha</span>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                autoFocus
                disabled={!token}
              />
            </label>
            <label className="rs-field">
              <span>Confirmar senha</span>
              <input
                type="password"
                placeholder="Repita a nova senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                disabled={!token}
              />
            </label>
            {erro && <div className="rs-error">{erro}</div>}
            <button type="submit" className="rs-submit" disabled={carregando || !token}>
              {carregando ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
