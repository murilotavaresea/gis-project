import React, { useMemo } from "react";
import config from "../config";
import { resumirCamadaFonte } from "../utils/externalLayerMetadata";

function agruparFontes(camadas = []) {
  const mapa = new Map();

  camadas.forEach((camada) => {
    const resumo = resumirCamadaFonte(camada, config.GEOSERVER_BASE_URL);
    const chave = [resumo.grupo, resumo.orgao, resumo.servico, resumo.url].join("::");

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        ...resumo,
        quantidade: 0,
        exemplos: [],
      });
    }

    const grupo = mapa.get(chave);
    grupo.quantidade += 1;

    if (!grupo.exemplos.includes(resumo.camada) && grupo.exemplos.length < 4) {
      grupo.exemplos.push(resumo.camada);
    }
  });

  return [...mapa.values()].sort((a, b) => {
    if (a.grupo !== b.grupo) {
      return a.grupo.localeCompare(b.grupo);
    }

    return a.orgao.localeCompare(b.orgao);
  });
}

export default function PainelFontesCamadas({ camadas, onClose, variant = "floating" }) {
  const fontes = useMemo(() => agruparFontes(camadas), [camadas]);
  const externas = fontes.filter((item) => item.grupo === "Fontes Externas");
  const className = variant === "inline" ? "painel-fontes painel-fontesInline" : "painel-fontes";

  return (
    <div className={className}>
      <div className="painel-fontesHeader">
        <div>
          <strong className="painel-fontesTitle">Fontes das camadas</strong>
          <p className="painel-fontesIntro">
            Catalogo consolidado a partir dos metadados atuais do mapa.
          </p>
        </div>
        {onClose && (
          <button className="close-button" onClick={onClose} type="button">
            x
          </button>
        )}
      </div>

      <div className="painel-fontesBody">
        <div className="painel-fontesSection">
          <div className="painel-fontesSectionTitle">Fontes externas</div>
          {externas.map((fonte) => (
            <div key={`${fonte.grupo}-${fonte.orgao}-${fonte.servico}-${fonte.url}`} className="painel-fontesCard">
              <div className="painel-fontesRow">
                <strong>{fonte.orgao}</strong>
                <span className="painel-fontesTag">{fonte.servico}</span>
              </div>
              <div className="painel-fontesMeta">{fonte.quantidade} camadas vinculadas</div>
              <div className="painel-fontesUrl">{fonte.url}</div>
              <div className="painel-fontesLayers">
                {fonte.exemplos.map((nome) => (
                  <span key={nome} className="painel-fontesLayerTag">
                    {nome}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {externas.length === 0 && (
            <div className="painel-fontesCard">
              <div className="painel-fontesMeta">Nenhuma fonte externa catalogada no momento.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
