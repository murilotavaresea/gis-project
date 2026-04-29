import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import L from "leaflet";
import tokml from "tokml";
import formatarPopupAtributos from "../utils/formatarPopupAtributos";
import { normalizarCodigoCAR } from "../utils/carLayers";

export default function BuscaCAR({
  map,
  drawnItemsRef,
  onClose,
  visivel = true,
  setCarLayerBusca,
  showProcessingOverlay,
  hideProcessingOverlay,
}) {
  const [codigoCAR, setCodigoCAR] = useState("");
  const [buscando, setBuscando] = useState(false);
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
        onEachFeature: (feature, geoLayer) => {
          const props = feature.properties || {};
          geoLayer.bindPopup(
            formatarPopupAtributos(feature) ||
              `<b>${props.inscricaocar || props.cod_imovel || ""}</b><br>${props.municipio || ""}`
          );
        },
      });

      layer.addTo(drawnItemsRef.current);
      map.fitBounds(layer.getBounds());
      carLayerRef.current = layer;

      if (setCarLayerBusca) {
        setCarLayerBusca(layer);
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
    if (carLayerRef.current) {
      drawnItemsRef.current.removeLayer(carLayerRef.current);
      carLayerRef.current = null;
    }

    if (setCarLayerBusca) {
      setCarLayerBusca(null);
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
