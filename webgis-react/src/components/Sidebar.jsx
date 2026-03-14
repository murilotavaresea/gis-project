import React, { useState } from "react";

export default function Sidebar({
  isOpen,
  onToggle,
  title = "WebGIS",
  subtitle = "Camadas e Ferramentas",
  logoSrc = "/icons/webgis.svg",
  frameTitle = "Camadas disponiveis",
  children,
}) {
  const [frameOpen, setFrameOpen] = useState(true);

  return (
    <div className={isOpen ? "" : "sidebar-hidden"}>
      <button
        id="toggle-sidebar"
        onClick={onToggle}
        type="button"
        aria-label={isOpen ? "Recolher menu" : "Abrir menu"}
        title={isOpen ? "Recolher" : "Abrir"}
      >
        {isOpen ? "<" : ">"}
      </button>

      <aside id="sidebar" aria-label="Painel lateral">
        <div className="sb-header">
          <div className="sb-brand">
            <img className="sb-logo" src={logoSrc} alt="Logo" />
            <div className="sb-brandText">
              <div className="sb-title">{title}</div>
              <div className="sb-subtitle">{subtitle}</div>
            </div>
          </div>
        </div>

        <div className="sb-content">
          <div className="sb-frame">
            <div className="sb-frameHeader">
              <div className="sb-frameTitle">{frameTitle}</div>

              <button
                className="sb-frameToggle"
                type="button"
                onClick={() => setFrameOpen((v) => !v)}
                aria-label={frameOpen ? "Recolher secao" : "Expandir secao"}
                title={frameOpen ? "Recolher" : "Expandir"}
              >
                <span className={`sb-chevron ${frameOpen ? "open" : ""}`}>{">"}</span>
              </button>
            </div>

            {frameOpen && <div className="sb-frameBody">{children}</div>}
          </div>
        </div>

        <div className="sb-footer">
          <span>Sistema cartografico para analise e monitoramento</span>
        </div>
      </aside>
    </div>
  );
}
