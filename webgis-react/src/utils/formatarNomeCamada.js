export default function formatarNomeCamada(camada) {
  if (camada?.titulo && String(camada.titulo).trim()) {
    return camada.titulo;
  }

  const bruto = camada?.nome || "";
  const semWorkspace = bruto.includes(":") ? bruto.split(":").pop() : bruto;

  const title = semWorkspace
    .replace(/_/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

  const apelidos = {
    "Vw Brasil Adm Embargo A": "Embargos IBAMA",
    "Yearly Deforestation": "PRODES - Desmatamento anual",
    Apf: "APF",
    App: "APP",
    Rl: "Reserva Legal",
  };

  return apelidos[title] || title;
}
