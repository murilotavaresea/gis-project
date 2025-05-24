import React, { useEffect, useRef, useState } from "react";
import Sortable from "sortablejs";
import "../LayerPanel.css";

export default function LayerPanel({ camadas, toggleLayer, bringToFront, ordemCamadasAtivas, setOrdemCamadasAtivas }) {
  const listRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);

  const camadasVisiveis = ordemCamadasAtivas.length > 0
    ? ordemCamadasAtivas
        .map(nome => camadas.find(c => c.nome === nome && c.visivel))
        .filter(Boolean)
    : camadas.filter(c => c.visivel);

  useEffect(() => {
    if (listRef.current && !collapsed && camadasVisiveis.length > 0) {
      const sortable = Sortable.create(listRef.current, {
        animation: 150,
        handle: ".drag-handle",
        onEnd: (evt) => {
          const from = evt.oldIndex;
          const to = evt.newIndex;

          if (from == null || to == null) return;

          const novaOrdem = [...camadasVisiveis];
          const [moved] = novaOrdem.splice(from, 1);
          novaOrdem.splice(to, 0, moved);

          const novaLista = novaOrdem.map(c => c.nome);
          setOrdemCamadasAtivas(novaLista);
          novaOrdem.slice().reverse().forEach(c => bringToFront(c.nome));
        }
      });

      return () => sortable.destroy();
    }
  }, [collapsed, camadasVisiveis, bringToFront, setOrdemCamadasAtivas]);

  return (
    <div id="layer-control" style={{ userSelect: "none" }}>
      <div
        className="layer-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        📊 Camadas Ativas
      </div>

      {!collapsed && (
        <div className="layer-list" ref={listRef}>
          {camadasVisiveis.map((camada) => {
            const nomeLimpo = camada.nome.includes(":") ? camada.nome.split(":")[1] : camada.nome;
            return (
              <div key={camada.nome} className="layer-item">
                <span className="drag-handle">⠿</span>
                <span style={{ flex: 1, textAlign: "left", marginLeft: 8 }}>{nomeLimpo}</span>
                <button onClick={() => toggleLayer(camada.nome)}>✖</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
