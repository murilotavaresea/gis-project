import { useMap } from "react-leaflet";
import L from "leaflet";
import config from "../config";

export default function ImportadorCAR({
  fileInputRefCAR,
  drawnItemsRef,
  setCamadasImportadas,
  setAreaDoImovelLayer
}) {
  const map = useMap();

  const handleImportCAR = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const resposta = await fetch(`${config.API_BASE_URL}/importar-car`, {
  method: "POST",
  body: formData,
});
      .then((res) => res.json())
      .then((data) => {
        Object.entries(data).forEach(([filename, geojson]) => {
          if (!geojson.features) {
            console.warn(`Erro ao importar ${filename}:`, geojson.error);
            return;
          }

          const layer = new L.GeoJSON(geojson, {
            style: (feature) => {
              const tema = feature?.properties?.tema?.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              if (filename.includes("Area_do_Imovel")) return { color: "black", weight: 5, fillOpacity: 0 };
              if (filename.includes("Reserva_Legal")) return { color: "green", weight: 2, fillOpacity: 0.3 };
              if (filename.includes("Area_de_Preservacao_Permanente")) return { color: "red", weight: 2, fillOpacity: 0.3 };
              if (filename.includes("Cobertura_do_Solo")) {
                if (tema?.includes("Remanescente")) return { color: "brown", weight: 2, fillOpacity: 0.3 };
                return { opacity: 0, fillOpacity: 0 };
              }
              return { color: "gray", weight: 1, fillOpacity: 0.1 };
            },
            onEachFeature: (feature, layer) => {
              const tema = feature?.properties?.tema?.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              if (filename.includes("Cobertura_do_Solo") && !tema?.includes("Remanescente")) return;
              layer.bindPopup(`<b>${filename}</b><br>${feature?.properties?.tema || ""}`);
            }
          });

          layer.addTo(drawnItemsRef.current);

          setCamadasImportadas((prev) => [
            ...prev,
            { nome: filename, layer, visivel: true }
          ]);

          if (filename.includes("Area_do_Imovel")) {
            setAreaDoImovelLayer(layer);
            map.fitBounds(layer.getBounds(), {
              padding: [20, 20],
              maxZoom: 17
            });
          }
        });
      })
      .catch((err) => {
        alert("Erro ao importar arquivo do CAR");
        console.error(err);
      });
  };

  // renderiza o input com ref do App
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
