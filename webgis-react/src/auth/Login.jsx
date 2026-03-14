import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      const res = await axios.post("http://localhost:5000/auth/login", {
        email,
        senha,
      });
      localStorage.setItem("token", res.data.token);
      navigate("/webgis");
    } catch (error) {
      console.error("Falha no login:", error);
      setErro("Credenciais invalidas. Verifique e tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-backdrop" />

      <div className="login-shell">
        <section className="login-brandPanel">
          <div className="login-brandBadge">Geoportal institucional</div>
          <h1>Inteligencia territorial em um painel unico</h1>
          <p>
            Acesse o ambiente operacional para visualizar camadas, importar arquivos e conduzir
            analises espaciais com mais clareza.
          </p>

          <div className="login-brandStats">
            <div>
              <strong>Mapas</strong>
              <span>Base centralizada para operacao</span>
            </div>
            <div>
              <strong>Analises</strong>
              <span>Ferramentas de verificacao e relatorio</span>
            </div>
          </div>
        </section>

        <form className="login-box" onSubmit={handleLogin}>
          <div className="login-cardEyebrow">Acesso seguro</div>
          <h2>Entrar no WebGIS</h2>
          <p className="login-helper">Use suas credenciais para abrir o painel cartografico.</p>

          <label className="login-field">
            <span>E-mail</span>
            <input
              type="email"
              placeholder="voce@instituicao.gov.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="login-field">
            <span>Senha</span>
            <input
              type="password"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </label>

          {erro && <div className="login-error">{erro}</div>}

          <button type="submit" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
