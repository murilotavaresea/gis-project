import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getEstiloCamada } from "../utils/estiloCamadas";

const PAGE_WIDTH = 210;
const MARGIN_X = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const HEADER_HEIGHT = 28;

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function desenharCabecalho(doc, subtitulo) {
  doc.setFillColor(10, 43, 54);
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT, "F");

  doc.setFillColor(41, 108, 126);
  doc.roundedRect(MARGIN_X, 7.8, 54, 7.2, 3.6, 3.6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.4);
  doc.setTextColor(233, 244, 239);
  doc.text("ANALISE AMBIENTAL", MARGIN_X + 27, 12.8, { align: "center" });

  doc.setFontSize(16);
  doc.text("Relatorio de Sobreposicao", MARGIN_X, 22.4);

  const subtituloLinhas = doc.splitTextToSize(normalizarTexto(subtitulo), 74);
  const subtituloYInicial = 14.3 - ((subtituloLinhas.length - 1) * 3.2) / 2;

  doc.setFont("courier", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(210, 226, 220);
  subtituloLinhas.forEach((linha, index) => {
    doc.text(linha, PAGE_WIDTH - MARGIN_X, subtituloYInicial + index * 3.2, {
      align: "right",
    });
  });
}

function desenharRodape(doc, paginaAtual, totalPaginas, dataHoje) {
  doc.setDrawColor(220, 229, 225);
  doc.line(MARGIN_X, 286, PAGE_WIDTH - MARGIN_X, 286);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(106, 122, 118);
  doc.text(`Gerado via LiroGis em ${dataHoje}`, MARGIN_X, 291);
  doc.text(`Pagina ${paginaAtual} de ${totalPaginas}`, PAGE_WIDTH - MARGIN_X, 291, {
    align: "right",
  });
}

