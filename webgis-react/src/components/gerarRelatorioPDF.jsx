import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getEstiloCamada } from "../utils/estiloCamadas";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function desenharCabecalho(doc, subtitulo) {
  doc.setFillColor(10, 43, 54);
  doc.rect(0, 0, PAGE_WIDTH, 28, "F");

  doc.setFillColor(35, 92, 107);
  doc.roundedRect(MARGIN_X, 8, 54, 8, 4, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(233, 244, 239);
  doc.text("ANALISE AMBIENTAL", MARGIN_X + 27, 13.3, { align: "center" });

  doc.setFontSize(17);
  doc.text("Relatorio de Sobreposicao", MARGIN_X, 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(210, 226, 220);
  doc.text(subtitulo, PAGE_WIDTH - MARGIN_X, 23, { align: "right" });
}

function desenharRodape(doc, paginaAtual, totalPaginas, dataHoje) {
  doc.setDrawColor(220, 229, 225);
  doc.line(MARGIN_X, 286, PAGE_WIDTH - MARGIN_X, 286);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(106, 122, 118);
  doc.text(`Gerado via WebGIS em ${dataHoje}`, MARGIN_X, 291);
  doc.text(`Pagina ${paginaAtual} de ${totalPaginas}`, PAGE_WIDTH - MARGIN_X, 291, {
    align: "right",
  });
}

function desenharCardResumo(doc, x, y, largura, altura, titulo, valor, corRgb) {
  doc.setFillColor(247, 250, 248);
  doc.setDrawColor(222, 231, 227);
  doc.roundedRect(x, y, largura, altura, 5, 5, "FD");

  doc.setFillColor(...corRgb);
  doc.circle(x + 10, y + 10, 2.4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(16, 35, 38);
  doc.text(String(valor), x + 8, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(89, 103, 99);
  doc.text(titulo, x + 8, y + 30);
}

function desenharTabelaHeader(doc, y) {
  doc.setFillColor(235, 241, 238);
  doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, 10, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(16, 35, 38);
  doc.text("Camada analisada", MARGIN_X + 4, y + 6.3);
  doc.text("Situacao", PAGE_WIDTH - MARGIN_X - 4, y + 6.3, { align: "right" });
}

function desenharLinhaResultado(doc, y, resultado, indice) {
  const camadaLinhas = doc.splitTextToSize(normalizarTexto(resultado.camada), 118);
  const alturaLinha = Math.max(11, camadaLinhas.length * 5 + 4);
  const fundo = indice % 2 === 0 ? [250, 252, 251] : [243, 247, 245];
  const statusTexto = resultado.sobreposicao ? "Com sobreposicao" : "Sem sobreposicao";
  const statusCor = resultado.sobreposicao ? [176, 52, 52] : [33, 115, 74];
  const statusBg = resultado.sobreposicao ? [254, 240, 240] : [236, 248, 240];

  doc.setFillColor(...fundo);
  doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, alturaLinha, 3, 3, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(24, 42, 45);
  doc.text(camadaLinhas, MARGIN_X + 4, y + 6);

  const pillWidth = 42;
  const pillX = PAGE_WIDTH - MARGIN_X - pillWidth - 4;
  const pillY = y + (alturaLinha - 7.5) / 2;
  doc.setFillColor(...statusBg);
  doc.roundedRect(pillX, pillY, pillWidth, 7.5, 3.5, 3.5, "F");
  doc.setTextColor(...statusCor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(statusTexto, pillX + pillWidth / 2, pillY + 4.9, { align: "center" });

  return alturaLinha + 2.5;
}

const colorCanvas =
  typeof document !== "undefined" ? document.createElement("canvas") : null;
const colorContext = colorCanvas ? colorCanvas.getContext("2d") : null;

function cssColorToRgb(color, fallback = [80, 94, 90]) {
  if (!colorContext) return fallback;

  colorContext.fillStyle = "#000000";
  colorContext.fillStyle = color;
  const normalizado = colorContext.fillStyle;

  if (normalizado.startsWith("#")) {
    const hex = normalizado.slice(1);
    const valor = hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex;

    return [
      parseInt(valor.slice(0, 2), 16),
      parseInt(valor.slice(2, 4), 16),
      parseInt(valor.slice(4, 6), 16),
    ];
  }

  const match = normalizado.match(/\d+/g);
  if (!match || match.length < 3) return fallback;

  return match.slice(0, 3).map((item) => Number(item));
}

function desenharAmostraLegenda(doc, x, y, estilo) {
  const color = cssColorToRgb(estilo.color, [80, 94, 90]);
  const fillColor = cssColorToRgb(estilo.fillColor || estilo.color, color);
  const weight = Math.max(0.6, Math.min(1.4, Number(estilo.weight || 1)));
  const fillOpacity = estilo.fill === false ? 0 : Number(estilo.fillOpacity || 0);

  doc.setDrawColor(...color);
  doc.setLineWidth(weight);

  if (estilo.dashArray) {
    doc.setLineDashPattern([1.5, 1.2], 0);
  } else {
    doc.setLineDashPattern([], 0);
  }

  if (fillOpacity > 0) {
    const fillAjustado = fillColor.map((canal) =>
      Math.round(255 - (255 - canal) * Math.min(fillOpacity * 2.2, 1))
    );
    doc.setFillColor(...fillAjustado);
    doc.roundedRect(x, y, 8, 4.8, 0.8, 0.8, "FD");
  } else {
    doc.roundedRect(x, y, 8, 4.8, 0.8, 0.8, "S");
  }

  doc.setLineDashPattern([], 0);
}

function desenharLegendaMapa(doc, y, overlayLayers = []) {
  const itens = [
    {
      nome: "Area do CAR",
      estilo: {
        color: "#8f0aa8",
        fillColor: "#c026d3",
        weight: 2.2,
        fillOpacity: 0.08,
      },
    },
    ...overlayLayers.map((camada) => ({
      nome: camada.nome,
      estilo: getEstiloCamada(camada.nome),
    })),
  ];

  const itensUnicos = itens.filter(
    (item, index, arr) => arr.findIndex((atual) => atual.nome === item.nome) === index
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(16, 35, 38);
  doc.text("Legenda", MARGIN_X, y);

  const colunas = 2;
  const larguraColuna = (CONTENT_WIDTH - 8) / colunas;
  const inicioY = y + 7;
  const alturaLinha = 8;

  itensUnicos.forEach((item, index) => {
    const coluna = index % colunas;
    const linha = Math.floor(index / colunas);
    const itemX = MARGIN_X + coluna * larguraColuna;
    const itemY = inicioY + linha * alturaLinha;

    desenharAmostraLegenda(doc, itemX, itemY - 3.5, item.estilo);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(74, 88, 85);
    doc.text(normalizarTexto(item.nome), itemX + 11, itemY);
  });

  return inicioY + Math.ceil(itensUnicos.length / colunas) * alturaLinha;
}

async function capturarMapa() {
  const div = document.getElementById("mapa-pdf");
  if (!div) {
    throw new Error("Elemento mapa-pdf nao encontrado");
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));
  return html2canvas(div, { useCORS: true, scale: 2 });
}

export default async function gerarRelatorioPDF({
  codigoCAR,
  resultados,
  overlayLayers = [],
}) {
  const doc = new jsPDF();
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const codigo = normalizarTexto(codigoCAR || "sem_codigo");
  const resultadosOrdenados = [...(resultados || [])].sort((a, b) => {
    if (a.sobreposicao === b.sobreposicao) return a.camada.localeCompare(b.camada);
    return a.sobreposicao ? -1 : 1;
  });

  const totalCamadas = resultadosOrdenados.length;
  const totalSobrepostas = resultadosOrdenados.filter((item) => item.sobreposicao).length;
  const totalSemSobreposicao = totalCamadas - totalSobrepostas;

  desenharCabecalho(doc, `CAR ${codigo}`);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(74, 88, 85);
  doc.text("Area analisada", MARGIN_X, 40);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(16, 35, 38);
  doc.text(`Codigo CAR ${codigo}`, MARGIN_X, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(74, 88, 85);
  doc.text(`Data da analise: ${dataHoje}`, MARGIN_X, 55);

  const cardY = 64;
  const cardGap = 6;
  const cardWidth = (CONTENT_WIDTH - cardGap * 2) / 3;
  desenharCardResumo(doc, MARGIN_X, cardY, cardWidth, 36, "Camadas verificadas", totalCamadas, [
    52, 127, 106,
  ]);
  desenharCardResumo(
    doc,
    MARGIN_X + cardWidth + cardGap,
    cardY,
    cardWidth,
    36,
    "Com sobreposicao",
    totalSobrepostas,
    [176, 52, 52]
  );
  desenharCardResumo(
    doc,
    MARGIN_X + (cardWidth + cardGap) * 2,
    cardY,
    cardWidth,
    36,
    "Sem sobreposicao",
    totalSemSobreposicao,
    [33, 115, 74]
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(16, 35, 38);
  doc.text("Resultado consolidado", MARGIN_X, 112);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(89, 103, 99);
  doc.text(
    "As camadas com sobreposicao foram priorizadas no topo da tabela para facilitar a triagem tecnica.",
    MARGIN_X,
    118
  );

  let y = 126;
  desenharTabelaHeader(doc, y);
  y += 13;

  resultadosOrdenados.forEach((resultado, indice) => {
    const proximaAltura = Math.max(11, doc.splitTextToSize(normalizarTexto(resultado.camada), 118).length * 5 + 4) + 2.5;
    if (y + proximaAltura > 280) {
      doc.addPage();
      desenharCabecalho(doc, `CAR ${codigo}`);
      y = 38;
      desenharTabelaHeader(doc, y);
      y += 13;
    }

    y += desenharLinhaResultado(doc, y, resultado, indice);
  });

  doc.addPage();
  desenharCabecalho(doc, `CAR ${codigo}`);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(16, 35, 38);
  doc.text("Mapa da area analisada", MARGIN_X, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(89, 103, 99);
  doc.text(
    "Representacao cartografica da geometria utilizada como referencia para a analise ambiental.",
    MARGIN_X,
    46
  );

  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(220, 229, 225);
  doc.roundedRect(MARGIN_X, 52, CONTENT_WIDTH, 130, 6, 6, "FD");

  try {
    const canvas = await capturarMapa();
    const imgData = canvas.toDataURL("image/png");
    doc.addImage(imgData, "PNG", MARGIN_X + 4, 56, CONTENT_WIDTH - 8, 122);
  } catch (error) {
    console.error("Erro ao capturar o mapa:", error);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(176, 52, 52);
    doc.text("Nao foi possivel gerar a imagem do mapa automaticamente.", MARGIN_X + 8, 72);
  }

  const observacoesY = desenharLegendaMapa(doc, 192, overlayLayers) + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(16, 35, 38);
  doc.text("Observacoes", MARGIN_X, observacoesY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(89, 103, 99);
  const observacoes = doc.splitTextToSize(
    "Este relatorio apresenta um panorama de sobreposicao com base nas camadas consultadas no momento da execucao. Recomenda-se validacao tecnica complementar para usos oficiais.",
    CONTENT_WIDTH
  );
  doc.text(observacoes, MARGIN_X, observacoesY + 7);

  const totalPages = doc.internal.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPages; pagina += 1) {
    doc.setPage(pagina);
    desenharRodape(doc, pagina, totalPages, dataHoje);
  }

  doc.save(`relatorio_sobreposicao_${codigo}.pdf`);
}
