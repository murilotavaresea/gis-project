import React from "react";

const ferramentasBarra = [
  {
    titulo: "Desenhar",
    icone: "/icons/pencil-line.svg",
    descricao: "Abre as ferramentas de desenho para criar polígonos, linhas, pontos e exportar os desenhos em KML.",
  },
  {
    titulo: "Medir",
    icone: "/icons/ruler-dimension-line.svg",
    descricao: "Permite medir área e distância diretamente no mapa com resultado imediato.",
  },
  {
    titulo: "Importar arquivo",
    icone: "/icons/file-input.svg",
    descricao: "Carrega arquivos espaciais externos, como GeoJSON, KML, GPX ou ZIP com shapefile.",
  },
  {
    titulo: "Importar CAR",
    icone: "/icons/novo-car.png",
    descricao: "Importa o ZIP do CAR e organiza as camadas do imóvel no painel lateral.",
  },
  {
    titulo: "Buscar CAR",
    icone: "/icons/buscar-car.png",
    descricao: "Consulta um CAR direto no serviço oficial quando você não possui o arquivo local.",
  },
  {
    titulo: "Área beneficiável",
    icone: "/icons/plant.svg",
    descricao: "Gera a área aproveitável após descontar as restrições e aplicar as regras espaciais do estado.",
  },
  {
    titulo: "Sobreposição",
    icone: "/icons/clipboard-minus.svg",
    descricao: "Monta o relatório de sobreposição com as camadas incidentes e o mapa da análise.",
  },
];

const blocos = [
  {
    titulo: "Como usar o mapa",
    descricao:
      "Este é o fluxo mais comum para consultar informações, ligar camadas de referência e trabalhar com um CAR importado.",
    itens: [
      "Abra a aba Catálogo para ativar camadas internas e externas do mapa.",
      "Use a busca para localizar rapidamente uma camada pelo nome.",
      "Depois de ativar uma camada, ela passa a aparecer no mapa e pode ser comparada com o seu CAR.",
    ],
  },
  {
    titulo: "Importação e análise do CAR",
    descricao:
      "As ferramentas da barra direita ajudam a trazer o imóvel, verificar restrições e gerar resultados prontos para conferência.",
    itens: [
      "Importar CAR carrega o arquivo ZIP do SICAR e adiciona APP, área do imóvel, remanescente, reserva legal e outras camadas no painel.",
      "Buscar CAR consulta um imóvel diretamente no serviço oficial quando você não tiver o ZIP em mãos.",
      "Verificar sobreposição gera um relatório com as camadas externas e internas que incidem sobre o CAR ou no entorno analisado.",
      "Gerar área beneficiável aplica a diferença sobre as áreas impeditivas e, no Mato Grosso, faz a interseção final com a APF.",
    ],
  },
  {
    titulo: "Para que serve cada aba",
    descricao:
      "A faixa lateral concentra acessos rápidos para navegar pelo painel sem misturar catálogo, metadados e orientações.",
    itens: [
      "Catálogo: organiza camadas do banco, fontes externas, camadas importadas do CAR e desenhos manuais.",
      "Fontes: mostra a origem das camadas externas para facilitar auditoria, conferência técnica e rastreio de dados.",
      "Ajuda: resume o funcionamento da plataforma, o fluxo de análise e a função das principais ferramentas.",
      "Quando a área beneficiável for gerada, você pode exportar essa camada diretamente no painel lateral.",
    ],
  },
];

export default function PainelAjuda() {
  return (
    <div className="help-panel">
      <div className="help-hero">
        <strong>Guia de uso da plataforma</strong>
        <p>
          Aqui você encontra um resumo objetivo do que cada parte do LiroGis faz, quando usar
          cada ferramenta e como seguir o fluxo de análise do CAR do início ao resultado final.
        </p>
      </div>

      <section className="help-section">
        <h3>Barra lateral direita</h3>
        <p>
          Estes são os botões principais de ação do mapa. As miniaturas abaixo ajudam a localizar
          cada ferramenta visualmente na interface.
        </p>
        <div className="help-toolList">
          {ferramentasBarra.map((ferramenta) => (
            <div key={ferramenta.titulo} className="help-toolCard">
              <span className="help-toolIcon">
                <img src={ferramenta.icone} alt={ferramenta.titulo} />
              </span>
              <div className="help-toolText">
                <strong>{ferramenta.titulo}</strong>
                <span>{ferramenta.descricao}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {blocos.map((bloco) => (
        <section key={bloco.titulo} className="help-section">
          <h3>{bloco.titulo}</h3>
          <p>{bloco.descricao}</p>
          <ul>
            {bloco.itens.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
