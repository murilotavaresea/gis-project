import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import config from "../config";

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function variacao(atual, anterior) {
  if (anterior === 0) return atual > 0 ? "+100%" : "—";
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

const FERRAMENTAS = {
  desenho: "Desenho",
  medicao: "Medicao",
  exportar_kml: "Exportar KML",
  buscar_car: "Busca CAR",
  importar_arquivo: "Importar Arquivo",
  importar_car: "Importar CAR",
};

function ferramentaLabel(id) {
  return FERRAMENTAS[id] || id;
}

function GraficoBarras({ dados }) {
  if (!dados || dados.length === 0)
    return <p className="admin-chart-empty">Sem dados suficientes</p>;
  const max = Math.max(...dados.map((d) => d.total), 1);
  return (
    <div className="admin-chart">
      {dados.map((d) => (
        <div key={d.mes} className="admin-chart-col">
          <span className="admin-chart-val">{d.total}</span>
          <div className="admin-chart-bar-wrap">
            <div
              className="admin-chart-bar"
              style={{ height: `${Math.max((d.total / max) * 100, 4)}%` }}
            />
          </div>
          <span className="admin-chart-label">{d.mes}</span>
        </div>
      ))}
    </div>
  );
}

function ErrorRateCell({ taxa }) {
  const isOk = taxa === 0;
  return (
    <div className="admin-error-bar-wrap">
      <div className="admin-error-bar-bg">
        <div
          className={`admin-error-bar-fill${isOk ? " admin-error-bar-fill--zero" : ""}`}
          style={{ width: `${Math.min(taxa, 100)}%` }}
        />
      </div>
      <span className={`admin-error-label ${isOk ? "admin-error-label--ok" : "admin-error-label--warn"}`}>
        {taxa}%
      </span>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [logs, setLogs] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackAberto, setFeedbackAberto] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${config.API_BASE_URL}/admin/stats`, { headers }),
      axios.get(`${config.API_BASE_URL}/admin/usuarios`, { headers }),
      axios.get(`${config.API_BASE_URL}/admin/logs`, { headers }),
      axios.get(`${config.API_BASE_URL}/feedback/admin`, { headers }),
    ])
      .then(([statsRes, usersRes, logsRes, feedbacksRes]) => {
        setStats(statsRes.data);
        setUsuarios(usersRes.data);
        setLogs(logsRes.data);
        setFeedbacks(feedbacksRes.data);
      })
      .catch((err) => setErro(err.response?.data?.erro || "Erro ao carregar dados"))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return <div className="admin-shell"><div className="admin-empty">Carregando...</div></div>;
  }

  if (erro) {
    return (
      <div className="admin-shell">
        <div className="admin-empty">
          <p>{erro}</p>
          <button className="admin-back-btn" onClick={() => navigate("/webgis")}>← Voltar ao mapa</button>
        </div>
      </div>
    );
  }

  const u = stats.usuarios;
  const variacaoMes = variacao(u.novos_mes, u.novos_mes_anterior);
  const variacaoPositivo = !variacaoMes.startsWith("-") && variacaoMes !== "—";

  return (
    <div className="admin-shell">

      <header className="admin-header">
        <div className="admin-brand">
          <img src="/icons/Liro.png" alt="Logo" className="admin-logo" />
          <div>
            <h1 className="admin-title">LiroGis</h1>
            <span className="admin-subtitle">Painel Administrativo</span>
          </div>
        </div>
        <button className="admin-back-btn" onClick={() => navigate("/webgis")}>← Voltar ao mapa</button>
      </header>

      <div className="admin-inner">

        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <strong>{u.total}</strong>
            <span>Usuarios cadastrados</span>
            <small>{u.por_role?.admin || 0} admin · {u.por_role?.user || 0} comuns</small>
          </div>
          <div className="admin-stat-card">
            <strong>{u.novos_mes}</strong>
            <span>Novos este mes</span>
            <small className={variacaoPositivo ? "admin-stat-up" : "admin-stat-down"}>
              {variacaoMes} vs mes anterior
            </small>
          </div>
          <div className="admin-stat-card">
            <strong>{u.ativos_7d}</strong>
            <span>Ativos (7 dias)</span>
            <small>{u.ativos_30d} nos ultimos 30 dias</small>
          </div>
          <div className="admin-stat-card">
            <strong>{stats.camadas.total_tabelas_geo}</strong>
            <span>Camadas geograficas</span>
            <small>tabelas com geometria</small>
          </div>
        </div>

        <div className="admin-main">

          <div className="admin-panel">
            <div className="admin-panel-header">
              <span className="admin-section-label">Novos usuarios — ultimos 6 meses</span>
            </div>
            <div className="admin-panel-body">
              <GraficoBarras dados={u.crescimento} />
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-header">
              <span className="admin-section-label">Usuarios do sistema</span>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Cadastrado em</th>
                  <th>Ultimo acesso</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`admin-badge admin-badge--${u.role}`}>
                        {u.role === "admin" ? "Admin" : "Usuario"}
                      </span>
                    </td>
                    <td>{fmtDate(u.created_at)}</td>
                    <td>{fmt(u.last_login)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logs && logs.uso.length > 0 && (
            <div className="admin-panel">
              <div className="admin-panel-header">
                <span className="admin-section-label">Uso das ferramentas</span>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ferramenta</th>
                    <th>Usos</th>
                    <th>Erros</th>
                    <th>Taxa de erro</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.uso.map((f) => {
                    const taxa = f.total > 0 ? Math.round((f.erros / f.total) * 100) : 0;
                    return (
                      <tr key={f.ferramenta}>
                        <td>{ferramentaLabel(f.ferramenta)}</td>
                        <td>{f.total}</td>
                        <td>{f.erros}</td>
                        <td style={{ minWidth: 150 }}>
                          <ErrorRateCell taxa={taxa} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {logs && logs.uso.length === 0 && (
            <div className="admin-panel">
              <div className="admin-panel-header">
                <span className="admin-section-label">Uso das ferramentas</span>
              </div>
              <p className="admin-panel-empty">
                Nenhum uso registrado ainda. Os dados aparecerao conforme os usuarios utilizarem as ferramentas.
              </p>
            </div>
          )}

          {logs && logs.erros_recentes.length > 0 && (
            <div className="admin-panel">
              <div className="admin-panel-header">
                <span className="admin-section-label">Erros recentes</span>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ferramenta</th>
                    <th>Acao</th>
                    <th>Erro</th>
                    <th>Usuario</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.erros_recentes.map((e, i) => (
                    <tr key={i}>
                      <td>{ferramentaLabel(e.ferramenta)}</td>
                      <td>{e.acao}</td>
                      <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {e.erro || "—"}
                      </td>
                      <td>{e.usuario || "—"}</td>
                      <td>{fmt(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="admin-panel">
            <div className="admin-panel-header">
              <span className="admin-section-label">
                Feedbacks dos usuarios
                {feedbacks.length > 0 && (
                  <span className="admin-section-count">{feedbacks.length}</span>
                )}
              </span>
            </div>

            {feedbacks.length === 0 ? (
              <p className="admin-panel-empty">Nenhum feedback recebido ainda.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Titulo</th>
                    <th>Ferramenta</th>
                    <th>Usuario</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.map((f) => (
                    <>
                      <tr
                        key={f.id}
                        className={`admin-feedback-row${feedbackAberto === f.id ? " admin-feedback-row--open" : ""}`}
                        onClick={() => setFeedbackAberto(feedbackAberto === f.id ? null : f.id)}
                      >
                        <td>
                          <span className={`admin-badge admin-badge--${f.tipo}`}>
                            {f.tipo === "erro" ? "Erro" : "Sugestao"}
                          </span>
                        </td>
                        <td>{f.titulo}</td>
                        <td>{f.ferramenta || <span style={{ color: "rgba(78,69,75,0.35)" }}>—</span>}</td>
                        <td>{f.usuario || f.email || "—"}</td>
                        <td>{fmtDate(f.created_at)}</td>
                      </tr>
                      {feedbackAberto === f.id && f.descricao && (
                        <tr key={`${f.id}-desc`} className="admin-feedback-desc-row">
                          <td colSpan={5}>
                            <div className="admin-feedback-desc">{f.descricao}</div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="admin-footer-info">
            Dados atualizados em {fmt(stats.gerado_em)}
          </p>

        </div>
      </div>
    </div>
  );
}
