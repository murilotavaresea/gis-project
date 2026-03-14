import React from 'react';
import L from 'leaflet';
import * as turf from '@turf/turf';

export default function GerarAreaBeneficiavel({
  map,
  drawnItemsRef,
  camadasImportadas,
  setCamadasImportadas
}) {
  const gerar = async () => {
    if (!map || !drawnItemsRef.current) {
      console.warn("⚠️ Referências do mapa ou itens desenhados não estão disponíveis.");
      return;
    }

    console.log("✅ Iniciando geração da Área Beneficiável...");

    const obterCamada = (nomeParcial) =>
      camadasImportadas.find(c => c.nome.includes(nomeParcial));

    const camadaImovel = obterCamada("Area_do_Imovel");
    const camadaRL = obterCamada("Reserva_Legal");
    const camadaAPP = obterCamada("Area_de_Preservacao_Permanente");
    const camadaRemanescente = obterCamada("Remanescente");
    const camadaServidao = obterCamada("Servidao_Administrativa");



    const isValidFeature = (feature) =>
  feature &&
  feature.type === 'Feature' &&
  feature.geometry &&
  typeof feature.geometry.type === 'string' &&
  ['Polygon', 'MultiPolygon'].includes(feature.geometry.type) &&
  Array.isArray(feature.geometry.coordinates) &&
  feature.geometry.coordinates.length > 0;



    if (!camadaImovel) {
      alert("❌ Área do imóvel não encontrada.");
      return;
    }

    let geoImovel = camadaImovel.layer.toGeoJSON();

    // 🔁 Carregar e intersectar com APF dinamicamente (como em VerificarSobreposicao)
    const carregarAPFeIntersectar = async (geoImovel) => {
      try {
        const buffer = turf.buffer(geoImovel.features?.[0] || geoImovel, 1, { units: 'kilometers' });
        const bbox = turf.bbox(buffer);

        const wfsUrl = `http://localhost:8080/geoserver/webgis/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=webgis:APF&bbox=${bbox.join(',')},EPSG:4326&outputFormat=application/json`;

        const res = await fetch(wfsUrl);
        const data = await res.json();

        console.log("📦 APF carregada via WFS:", data);

        

       const intersectadas = [];

const geoFeatureImovel = geoImovel.features?.[0] || geoImovel;

if (!isValidFeature(geoFeatureImovel)) {
  console.error("❌ Geometria do imóvel inválida ou ausente.");
  return null;
}

for (const f of data.features) {
  if (!isValidFeature(f)) {
    console.warn("⚠️ Ignorando feature APF inválida:", f);
    continue;
  }

  try {
    const intersecao = turf.intersect(geoFeatureImovel, f);
    if (intersecao && intersecao.geometry) {
      intersectadas.push(intersecao);
    }
  } catch (e) {
    console.warn("⚠️ Erro ao intersectar uma feature válida da APF:", e);
  }
}







        if (intersectadas.length === 0) {
          console.warn("⚠️ Nenhuma interseção válida com APF.");
          return null;
        }

        const uniao = intersectadas.reduce((acc, feat) => {
          try {
            return acc ? turf.union(acc, feat) : feat;
          } catch (e) {
            console.warn("⚠️ Erro ao unir interseções:", e);
            return acc;
          }
        }, null);

        return uniao;
      } catch (e) {
        console.error("❌ Erro ao buscar/intersectar APF:", e);
        return null;
      }
    };

    const apfGeo = await carregarAPFeIntersectar(geoImovel);
    if (apfGeo) {
      geoImovel = apfGeo;
      console.log("✅ Interseção com APF aplicada.");
    }

    // 🔎 Identificar áreas impeditivas
    const impeditivas = [];
    [camadaRL, camadaAPP, camadaRemanescente, camadaServidao].forEach(camada => {
      if (camada) {
        const geo = camada.layer.toGeoJSON();
        if (geo?.features?.length || geo?.geometry) {
          impeditivas.push(geo);
        }
      }
    });

    // 🧠 Envia para backend para calcular diferença
    try {
      const response = await fetch("http://localhost:5000/gerar-area-beneficiavel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imovel: geoImovel.features?.[0] || geoImovel,
          impeditivas,
          apf: null,
          estado: "NA" // opcional, pois agora usamos bbox
        })
      });

      const resultado = await response.json();

      if (resultado.erro) {
        alert("Erro ao calcular diferença: " + resultado.erro);
        return;
      }

      const geoFinal = resultado;

      const novaLayer = new L.GeoJSON(geoFinal, {
        style: { color: "#27ae60", weight: 1, fillOpacity: 0.5 }
      });

      novaLayer.addTo(drawnItemsRef.current);
      map.fitBounds(novaLayer.getBounds());

      setCamadasImportadas(prev => [
        ...prev,
        {
          nome: "Área Beneficiável",
          layer: novaLayer,
          visivel: true
        }
      ]);

      console.log("✅ Área Beneficiável adicionada com sucesso.");
    } catch (e) {
      console.error("❌ Erro ao gerar área beneficiável:", e);
      alert("Erro ao gerar área beneficiável.");
    }
  };

  return (
    <button onClick={gerar} title="Gerar Área Beneficiável">
      <img src="/icons/plant.svg" alt="Área Beneficiável" style={{ width: '24px', height: '24px' }} />
    </button>
  );
}
