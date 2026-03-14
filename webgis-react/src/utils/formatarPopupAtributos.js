function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatarValorAtributo(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return '<span style="opacity:.65">sem valor</span>';
  }

  if (typeof valor === "object") {
    return escapeHtml(JSON.stringify(valor));
  }

  return escapeHtml(valor);
}

function extrairAtributos(item) {
  if (!item) {
    return {};
  }

  if (item.properties && typeof item.properties === "object") {
    return item.properties;
  }

  if (item.attributes && typeof item.attributes === "object") {
    return item.attributes;
  }

  if (typeof item === "object") {
    return item;
  }

  return { valor: item };
}

export default function formatarPopupAtributos(item) {
  const props = extrairAtributos(item);
  const entradas = Object.entries(props).filter(([, valor]) => valor !== undefined);

  if (entradas.length === 0) {
    return null;
  }

  const linhas = entradas
    .map(
      ([chave, valor]) => `
        <tr>
          <th style="text-align:left; padding:6px 10px; vertical-align:top; border-bottom:1px solid rgba(15,23,42,.08);">
            ${escapeHtml(chave)}
          </th>
          <td style="padding:6px 10px; border-bottom:1px solid rgba(15,23,42,.08);">
            ${formatarValorAtributo(valor)}
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="custom-popup">
      <table style="border-collapse:collapse; min-width:280px; max-width:420px;">
        <tbody>${linhas}</tbody>
      </table>
    </div>
  `;
}
