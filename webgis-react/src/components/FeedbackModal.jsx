import { useState } from "react";
import axios from "axios";
import config from "../config";

const FERRAMENTAS = [
  { value: "", label: "Nenhuma / Geral" },
  { value: "desenho", label: "Desenho" },
  { value: "medicao", label: "Medicao" },
  { value: "exportar_kml", label: "Exportar KML" },
  { value: "buscar_car", label: "Busca CAR" },
  { value: "importar_arquivo", label: "Importar Arquivo" },
  { value: "importar_car", label: "Importar CAR" },
  { value: "verificar_sobreposicao", label: "Verificar Sobreposicao" },
  { value: "gerar_area_beneficiavel", label: "Gerar Area Beneficiavel" },
];

export default function FeedbackModal({ isOpen, onClose }) {
  const [tipo, setTipo] = useState("erro");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ferramenta, setFerramenta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [enviado, setEnviado] = useState(false);

  function resetar() {
    setTipo("erro");
    setTitulo("");
    setDescricao("");
    setFerramenta("");
    setErro(null);
    setEnviado(false);
  }

  function fechar() {
    onClose();
    setTimeout(resetar, 300);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${config.API_BASE_URL}/feedback`,
        { tipo, titulo: titulo.trim(), descricao: descricao.trim(), ferramenta: ferramenta || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEnviado(true);
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={`feedback-overlay${isOpen ? " feedback-overlay--visible" : ""}`} onClick={fechar}>
      <div
        className={`feedback-modal${isOpen ? " feedback-modal--visible" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="feedback-brand">
          <span className="feedback-brand-name">Reportar / Sugerir</span>
          <p>Relato de erro ou sugestao de melhoria</p>
        </div>

        {enviado ? (
          <div className="feedback-success">
            <p className="feedback-success-title">Enviado com sucesso</p>
            <p className="feedback-success-msg">Seu relato foi registrado. Obrigado pelo feedback!</p>
            <button className="feedback-submit" onClick={fechar}>Fechar</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="feedback-tabs">
              <button
                type="button"
                className={`feedback-tab${tipo === "erro" ? " feedback-tab--active" : ""}`}
                onClick={() => setTipo("erro")}
              >
                Erro
              </button>
              <button
                type="button"
                className={`feedback-tab${tipo === "sugestao" ? " feedback-tab--active" : ""}`}
                onClick={() => setTipo("sugestao")}
              >
                Sugestao
              </button>
            </div>

            <div className="feedback-field">
              <label>Titulo</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder={tipo === "erro" ? "Descreva o problema brevemente" : "Resuma sua sugestao"}
                maxLength={200}
                required
                autoFocus
              />
            </div>

            <div className="feedback-field">
              <label>Ferramenta afetada <span className="feedback-optional">(opcional)</span></label>
              <select value={ferramenta} onChange={(e) => setFerramenta(e.target.value)}>
                {FERRAMENTAS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div className="feedback-field">
              <label>Descricao <span className="feedback-optional">(opcional)</span></label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={tipo === "erro" ? "Passos para reproduzir, mensagem de erro, etc." : "Detalhes da melhoria desejada"}
                rows={4}
                maxLength={2000}
              />
            </div>

            {erro && <div className="feedback-error">{erro}</div>}

            <button type="submit" className="feedback-submit" disabled={enviando || !titulo.trim()}>
              {enviando ? "Enviando..." : "Enviar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
