import axios from "axios";
import config from "../config";

export function logEvento(ferramenta, acao, sucesso = true, erro = null) {
  const token = localStorage.getItem("token");
  if (!token) return;
  axios
    .post(
      `${config.API_BASE_URL}/eventos/log`,
      { ferramenta, acao, sucesso, erro: erro ? String(erro).slice(0, 500) : null },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    .catch(() => {});
}
