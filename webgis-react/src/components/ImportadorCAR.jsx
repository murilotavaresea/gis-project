import { useMap } from "react-leaflet";
import L from "leaflet";
import config from "../config";
import { isTemaRemanescenteVegetacaoNativa } from "../utils/coberturaSoloCAR";
import {
  criarRegistroCamadaImportada,
  extrairCodigoCARDeGeoJSON,
} from "../utils/carLayers";

const appMarkerIcon = L.icon({
  iconUrl: "/icons/map-pin.svg",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -24],
});

function isMarcadorAPP(filename = "") {
  return filename.includes("MARCADORES_Area_de_Preservacao_Permanente");
}

export default function ImportadorCAR({
  fileInputRefCAR,
  drawnItemsRef,
  setCamadasImportadas,
  setAreaDoImovelLayer,
  showProcessingOverlay,
  hideProcessingOverlay,
}) {
  const map = useMap();

  const handleImportCAR = async (e) => {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;

    input.value = "";

    const formData = new FormData();
    formData.append("file", file);

    try {
      showProcessingOverlay?.({
        title: "Importando CAR",
        message: "Lendo o arquivo ZIP e organizando as camadas do imovel no mapa.",
      });
      const response = await fetch(`${config.API_BASE_URL}/importar_car`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      const entradas = Object.entries(data);
      const geojsonAreaDoImovel =
        entradas.find(([filename]) => filename.includes("Area_do_Imovel"))?.[1] || null;
      const codigoCARImportado =
        extrairCodigoCARDeGeoJSON(geojsonAreaDoImovel) ||
        entradas.map(([, geojson]) => extrairCodigoCARDeGeoJSON(geojson)).find(Boolean) ||
        "";

      entradas.forEach(([filename, geojson]) => {
        if (!geojson.features) {
          console.warn(`Erro ao importar ${filename}:`, geojson.error);
          return;
        }

        const layer = new L.GeoJSON(geojson, {
          style: (feature) => {
            if (filename.includes("Area_do_Imovel")) return { color: "black", weight: 5, fillOpacity: 0 };
            if (filename.includes("Reserva_Legal")) return { color: "green", weight: 2, fillOpacity: 0.3 };
            if (filename.includes("Area_de_Preservacao_Permanente")) return { color: "red", weight: 2, fillOpacity: 0.3 };
            if (filename.includes("Cobertura_do_Solo")) {
              if (isTemaRemanescenteVegetacaoNativa(feature?.properties?.tema)) {
                return { color: "brown", weight: 2, fillOpacity: 0.3 };
              }
              return { opacity: 0, fillOpacity: 0 };
            }
            return { color: "gray", weight: 1, fillOpacity: 0.1 };
          },
          pointToLayer: (_feature, latlng) => {
            if (isMarcadorAPP(filename)) {
              return L.marker(latlng, { icon: appMarkerIcon });
            }

            return L.circleMarker(latlng, {
              radius: 6,
              color: "#c38f5d",
              weight: 2,
              fillColor: "#f4ede3",
              fillOpacity: 0.95,
            });
          },
          onEachFeature: (feature, layer) => {
            if (
              filename.includes("Cobertura_do_Solo") &&
              !isTemaRemanescenteVegetacaoNativa(feature?.properties?.tema)
            ) {
              return;
            }
            layer.bindPopup(`<b>${filename}</b><br>${feature?.properties?.tema || ""}`);
          }
        });

        layer.addTo(drawnItemsRef.current);

        setCamadasImportadas((prev) => [
          ...prev,
          criarRegistroCamadaImportada({
            nome: filename,
            layer,
            visivel: true,
            carCodigo: codigoCARImportado,
            origem: "car_zip",
          }),
        ]);

        if (filename.includes("Area_do_Imovel")) {
          setAreaDoImovelLayer(layer);
          map.fitBounds(layer.getBounds(), {
            padding: [20, 20],
            maxZoom: 17
          });
        }
      });
    } catch (err) {
      alert("Erro ao importar arquivo do CAR");
      console.error(err);
    } finally {
      hideProcessingOverlay?.();
    }
  };

  return (
    <input
      type="file"
      ref={fileInputRefCAR}
      accept=".zip"
      style={{ display: "none" }}
      onChange={handleImportCAR}
    />
  );
}
