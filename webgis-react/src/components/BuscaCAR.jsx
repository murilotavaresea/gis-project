import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import L from "leaflet";
import tokml from "tokml";
import config from "../config";
import { criarRegistroCamadaImportada, normalizarCodigoCAR } from "../utils/carLayers";
import {
  CAR_CONSULTA_LAYERS,
  CAR_CONSULTA_WFS_URL,
  montarNomeConsultaCAR,
} from "../utils/consultaCarLayers";

const CAR_CONSULTA_BATCH_SIZE = 4;

export default function BuscaCAR({
  map,
  drawnItemsRef,
  onClose,
  visivel = true,
  setCarLayerBusca,
  setCamadasImportadas,
  setAreaDoImovelLayer,
  showProcessingOverlay,
  hideProcessingOverlay,
}) {
  const [codigoCAR, setCodigoCAR] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [buscaCompleta, setBuscaCompleta] = useState(false);
  const [resumoBuscaCompleta, setResumoBuscaCompleta] = useState("");
  const painelRef = useRef(null);
  const carLayerRef = useRef(null);

  useEffect(() => {
    if (!visivel || !painelRef.current) {
      return undefined;
    }

    const node = painelRef.current;
    L.DomEvent.disableClickPropagation(node);
    L.DomEvent.disableScrollPropagation(node);

    return () => {
      L.DomEvent.off(node);
    };
  }, [visivel]);

  const montarUrlWfs = ({ baseUrl, typeName, codigo, version = "2.0.0" }) => {
    const params = new URLSearchParams({
      base: baseUrl,
      service: "WFS",
      version,
      request: "GetFeature",
      typeNames: typeName,
      outputFormat: "application/json",
      CQL_FILTER: `cod_imovel='${codigo}'`,
    });

    return `${config.PROXY_WFS_BASE_URL}?${params.toString()}`;
  };

  const obterEstiloCamadaConsulta = (camada) => {
    const nome = `${camada?.typeName || ""} ${camada?.rotulo || ""}`.toLowerCase();

    if (nome.includes("arl") || nome.includes("reserva")) {
      return { color: "#2f7d32", weight: 2, fillOpacity: 0.22 };
    }

    if (nome.includes("app")) {
      return { color: "#d64b3a", weight: 2, fillOpacity: 0.2 };
    }

    if (nome.includes("vegetacao")) {
      return { color: "#7a5a2c", weight: 2, fillOpacity: 0.2 };
    }

    if (nome.includes("embarg")) {
      return { color: "#8f3a3a", weight: 2, fillOpacity: 0.28 };
    }

    if (nome.includes("servidao")) {
      return { color: "#6f7f96", weight: 2, fillOpacity: 0.18 };
    }

    return { color: "#6f89a5", weight: 2, fillOpacity: 0.16 };
  };

  const consultarCamadasCompletasCAR = async (codigoNormalizado) => {
    if (!setCamadasImportadas) {
      return [];
    }

    const camadasEncontradas = [];
    const falhas = [];

    setResumoBuscaCompleta("Consultando camadas subsidiarias...");

    const consultarCamada = async (camada) => {
      try {
        const url = montarUrlWfs({
          baseUrl: CAR_CONSULTA_WFS_URL,
          typeName: camada.typeName,
          codigo: codigoNormalizado,
        });
        const { data } = await axios.get(url, { timeout: 60000 });

        if (!Array.isArray(data?.features) || data.features.length === 0) {
          return null;
        }

        const layer = new L.GeoJSON(data, {
          style: obterEstiloCamadaConsulta(camada),
        });

        layer.addTo(drawnItemsRef.current);

        return criarRegistroCamadaImportada({
          nome: montarNomeConsultaCAR(camada, codigoNormalizado),
          layer,
          visivel: true,
          exportavel: true,
          carCodigo: codigoNormalizado,
          tipoCamada: camada.tipoCamada,
          rotulo: camada.rotulo,
          origem: "car_consulta_publica",
        });
      } catch (error) {
        console.warn(`Falha ao consultar ${camada.typeName}:`, error);
        falhas.push(camada.rotulo);
        return null;
      }
    };

    for (let index = 0; index < CAR_CONSULTA_LAYERS.length; index += CAR_CONSULTA_BATCH_SIZE) {
      const lote = CAR_CONSULTA_LAYERS.slice(index, index + CAR_CONSULTA_BATCH_SIZE);
      const registros = await Promise.all(lote.map(consultarCamada));
      camadasEncontradas.push(...registros.filter(Boolean));
      setResumoBuscaCompleta(
        `Consultando camadas subsidiarias... ${Math.min(
          index + lote.length,
          CAR_CONSULTA_LAYERS.length
        )}/${CAR_CONSULTA_LAYERS.length}`
      );
    }

    setCamadasImportadas((prev) => {
      const mantidas = prev.filter((camadaAtual) => {
        const mesmaConsulta =
          ["car_consulta_publica", "car_consulta_status"].includes(camadaAtual?.origem) &&
          normalizarCodigoCAR(camadaAtual?.carCodigo) === codigoNormalizado;

        if (mesmaConsulta) {
          drawnItemsRef.current.removeLayer(camadaAtual.layer);
        }

        return !mesmaConsulta;
      });

      return [
        ...mantidas,
        ...camadasEncontradas,
        criarRegistroCamadaImportada({
          nome: `${codigoNormalizado}_Consulta_Completa_CAR`,
          rotulo: "Consulta completa CAR",
          layer: null,
          visivel: false,
          exportavel: false,
          carCodigo: codigoNormalizado,
          tipoCamada: "controle_consulta_car",
          origem: "car_consulta_status",
        }),
      ];
    });

    const mensagem =
      camadasEncontradas.length > 0
        ? `${camadasEncontradas.length} camada(s) subsidiaria(s) encontrada(s).`
        : "Nenhuma camada subsidiaria encontrada para este CAR.";

    setResumoBuscaCompleta(falhas.length ? `${mensagem} ${falhas.length} falharam.` : mensagem);
    return camadasEncontradas;
  };

  const registrarAreaImovelImportada = ({ codigoNormalizado, layer }) => {
    if (!setCamadasImportadas || !layer) {
      return;
    }

    setCamadasImportadas((prev) => {
      const mantidas = prev.filter((camadaAtual) => {
        const mesmaArea =
          camadaAtual?.tipoCamada === "area_imovel" &&
          camadaAtual?.origem === "car_busca" &&
          normalizarCodigoCAR(camadaAtual?.carCodigo) === codigoNormalizado;

        if (mesmaArea && camadaAtual.layer !== layer) {
          drawnItemsRef.current.removeLayer(camadaAtual.layer);
        }

        return !mesmaArea;
      });

      return [
        ...mantidas,
        criarRegistroCamadaImportada({
          nome: `${codigoNormalizado}_Area_do_Imovel.geojson`,
          rotulo: "Area do Imovel",
          layer,
          visivel: true,
          exportavel: true,
          carCodigo: codigoNormalizado,
          tipoCamada: "area_imovel",
          origem: "car_busca",
        }),
      ];
    });
  };

  const buscarCAR = async () => {
    const codigoNormalizado = normalizarCodigoCAR(codigoCAR);
    if (!codigoNormalizado) return;

    if (codigoNormalizado !== codigoCAR) {
      setCodigoCAR(codigoNormalizado);
    }

    setBuscando(true);

    const uf = codigoNormalizado.substring(0, 2).toLowerCase();
    const ufsValidas = [
      "ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma",
      "mg", "ms", "mt", "pa", "pb", "pe", "pi", "pr", "rj", "rn",
      "ro", "rr", "rs", "sc", "se", "sp", "to",
    ];

    if (!ufsValidas.includes(uf)) {
      alert("UF invalida no codigo do CAR.");
      setBuscando(false);
      return;
    }

    setResumoBuscaCompleta("");

    const wfsUrl = "https://geoserver.car.gov.br/geoserver/sicar/ows";
    const typeName = `sicar:sicar_imoveis_${uf}`;
    const url =
      `${wfsUrl}?service=WFS&version=1.0.0&request=GetFeature` +
      `&typeName=${typeName}&outputFormat=application/json` +
      `&CQL_FILTER=cod_imovel='${codigoNormalizado}'`;

    try {
      showProcessingOverlay?.({
        title: "Buscando area do CAR",
        message: "Consultando o servico oficial e preparando a geometria para visualizacao.",
      });

      const { data } = await axios.get(url);

      if (!data.features || data.features.length === 0) {
        alert("Imovel nao encontrado.");
        return;
      }

      if (carLayerRef.current) {
        drawnItemsRef.current.removeLayer(carLayerRef.current);
      }

      const layer = new L.GeoJSON(data, {
        style: {
          color: "#c38f5d",
          weight: 3,
          fillOpacity: 0,
        },
      });

      layer.addTo(drawnItemsRef.current);
      map.fitBounds(layer.getBounds());
      carLayerRef.current = layer;

      if (setCarLayerBusca) {
        setCarLayerBusca(layer);
      }

      if (setAreaDoImovelLayer) {
        setAreaDoImovelLayer(layer);
      }

      registrarAreaImovelImportada({
        codigoNormalizado,
        layer,
      });

      if (buscaCompleta) {
        await consultarCamadasCompletasCAR(codigoNormalizado);
      }

      onClose?.();
    } catch (error) {
      console.error("Erro na busca WFS:", error);
      alert("Erro ao buscar CAR.");
    } finally {
      setBuscando(false);
      hideProcessingOverlay?.();
    }
  };

  const limparCAR = () => {
    const codigoNormalizado = normalizarCodigoCAR(codigoCAR);
    const areaBuscaLayer = carLayerRef.current;

    if (areaBuscaLayer) {
      drawnItemsRef.current.removeLayer(areaBuscaLayer);
      carLayerRef.current = null;
    }

    if (setCarLayerBusca) {
      setCarLayerBusca(null);
    }

    if (setAreaDoImovelLayer) {
      setAreaDoImovelLayer(null);
    }

    if (setCamadasImportadas && codigoNormalizado) {
      setCamadasImportadas((prev) =>
        prev.filter((camadaAtual) => {
          const mesmaBusca =
            ["car_busca", "car_consulta_publica"].includes(camadaAtual?.origem) &&
            normalizarCodigoCAR(camadaAtual?.carCodigo) === codigoNormalizado;

          if (mesmaBusca && camadaAtual.layer !== areaBuscaLayer) {
            drawnItemsRef.current.removeLayer(camadaAtual.layer);
          }

          return !mesmaBusca;
        })
      );
    }
  };

  const exportarCAR = () => {
    if (!carLayerRef.current) return;

    const geojson = carLayerRef.current.toGeoJSON();
    const kml = tokml(geojson);
    const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${codigoCAR}.kml`;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div
      ref={painelRef}
      className="painel-busca-car"
      style={{ display: visivel ? "block" : "none" }}
    >
      <div className="topo">
        <strong>Buscar CAR</strong>
        <button className="fechar" onClick={onClose} type="button">
          x
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          buscarCAR();
        }}
      >
        <input
          type="text"
          placeholder="Digite o codigo do CAR"
          value={codigoCAR}
          onChange={(e) => setCodigoCAR(normalizarCodigoCAR(e.target.value))}
        />
        <label className="busca-car-opcao">
          <input
            type="checkbox"
            checked={buscaCompleta}
            onChange={(e) => setBuscaCompleta(e.target.checked)}
          />
          <span>Buscar camadas completas do CAR</span>
        </label>
        {resumoBuscaCompleta && (
          <div className="busca-car-status">{resumoBuscaCompleta}</div>
        )}
        <button disabled={buscando} type="submit">
          {buscando ? "Buscando..." : "Buscar"}
        </button>
        <button onClick={limparCAR} disabled={!carLayerRef.current} type="button">
          Limpar
        </button>
        <button onClick={exportarCAR} disabled={!carLayerRef.current} type="button">
          Exportar
        </button>
      </form>
    </div>
  );
}
