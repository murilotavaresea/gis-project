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

function formatarRotuloAtributo(chave) {
  const texto = String(chave || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();

  if (!texto) {
    return "";
  }

  return texto
    .split(/\s+/)
    .map((parte) => {
      if (parte.length <= 3 && parte === parte.toUpperCase()) {
        return parte;
      }

      return parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase();
    })
    .join(" ");
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
        <tr class="custom-popupRow">
          <th class="custom-popupKey">
            <span class="custom-popupLabel">${escapeHtml(formatarRotuloAtributo(chave))}</span>
            <span class="custom-popupField">${escapeHtml(chave)}</span>
          </th>
          <td class="custom-popupValue">
            ${formatarValorAtributo(valor)}
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="custom-popup">
      <div class="custom-popupHeader">Detalhes da Feicao</div>
      <table class="custom-popupTable">
        <tbody>${linhas}</tbody>
      </table>
    </div>
  `;
}
