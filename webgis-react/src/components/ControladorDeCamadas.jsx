import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export default function ControladorDeCamadas({ nomeCamada, setCamadas }) {
  const map = useMap();

  useEffect(() => {
    const atualizarCamada = () => {
      const zoom = map.getZoom();

      // só processa se o zoom for suficiente
      if (zoom < 8) {
        console.log(`🔒 Zoom muito baixo (${zoom}) para carregar ${nomeCamada}`);
        setCamadas(old =>
          old.map(c => c.nome === nomeCamada ? { ...c, data: null } : c)
        );
        return;
      }

      // só carrega se a camada estiver visível
      setCamadas(old => {
        const camada = old.find(c => c.nome === nomeCamada);
        if (!camada?.visivel) return old;

        const bounds = map.getBounds();
        const bbox = [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth()
        ].join(',');

        const url = `http://localhost:8080/geoserver/webgis/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${nomeCamada}&bbox=${bbox}&outputFormat=application/json`;

        fetch(url)
          .then(res => res.json())
          .then(data => {
            setCamadas(prev =>
              prev.map(c => c.nome === nomeCamada ? { ...c, data } : c)
            );
          })
          .catch(err => console.error(`❌ Erro ao carregar ${nomeCamada}:`, err));

        return old;
      });
    };

    map.on('moveend', atualizarCamada);
    atualizarCamada(); // primeira vez

    return () => {
      map.off('moveend', atualizarCamada);
    };
  }, [map, nomeCamada, setCamadas]);

  return null;
}
