import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import * as turf from "@turf/turf";
import L from "leaflet";
import formatarNomeCamada from "../utils/formatarNomeCamada";
import { resumirCamadaFonte } from "../utils/externalLayerMetadata";
import gerarRelatorioTemporalPDF from "./gerarRelatorioTemporalPDF";
import MapaRelatorioTemporal from "./MapaRelatorioTemporal";

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

function ehCamadaTemporalElegivel(camada) {
  if (!camada?.externa) {
    return false;
  }

  const isRaster = camada.sourceType === "wms" || camada.sourceType === "xyz";
  return isRaster && (
    camada.grupoExterno === "Mosaicos" ||
    camada.temporalReportEnabled === true
  );
}

function normalizarAreaAnalise(geojson) {
  const features = geojson?.type === "FeatureCollection" ? geojson.features : [geojson];
  const featuresValidas = (features || []).filter((feature) => feature?.geometry);

  if (!featuresValidas.length) {
    return null;
  }

  if (featuresValidas.length === 1) {
    return featuresValidas[0];
  }

  try {
    const uniao = turf.union(turf.featureCollection(featuresValidas));
    if (uniao?.geometry) {
      return {
        ...uniao,
        properties: {
          ...(featuresValidas[0]?.properties || {}),
        },
      };
    }
  } catch (error) {
    console.warn("Falha ao unificar geometrias do CAR para o relatorio temporal:", error);
  }

  return featuresValidas[0];
}

function ordenarCamadas(camadas = []) {
  return [...camadas].sort((a, b) => {
    const subgrupoA = a.subgrupoExterno || "";
    const subgrupoB = b.subgrupoExterno || "";
    const grupoDiff = collator.compare(subgrupoA, subgrupoB);

    if (grupoDiff !== 0) {
      return grupoDiff;
    }

    return collator.compare(formatarNomeCamada(a), formatarNomeCamada(b));
  });
}

function moveItem(lista, fromIndex, toIndex) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= lista.length ||
    toIndex >= lista.length ||
    fromIndex === toIndex
  ) {
    return lista;
  }

  const clone = [...lista];
  const [item] = clone.splice(fromIndex, 1);
  clone.splice(toIndex, 0, item);
  return clone;
}

