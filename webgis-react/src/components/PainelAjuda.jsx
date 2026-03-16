import React from "react";

const ferramentasBarra = [
  {
    titulo: "Desenhar",
    icone: "/icons/pencil-line.svg",
    descricao: "Abre as ferramentas de desenho para criar poligonos, linhas, pontos e exportar os desenhos em KML.",
  },
  {
    titulo: "Medir",
    icone: "/icons/ruler-dimension-line.svg",
    descricao: "Permite medir area e distancia diretamente no mapa com resultado imediato.",
  },
  {
    titulo: "Importar arquivo",
    icone: "/icons/file-input.svg",
    descricao: "Carrega arquivos espaciais externos, como GeoJSON, KML, GPX ou ZIP com shapefile.",
  },
  {
    titulo: "Importar CAR",
    icone: "/icons/novo-car.png",
    descricao: "Importa o ZIP do CAR e organiza as camadas do imovel no painel lateral.",
  },
  {
    titulo: "Buscar CAR",
    icone: "/icons/buscar-car.png",
    descricao: "Consulta um CAR direto no servico oficial quando voce nao possui o arquivo local.",
  },
  {
    titulo: "Area beneficiavel",
    icone: "/icons/plant.svg",
    descricao: "Gera a area aproveitavel apos descontar as restricoes e aplicar as regras espaciais do estado.",
  },
  {
    titulo: "Sobreposicao",
    icone: "/icons/clipboard-minus.svg",
    descricao: "Monta o relatorio de sobreposicao com as camadas incidentes e o mapa da analise.",
  },
];

const blocos = [
  {
    titulo: "Como usar o mapa",
    descricao:
      "Este e o fluxo mais comum para consultar informacoes, ligar camadas de referencia e trabalhar com um CAR importado.",
    itens: [
      "Abra a aba Catalogo para ativar camadas internas e externas do mapa.",
      "Use a busca para localizar rapidamente uma camada pelo nome.",
      "Depois de ativar uma camada, ela passa a aparecer no mapa e pode ser comparada com o seu CAR.",
    ],
  },
  {
    titulo: "Importacao e analise do CAR",
    descricao:
      "As ferramentas da barra direita ajudam a trazer o imovel, verificar restricoes e gerar resultados prontos para conferencia.",
    itens: [
      "Importar CAR carrega o arquivo ZIP do SICAR e adiciona APP, area do imovel, remanescente, reserva legal e outras camadas no painel.",
      "Buscar CAR consulta um imovel diretamente no servico oficial quando voce nao tiver o ZIP em maos.",
      "Verificar sobreposicao gera um relatorio com as camadas externas e internas que incidem sobre o CAR ou no entorno analisado.",
      "Gerar area beneficiavel aplica a diferenca sobre as areas impeditivas e, no Mato Grosso, faz a interseccao final com a APF.",
    ],
  },
  {
    titulo: "Para que serve cada aba",
    descricao:
      "A faixa lateral concentra acessos rapidos para navegar pelo painel sem misturar catalogo, metadados e orientacoes.",
    itens: [
      "Catalogo: organiza camadas do banco, fontes externas, camadas importadas do CAR e desenhos manuais.",
      "Fontes: mostra a origem das camadas externas para facilitar auditoria, conferencia tecnica e rastreio de dados.",
      "Ajuda: resume o funcionamento da plataforma, o fluxo de analise e a funcao das principais ferramentas.",
      "Quando a area beneficiavel for gerada, voce pode exportar essa camada diretamente no painel lateral.",
    ],
  },
];

export default function PainelAjuda() {
  return (
    <div className="help-panel">
      <div className="help-hero">
        <strong>Guia de uso da plataforma</strong>
        <p>
          Aqui voce encontra um resumo objetivo do que cada parte do Atlas WebGIS faz, quando usar
          cada ferramenta e como seguir o fluxo de analise do CAR do inicio ao resultado final.
        </p>
      </div>

      <section className="help-section">
        <h3>Barra lateral direita</h3>
        <p>
          Estes sao os botoes principais de acao do mapa. As miniaturas abaixo ajudam a localizar
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
