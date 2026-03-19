import jsPDF from "jspdf";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 12;
const MARGIN_TOP = 14;
const MARGIN_BOTTOM = 12;
const COLUMN_GAP = 8;
const CARD_WIDTH = (PAGE_WIDTH - MARGIN_X * 2 - COLUMN_GAP) / 2;
const CARD_HEIGHT = 84;
const IMAGE_HEIGHT = 49;
const HEADER_HEIGHT = 24;

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function desenharCabecalho(doc, codigo, dataHoje) {
  doc.setFillColor(12, 44, 52);
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(240, 246, 242);
  doc.text("Relatorio Temporal", MARGIN_X, 14.8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(208, 225, 219);
  doc.text(`CAR ${codigo}`, MARGIN_X, 20.2);
  doc.text(dataHoje, PAGE_WIDTH - MARGIN_X, 20.2, { align: "right" });
}

function desenharRodape(doc, pagina, totalPaginas) {
  doc.setDrawColor(224, 231, 227);
  doc.line(MARGIN_X, PAGE_HEIGHT - 8.6, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 8.6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(108, 120, 116);
  doc.text(`Pagina ${pagina} de ${totalPaginas}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 4.2, {
    align: "right",
  });
}

function ellipsize(doc, text, width, maxLines) {
  const normalized = normalizarTexto(text || "");
  const lines = doc.splitTextToSize(normalized, width);

  if (lines.length <= maxLines) {
    return lines;
  }

  const trimmed = lines.slice(0, maxLines);
  const last = trimmed[maxLines - 1] || "";
  trimmed[maxLines - 1] = `${last.slice(0, Math.max(0, last.length - 3))}...`;
  return trimmed;
}

function desenharLegenda(doc, x, y, label) {
  doc.setDrawColor(143, 10, 168);
  doc.setFillColor(231, 180, 238);
  doc.setLineWidth(0.9);
  doc.roundedRect(x, y - 3.3, 8, 4.8, 0.8, 0.8, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(85, 58, 91);
  doc.text(normalizarTexto(label), x + 11, y);
}

function desenharCard(doc, item, x, y) {
  doc.setFillColor(250, 252, 250);
  doc.setDrawColor(226, 232, 228);
  doc.roundedRect(x, y, CARD_WIDTH, CARD_HEIGHT, 4, 4, "FD");

  desenharLegenda(doc, x + 5, y + 8.2, item.legendLabel || "Poligono do CAR");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.2);
  doc.setTextColor(18, 37, 41);
  const tituloLinhas = ellipsize(doc, item.title || "Imagem temporal", CARD_WIDTH - 10, 2);
  doc.text(tituloLinhas, x + 5, y + 16.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(96, 109, 105);
  const sourceLines = ellipsize(doc, item.sourceLine || "Fonte nao informada", CARD_WIDTH - 10, 1);
  const sourceY = y + 25.2 + Math.max(0, (tituloLinhas.length - 1) * 4.2);
  doc.text(sourceLines, x + 5, sourceY);

  const imageY = y + 33;
  doc.setFillColor(237, 242, 239);
  doc.roundedRect(x + 4.5, imageY, CARD_WIDTH - 9, IMAGE_HEIGHT, 3, 3, "F");

  if (item.imageDataUrl) {
    doc.addImage(item.imageDataUrl, "PNG", x + 4.5, imageY, CARD_WIDTH - 9, IMAGE_HEIGHT);
  }
}

export default async function gerarRelatorioTemporalPDF({
  codigoCAR,
  items = [],
}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const codigo = normalizarTexto(codigoCAR || "sem_codigo");
  const cards = (items || []).filter((item) => item?.imageDataUrl);

  if (cards.length === 0) {
    throw new Error("Nenhuma imagem temporal foi capturada para o relatorio.");
  }

  const usableHeight = PAGE_HEIGHT - HEADER_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
  const rowsPerPage = Math.max(1, Math.floor(usableHeight / (CARD_HEIGHT + 8)));
  const cardsPerPage = rowsPerPage * 2;
  const totalPaginas = Math.max(1, Math.ceil(cards.length / cardsPerPage));

  const renderPage = (pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage();
    }

    desenharCabecalho(doc, codigo, dataHoje);

    const start = pageIndex * cardsPerPage;
    const end = Math.min(cards.length, start + cardsPerPage);
    const pageItems = cards.slice(start, end);

    pageItems.forEach((item, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = MARGIN_X + col * (CARD_WIDTH + COLUMN_GAP);
      const y = HEADER_HEIGHT + MARGIN_TOP + row * (CARD_HEIGHT + 8);
      desenharCard(doc, item, x, y);
    });

    desenharRodape(doc, pageIndex + 1, totalPaginas);
  };

  for (let page = 0; page < totalPaginas; page += 1) {
    renderPage(page);
  }

  doc.save(`relatorio_temporal_${codigo}.pdf`);
}
