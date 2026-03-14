import React, { useEffect, useRef, useState } from "react";
import Sortable from "sortablejs";
import "../LayerPanel.css";
import formatarNomeCamada from "../utils/formatarNomeCamada";

export default function LayerPanel({
  camadas,
  toggleLayer,
  bringToFront,
  ordemCamadasAtivas,
  setOrdemCamadasAtivas,
}) {
  const listRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);

  const camadasVisiveis =
    ordemCamadasAtivas.length > 0
      ? ordemCamadasAtivas
          .map((nome) => camadas.find((camada) => camada.nome === nome && camada.visivel))
          .filter(Boolean)
      : camadas.filter((camada) => camada.visivel);

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

          const novaLista = novaOrdem.map((camada) => camada.nome);
          setOrdemCamadasAtivas(novaLista);
          novaOrdem.slice().reverse().forEach((camada) => bringToFront(camada.nome));
        },
      });

      return () => sortable.destroy();
    }
  }, [collapsed, camadasVisiveis, bringToFront, setOrdemCamadasAtivas]);

  return (
    <div id="layer-control" style={{ userSelect: "none" }}>
      <div className="layer-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="layer-headerTitleGroup">
          <span className="layer-headerIcon">
            <img src="/icons/camada.png" alt="Camadas" />
          </span>
          <div>
            <div className="layer-headerTitle">Camadas ativas</div>
            <div className="layer-headerMeta">Ordene por prioridade visual</div>
          </div>
        </div>
        <span className="layer-chip">{camadasVisiveis.length}</span>
      </div>

      {!collapsed && (
        <div className="layer-list" ref={listRef}>
          {camadasVisiveis.length === 0 && (
            <div className="layer-empty">
              Ative uma camada no catalogo lateral para controlar a ordem de exibicao aqui.
            </div>
          )}

          {camadasVisiveis.map((camada) => {
            const label = formatarNomeCamada(camada);

            return (
              <div key={camada.nome} className="layer-item">
                <span className="drag-handle">::</span>
                <span className="layer-itemLabel">{label}</span>
                <button
                  className="layer-close"
                  onClick={() => toggleLayer(camada.nome)}
                  type="button"
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
