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
  if (!dados || dados.length === 0) return <p className="admin-chart-empty">Sem dados suficientes</p>;
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

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [logs, setLogs] = useState(null);
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
    ])
      .then(([statsRes, usersRes, logsRes]) => {
        setStats(statsRes.data);
        setUsuarios(usersRes.data);
        setLogs(logsRes.data);
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
          <button className="admin-back" onClick={() => navigate("/webgis")}>← Voltar ao mapa</button>
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
            <h1 className="admin-title">Painel Administrativo</h1>
            <span className="admin-subtitle">LiroGis · Analise territorial</span>
          </div>
        </div>
        <button className="admin-back" onClick={() => navigate("/webgis")}>← Voltar ao mapa</button>
      </header>

      <main className="admin-main">

        <div className="admin-cards">
          <div className="admin-card">
            <span className="admin-card-label">Usuarios cadastrados</span>
            <span className="admin-card-value">{u.total}</span>
            <span className="admin-card-sub">{u.por_role?.admin || 0} admin · {u.por_role?.user || 0} comuns</span>
          </div>
          <div className="admin-card">
            <span className="admin-card-label">Novos este mes</span>
            <span className="admin-card-value">{u.novos_mes}</span>
            <span className={`admin-card-sub admin-card-sub--${variacaoPositivo ? "up" : "down"}`}>
              {variacaoMes} vs mes anterior
            </span>
          </div>
          <div className="admin-card">
            <span className="admin-card-label">Ativos (7 dias)</span>
            <span className="admin-card-value">{u.ativos_7d}</span>
            <span className="admin-card-sub">{u.ativos_30d} nos ultimos 30 dias</span>
          </div>
          <div className="admin-card">
            <span className="admin-card-label">Camadas geograficas</span>
            <span className="admin-card-value">{stats.camadas.total_tabelas_geo}</span>
            <span className="admin-card-sub">tabelas com geometria</span>
          </div>
        </div>

        <div className="admin-table-section" style={{ marginBottom: 24 }}>
          <div className="admin-section-title">Novos usuarios — ultimos 6 meses</div>
          <div style={{ padding: "20px 20px 8px" }}>
            <GraficoBarras dados={u.crescimento} />
          </div>
        </div>

        <div className="admin-table-section">
          <div className="admin-section-title">Usuarios do sistema</div>
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
          <div className="admin-table-section">
            <div className="admin-section-title">Uso das ferramentas</div>
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
                      <td>
                        <span className={taxa > 0 ? "admin-badge admin-badge--admin" : "admin-badge admin-badge--user"}>
                          {taxa}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {logs && logs.erros_recentes.length > 0 && (
          <div className="admin-table-section">
            <div className="admin-section-title">Erros recentes</div>
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

        {logs && logs.uso.length === 0 && (
          <div className="admin-table-section">
            <div className="admin-section-title">Uso das ferramentas</div>
            <p style={{ padding: "16px 20px", fontSize: 13, color: "rgba(78,69,75,0.5)" }}>
              Nenhum uso registrado ainda. Os dados aparecerao conforme os usuarios utilizarem as ferramentas.
            </p>
          </div>
        )}

        <div className="admin-footer-info">
          Dados atualizados em {fmt(stats.gerado_em)}
        </div>
      </main>
    </div>
  );
}