export default function RelatorioTemporalTool({
  camadas,
  carLayerBusca,
  showProcessingOverlay,
  hideProcessingOverlay,
}) {
  const [painelAberto, setPainelAberto] = useState(false);
  const [camadasSelecionadas, setCamadasSelecionadas] = useState([]);
  const [capturaData, setCapturaData] = useState(null);
  const [mostrarMapaCaptura, setMostrarMapaCaptura] = useState(false);
  const [gerando, setGerando] = useState(false);
  const capturaResolverRef = useRef(null);
  const capturaTimeoutRef = useRef(null);
  const painelRef = useRef(null);
  const selecionadasRef = useRef(null);
  const listaRef = useRef(null);
  const toolIconStyle = { width: "22px", height: "22px" };

  const camadasElegiveis = useMemo(
    () => ordenarCamadas((camadas || []).filter(ehCamadaTemporalElegivel)),
    [camadas]
  );

  const mapaCamadasElegiveis = useMemo(
    () => new Map(camadasElegiveis.map((camada) => [camada.nome, camada])),
    [camadasElegiveis]
  );

  const selecoesValidas = useMemo(
    () => camadasSelecionadas.filter((nome) => mapaCamadasElegiveis.has(nome)),
    [camadasSelecionadas, mapaCamadasElegiveis]
  );

  const itensSelecionados = useMemo(
    () => selecoesValidas.map((nome) => mapaCamadasElegiveis.get(nome)).filter(Boolean),
    [mapaCamadasElegiveis, selecoesValidas]
  );

  useEffect(() => {
    if (selecoesValidas.join("|") !== camadasSelecionadas.join("|")) {
      setCamadasSelecionadas(selecoesValidas);
    }
  }, [camadasSelecionadas, selecoesValidas]);

  useEffect(() => {
    if (!carLayerBusca) {
      setPainelAberto(false);
    }
  }, [carLayerBusca]);

  useEffect(() => {
    if (!painelAberto) {
      return undefined;
    }

    const nodes = [painelRef.current, selecionadasRef.current, listaRef.current].filter(Boolean);
    nodes.forEach((node) => {
      L.DomEvent.disableClickPropagation(node);
      L.DomEvent.disableScrollPropagation(node);
    });

    return () => {
      nodes.forEach((node) => {
        L.DomEvent.off(node);
      });
    };
  }, [painelAberto]);

  const limparMapaCaptura = () => {
    if (capturaTimeoutRef.current) {
      window.clearTimeout(capturaTimeoutRef.current);
      capturaTimeoutRef.current = null;
    }

    if (capturaResolverRef.current) {
      capturaResolverRef.current();
      capturaResolverRef.current = null;
    }

    setMostrarMapaCaptura(false);
    setCapturaData(null);
  };

  const prepararMapaCaptura = (payload) =>
    new Promise((resolve) => {
      if (capturaTimeoutRef.current) {
        window.clearTimeout(capturaTimeoutRef.current);
      }

      capturaResolverRef.current = () => {
        if (capturaTimeoutRef.current) {
          window.clearTimeout(capturaTimeoutRef.current);
          capturaTimeoutRef.current = null;
        }

        capturaResolverRef.current = null;
        resolve();
      };

      capturaTimeoutRef.current = window.setTimeout(() => {
        if (capturaResolverRef.current) {
          capturaResolverRef.current();
        }
      }, 4500);

      setCapturaData(payload);
      setMostrarMapaCaptura(true);
    });

  const handleMapaCapturaReady = () => {
    if (capturaResolverRef.current) {
      capturaResolverRef.current();
    }
  };

  const capturarImagemTemporal = async (payload) => {
    await prepararMapaCaptura(payload);

    const element = document.getElementById("mapa-temporal-pdf");
    if (!element) {
      throw new Error("Elemento do mapa temporal nao encontrado.");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 260));
    const canvas = await html2canvas(element, {
      useCORS: true,
      scale: 2,
      backgroundColor: "#e7efeb",
    });

    limparMapaCaptura();
    return canvas.toDataURL("image/png");
  };

  const toggleSelecaoCamada = (nomeCamada) => {
    setCamadasSelecionadas((estadoAtual) => {
      if (estadoAtual.includes(nomeCamada)) {
        return estadoAtual.filter((nome) => nome !== nomeCamada);
      }

      return [...estadoAtual, nomeCamada];
    });
  };

  const moverSelecao = (nomeCamada, direcao) => {
    setCamadasSelecionadas((estadoAtual) => {
      const index = estadoAtual.indexOf(nomeCamada);
      return moveItem(estadoAtual, index, index + direcao);
    });
  };

  const abrirPainel = () => {
    if (!carLayerBusca?.toGeoJSON) {
      alert("Use o botao 'Buscar CAR' antes de gerar o relatorio temporal.");
      return;
    }

    setPainelAberto((estadoAtual) => !estadoAtual);
  };

  const gerarRelatorio = async () => {
    if (!carLayerBusca?.toGeoJSON) {
      alert("Busque um CAR antes de gerar o relatorio temporal.");
      return;
    }

    if (itensSelecionados.length < 2) {
      alert("Selecione pelo menos duas imagens para comparacao.");
      return;
    }

    const areaGeoJSON = normalizarAreaAnalise(carLayerBusca.toGeoJSON());
    if (!areaGeoJSON?.geometry) {
      alert("Nao foi possivel preparar a geometria do CAR para o relatorio.");
      return;
    }

    setGerando(true);

    try {
      const cards = [];

      for (let index = 0; index < itensSelecionados.length; index += 1) {
        const camada = itensSelecionados[index];
        const resumoFonte = resumirCamadaFonte(camada);
        const tituloCamada = formatarNomeCamada(camada);

        showProcessingOverlay?.({
          title: "Gerando relatorio temporal",
          message: `Capturando imagem ${index + 1} de ${itensSelecionados.length}: ${tituloCamada}.`,
        });

        const imageDataUrl = await capturarImagemTemporal({
          areaGeoJSON,
          layer: camada,
        });

        cards.push({
          title: tituloCamada,
          sourceLine: `${resumoFonte.orgao} - ${resumoFonte.servico}`,
          legendLabel: "Poligono do CAR",
          imageDataUrl,
        });
      }

      showProcessingOverlay?.({
        title: "Gerando relatorio temporal",
        message: "Montando o PDF em formato vertical com as imagens lado a lado.",
      });

      await gerarRelatorioTemporalPDF({
        codigoCAR:
          areaGeoJSON.properties?.cod_imovel ||
          areaGeoJSON.properties?.inscricaocar ||
          "sem_codigo",
        items: cards,
      });

      setPainelAberto(false);
    } catch (error) {
      console.error("Erro ao gerar relatorio temporal:", error);
      alert("Nao foi possivel gerar o relatorio temporal no momento.");
    } finally {
      limparMapaCaptura();
      hideProcessingOverlay?.();
      setGerando(false);
    }
  };

  return (
    <>
      <button
        className={painelAberto ? "is-active" : ""}
        onClick={abrirPainel}
        title="Relatorio temporal"
        type="button"
        aria-pressed={painelAberto}
      >
        <img src="/icons/layers.svg" alt="Relatorio temporal" style={toolIconStyle} />
      </button>

      {painelAberto && (
        <div className="painel-relatorio-temporal" ref={painelRef}>
          <div className="painel-relatorio-topo">
            <div>
              <strong>Relatorio temporal</strong>
              <p>Selecione as imagens do mosaico para comparar lado a lado no PDF.</p>
            </div>
            <button className="fechar" onClick={() => setPainelAberto(false)} type="button">
              x
            </button>
          </div>

          <div className="painel-relatorio-status">
            <span className="painel-relatorio-badge">CAR obrigatorio</span>
            <span className="painel-relatorio-muted">
              {carLayerBusca ? "CAR carregado e pronto para destaque no mapa." : "Busque um CAR para continuar."}
            </span>
          </div>

          <div className="painel-relatorio-corpo">
            <div className="painel-relatorio-bloco painel-relatorio-blocoCompacto">
              <div className="painel-relatorio-subtitulo">
                Selecionadas ({itensSelecionados.length})
              </div>
              {itensSelecionados.length > 0 ? (
                <div className="painel-relatorio-selecionadas" ref={selecionadasRef}>
                  {itensSelecionados.map((camada, index) => (
                    <div key={camada.nome} className="painel-relatorio-chip">
                      <div className="painel-relatorio-chipConteudo">
                        <span className="painel-relatorio-ordem">{index + 1}</span>
                        <strong>{formatarNomeCamada(camada)}</strong>
                      </div>
                      <div className="painel-relatorio-chipAcoes">
                        <button
                          onClick={() => moverSelecao(camada.nome, -1)}
                          disabled={index === 0}
                          type="button"
                          title="Mover para cima"
                        >
                          ^
                        </button>
                        <button
                          onClick={() => moverSelecao(camada.nome, 1)}
                          disabled={index === itensSelecionados.length - 1}
                          type="button"
                          title="Mover para baixo"
                        >
                          v
                        </button>
                        <button
                          onClick={() => toggleSelecaoCamada(camada.nome)}
                          type="button"
                          title="Remover da comparacao"
                        >
                          x
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="painel-relatorio-vazio">
                  Escolha pelo menos duas imagens para habilitar o PDF.
                </div>
              )}
            </div>

            <div className="painel-relatorio-bloco painel-relatorio-blocoCresce">
              <div className="painel-relatorio-subtitulo">
                Imagens disponiveis ({camadasElegiveis.length})
              </div>
              <div className="painel-relatorio-lista" ref={listaRef}>
                {camadasElegiveis.map((camada) => {
                  const selected = selecoesValidas.includes(camada.nome);
                  const resumoFonte = resumirCamadaFonte(camada);

                  return (
                    <label
                      key={camada.nome}
                      className={`painel-relatorio-item ${selected ? "is-selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelecaoCamada(camada.nome)}
                      />
                      <div className="painel-relatorio-itemBody">
                        <div className="painel-relatorio-itemTop">
                          <strong>{formatarNomeCamada(camada)}</strong>
                          {selected && (
                            <span className="painel-relatorio-indice">
                              #{selecoesValidas.indexOf(camada.nome) + 1}
                            </span>
                          )}
                        </div>
                        <span>{resumoFonte.orgao} - {resumoFonte.servico}</span>
                        {camada.subgrupoExterno && (
                          <small>{camada.subgrupoExterno}</small>
                        )}
                      </div>
                    </label>
                  );
                })}

                {camadasElegiveis.length === 0 && (
                  <div className="painel-relatorio-vazio">
                    Nenhuma camada raster temporal do grupo Mosaicos foi encontrada.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="painel-relatorio-acoes">
            <button
              onClick={gerarRelatorio}
              disabled={gerando || itensSelecionados.length < 2}
              type="button"
            >
              {gerando ? "Gerando..." : "Gerar PDF temporal"}
            </button>
          </div>
        </div>
      )}

      {mostrarMapaCaptura && capturaData?.areaGeoJSON && capturaData?.layer && (
        <MapaRelatorioTemporal
          geojson={capturaData.areaGeoJSON}
          layer={capturaData.layer}
          onReady={handleMapaCapturaReady}
        />
      )}
    </>
  );
}