function desenharCardResumo(doc, x, y, largura, altura, titulo, valor, corRgb) {
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(226, 234, 230);
  doc.roundedRect(x, y, largura, altura, 3.2, 3.2, "FD");

  doc.setFillColor(...corRgb);
  doc.circle(x + 6.6, y + 6.1, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(16, 35, 38);
  doc.text(String(valor), x + 6.4, y + 12.9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  doc.setTextColor(89, 103, 99);
  doc.text(titulo, x + 6.4, y + 18.1);
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

function obterLinhasDetalheResultado(doc, resultado, largura) {
  const detalhes = Array.isArray(resultado.detalhes) ? resultado.detalhes : [];
  const texto = detalhes.filter(Boolean).join(" | ");

  if (!texto) {
    return [];
  }

  return doc.splitTextToSize(normalizarTexto(texto), largura);
}

function desenharLinhaResultado(doc, y, resultado, indice) {
  const camadaLinhas = doc.splitTextToSize(normalizarTexto(resultado.camada), 118);
  const detalheLinhas = obterLinhasDetalheResultado(doc, resultado, 118);
  const alturaLinha = Math.max(
    11,
    camadaLinhas.length * 5 + detalheLinhas.length * 4 + (detalheLinhas.length ? 7 : 4)
  );
  const fundo = indice % 2 === 0 ? [250, 252, 251] : [243, 247, 245];
  const statusTexto = resultado.erroConsulta
    ? "Nao verificada"
    : resultado.statusTexto ||
      (resultado.sobreposicao
        ? "Com sobreposicao"
        : "Sem sobreposicao");
  const statusCor = resultado.erroConsulta
    ? [160, 102, 24]
    : resultado.sobreposicao
      ? [176, 52, 52]
      : [33, 115, 74];
  const statusBg = resultado.erroConsulta
    ? [255, 246, 230]
    : resultado.sobreposicao
      ? [254, 240, 240]
      : [236, 248, 240];

  doc.setFillColor(...fundo);
  doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, alturaLinha, 3, 3, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(24, 42, 45);
  doc.text(camadaLinhas, MARGIN_X + 4, y + 6);

  if (detalheLinhas.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(76, 96, 92);
    doc.text(detalheLinhas, MARGIN_X + 4, y + 6 + camadaLinhas.length * 5);
  }

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

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : [128, 128, 128];
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

  // html2canvas perde a sincronia entre tile layer e SVG quando o elemento está
  // em top/left muito negativos (≥ 9999px). A solução é mover o div para (0,0)
  // durante a captura e restaurar depois — o conteúdo do mapa não é afetado.
  const saved = {
    position: div.style.position,
    top:      div.style.top,
    left:     div.style.left,
  };
  div.style.position = "fixed";
  div.style.top      = "0px";
  div.style.left     = "0px";

  await new Promise((resolve) => setTimeout(resolve, 250));

  let canvas;
  try {
    canvas = await html2canvas(div, {
      useCORS: true,
      scale: 2,
      scrollX: 0,
      scrollY: 0,
      logging: false,
    });
  } finally {
    div.style.position = saved.position;
    div.style.top      = saved.top;
    div.style.left     = saved.left;
  }

  return canvas;
}

function desenharNorteSeta(doc, cx, cy) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(120, 138, 132);
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, 5.5, "FD");

  // Haste vertical
  doc.setDrawColor(22, 33, 30);
  doc.setLineWidth(0.55);
  doc.line(cx, cy + 3.8, cx, cy - 1.5);

  // Triângulo norte (escuro): ápice (cx, cy-4.5), base (cx±2, cy-1.5)
  doc.setFillColor(22, 33, 30);
  doc.lines([[2, 3], [-4, 0]], cx, cy - 4.5, [1, 1], "F", true);

  // "N" branco dentro do triângulo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4);
  doc.setTextColor(255, 255, 255);
  doc.text("N", cx, cy - 2.6, { align: "center" });
}

function calcularEscala(bounds, larguraMM) {
  if (!bounds) return null;
  const latC = (bounds.north + bounds.south) / 2;
  const lngExt = bounds.east - bounds.west;
  const mPorGrau = 111320 * Math.cos(latC * Math.PI / 180);
  const mapWidthM = lngExt * mPorGrau;
  const mPorMM = mapWidthM / larguraMM;
  const alvo = mPorMM * 28;
  const mag = Math.pow(10, Math.floor(Math.log10(alvo)));
  const opcoes = [1, 2, 5, 10].map((f) => f * mag);
  const dist = opcoes.find((v) => v >= alvo / 2) ?? opcoes[opcoes.length - 1];
  return { distanciaMetros: dist, larguraMM: dist / mPorMM };
}

function desenharEscala(doc, x, y, larguraMM, distanciaMetros) {
  const label = distanciaMetros >= 1000
    ? `${distanciaMetros / 1000} km`
    : `${distanciaMetros} m`;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(120, 138, 132);
  doc.setLineWidth(0.3);
  doc.roundedRect(x - 2, y - 5.5, larguraMM + 4, 8.5, 1.5, 1.5, "FD");

  doc.setDrawColor(22, 33, 30);
  doc.setLineWidth(0.6);
  doc.line(x, y, x + larguraMM, y);
  doc.line(x, y - 1.8, x, y + 1.8);
  doc.line(x + larguraMM, y - 1.8, x + larguraMM, y + 1.8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.setTextColor(22, 33, 30);
  doc.text("0", x, y - 3, { align: "center" });
  doc.text(label, x + larguraMM, y - 3, { align: "center" });
}

const SWATCH_W   = 5;
const SWATCH_GAP = 3;
const NAME_X     = MARGIN_X + SWATCH_W + SWATCH_GAP;
const BAR_MAX_W  = CONTENT_WIDTH - SWATCH_W - SWATCH_GAP - 2;
const ROW_H      = 11;

function desenharSecaoMapBiomas(doc, dadosMapBiomas, codigoCAR, imagemMapBiomas = null) {
  if (!dadosMapBiomas || !dadosMapBiomas.lulc) return;

  const meta = dadosMapBiomas.meta || {};
  const lulc = dadosMapBiomas.lulc;
  const anos = Object.keys(lulc).sort((a, b) => parseInt(b) - parseInt(a));

  for (const ano of anos) {
    const dadosAno = lulc[ano];
    if (!dadosAno || dadosAno.erro || dadosAno.aviso) continue;

    const maxClasses = imagemMapBiomas ? 10 : 18;
    const classes = Object.entries(dadosAno)
      .filter(([, v]) => typeof v.ha === "number" && v.ha > 0)
      .sort((a, b) => b[1].ha - a[1].ha)
      .slice(0, maxClasses);

    if (classes.length === 0) continue;

    doc.addPage();
    desenharCabecalho(doc, `CAR ${normalizarTexto(codigoCAR)}`);

    let y = 38;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(16, 35, 38);
    doc.text("Cobertura e Uso do Solo", MARGIN_X, y);

    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(89, 103, 99);
    doc.text(
      normalizarTexto(
        `MapBiomas Brasil — Colecao 10.1  |  Ano: ${ano}  |  Resolucao: 30 m`
      ),
      MARGIN_X,
      y
    );

    y += 5;
    if (meta.area_total_ha) {
      doc.text(
        `Area do imovel: ${meta.area_total_ha} ha`,
        MARGIN_X,
        y
      );
      y += 5;
    }

    y += 5;

    // Imagem do mapa de cobertura (gerada pelo backend via rasterio COG)
    if (imagemMapBiomas?.png_base64 && !imagemMapBiomas.erro) {
      const aspecto = imagemMapBiomas.altura_px / imagemMapBiomas.largura_px;
      const imgW = CONTENT_WIDTH;
      const imgH = Math.min(imgW * aspecto, 75);

      doc.setFillColor(245, 248, 246);
      doc.setDrawColor(210, 225, 218);
      doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, imgH + 4, 3, 3, "FD");

      doc.addImage(
        `data:image/png;base64,${imagemMapBiomas.png_base64}`,
        "PNG",
        MARGIN_X + 2,
        y + 2,
        imgW - 4,
        imgH
      );
      y += imgH + 12;
    }

    const maxHa = classes[0][1].ha || 1;
    const totalAnalisado = classes.reduce((s, [, v]) => s + v.ha, 0);

    classes.forEach(([nome, info]) => {
      if (y + ROW_H > 278) return;

      const rgb = hexToRgb(info.cor || "#aaaaaa");

      // Swatch
      doc.setFillColor(...rgb);
      doc.roundedRect(MARGIN_X, y - 3.8, SWATCH_W, SWATCH_W, 0.8, 0.8, "F");

      // Nome da classe
      const nomeNorm = normalizarTexto(nome);
      const nomeLinhas = doc.splitTextToSize(nomeNorm, 110);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(24, 42, 45);
      doc.text(nomeLinhas[0], NAME_X, y);

      // Valor ha (direita)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(16, 35, 38);
      doc.text(
        `${info.ha.toFixed(1)} ha`,
        PAGE_WIDTH - MARGIN_X - 22,
        y,
        { align: "right" }
      );

      // Percentual (extrema direita)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(89, 103, 99);
      doc.text(
        `${info.pct.toFixed(1)}%`,
        PAGE_WIDTH - MARGIN_X,
        y,
        { align: "right" }
      );

      // Trilho da barra
      const barY = y + 2;
      doc.setFillColor(230, 236, 233);
      doc.roundedRect(NAME_X, barY, BAR_MAX_W, 2.8, 1.4, 1.4, "F");

      // Preenchimento proporcional
      const fillW = Math.max(1, (info.ha / maxHa) * BAR_MAX_W);
      doc.setFillColor(...rgb);
      doc.roundedRect(NAME_X, barY, fillW, 2.8, 1.4, 1.4, "F");

      y += ROW_H;
    });

    // Total analisado
    y += 4;
    doc.setFillColor(240, 245, 242);
    doc.setDrawColor(210, 225, 218);
    doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, 9, 2.5, 2.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(50, 70, 64);
    doc.text(
      `Total analisado: ${totalAnalisado.toFixed(1)} ha`,
      MARGIN_X + 4,
      y + 5.8
    );

    // Nota metodológica
    y += 17;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(120, 135, 130);
    const nota = doc.splitTextToSize(
      normalizarTexto(
        `Dados extraidos da Colecao 10.1 do MapBiomas Brasil via HTTP Range Request sobre ` +
        `Cloud-Optimized GeoTIFFs publicos. Resolucao espacial: 30 m (Landsat). ` +
        `Licenca: CC-BY 4.0. Citar: MapBiomas Project, ${ano}.`
      ),
      CONTENT_WIDTH
    );
    doc.text(nota, MARGIN_X, y);
  }
}

export default async function gerarRelatorioPDF({
  codigoCAR,
  resultados,
  overlayLayers = [],
  dadosMapBiomas = null,
  imagemMapBiomas = null,
  mapBounds = null,
  map = null,
}) {
  const doc = new jsPDF();
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const codigo = normalizarTexto(codigoCAR || "sem_codigo");
  const resultadosOrdenados = [...(resultados || [])].sort((a, b) => {
    const prioridade = (item) => {
      if (item.sobreposicao) return 0;
      if (item.erroConsulta) return 1;
      return 2;
    };

    const diferencaPrioridade = prioridade(a) - prioridade(b);
    if (diferencaPrioridade !== 0) return diferencaPrioridade;
    return a.camada.localeCompare(b.camada);
  });

  const totalCamadas = resultadosOrdenados.length;
  const totalSobrepostas = resultadosOrdenados.filter((item) => item.sobreposicao).length;
  const totalNaoVerificadas = resultadosOrdenados.filter((item) => item.erroConsulta).length;
  const totalSemSobreposicao = totalCamadas - totalSobrepostas - totalNaoVerificadas;
  const codigoTitulo = `CAR ${codigo}`;

  desenharCabecalho(doc, codigoTitulo);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(86, 101, 97);
  doc.text("Area analisada", MARGIN_X, 40.5);

  const codigoLinhas = doc.splitTextToSize(`Codigo ${codigoTitulo}`, CONTENT_WIDTH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14.5);
  doc.setTextColor(16, 35, 38);
  doc.text(codigoLinhas, MARGIN_X, 47.5);

  const blocoCodigoAltura = codigoLinhas.length * 5.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(74, 88, 85);
  doc.text(`Data da analise: ${dataHoje}`, MARGIN_X, 47.5 + blocoCodigoAltura + 2.5);

  const cardY = 47.5 + blocoCodigoAltura + 9;
  const cardGap = 3;
  const cardWidth = (CONTENT_WIDTH - cardGap * 2) / 3;
  const cardHeight = 20.5;
  desenharCardResumo(doc, MARGIN_X, cardY, cardWidth, cardHeight, "Camadas verificadas", totalCamadas, [
    52, 127, 106,
  ]);
  desenharCardResumo(
    doc,
    MARGIN_X + cardWidth + cardGap,
    cardY,
    cardWidth,
    cardHeight,
    "Com sobreposicao",
    totalSobrepostas,
    [176, 52, 52]
  );
  desenharCardResumo(
    doc,
    MARGIN_X + (cardWidth + cardGap) * 2,
    cardY,
    cardWidth,
    cardHeight,
    "Sem sobreposicao",
    totalSemSobreposicao,
    [33, 115, 74]
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(16, 35, 38);
  const resultadoHeaderY = cardY + cardHeight + 16;
  doc.text("Resultado consolidado", MARGIN_X, resultadoHeaderY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(89, 103, 99);
  doc.text(
    "As camadas com sobreposicao foram priorizadas no topo da tabela para facilitar a triagem tecnica.",
    MARGIN_X,
    resultadoHeaderY + 6
  );

  if (totalNaoVerificadas > 0) {
    doc.setTextColor(160, 102, 24);
    doc.text(
      `${totalNaoVerificadas} camada(s) nao puderam ser verificadas por indisponibilidade ou erro de consulta.`,
      MARGIN_X,
      resultadoHeaderY + 12
    );
  }

  let y = totalNaoVerificadas > 0 ? resultadoHeaderY + 20 : resultadoHeaderY + 14;
  desenharTabelaHeader(doc, y);
  y += 13;

  resultadosOrdenados.forEach((resultado, indice) => {
    const camadaLinhas = doc.splitTextToSize(normalizarTexto(resultado.camada), 118);
    const detalheLinhas = obterLinhasDetalheResultado(doc, resultado, 118);
    const proximaAltura = Math.max(
      11,
      camadaLinhas.length * 5 + detalheLinhas.length * 4 + (detalheLinhas.length ? 7 : 4)
    ) + 2.5;
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

  const MAP_IMG_X = MARGIN_X + 4;
  const MAP_IMG_Y = 56;
  const MAP_IMG_W = CONTENT_WIDTH - 8;
  const MAP_IMG_H = 122;

  try {
    const canvas = await capturarMapa();
    const imgData = canvas.toDataURL("image/png");
    doc.addImage(imgData, "PNG", MAP_IMG_X, MAP_IMG_Y, MAP_IMG_W, MAP_IMG_H);

    // Rosa dos ventos (canto superior direito)
    desenharNorteSeta(doc, MAP_IMG_X + MAP_IMG_W - 9, MAP_IMG_Y + 10);

    // Barra de escala (canto inferior esquerdo)
    const escala = calcularEscala(mapBounds, MAP_IMG_W);
    if (escala) {
      desenharEscala(
        doc,
        MAP_IMG_X + 8,
        MAP_IMG_Y + MAP_IMG_H - 6,
        escala.larguraMM,
        escala.distanciaMetros
      );
    }
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

  desenharSecaoMapBiomas(doc, dadosMapBiomas, codigoCAR, imagemMapBiomas);

  const totalPages = doc.internal.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPages; pagina += 1) {
    doc.setPage(pagina);
    desenharRodape(doc, pagina, totalPages, dataHoje);
  }

  doc.save(`relatorio_sobreposicao_${codigo}.pdf`);
}
