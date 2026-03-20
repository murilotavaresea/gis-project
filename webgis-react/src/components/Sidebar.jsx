import React from "react";

export default function Sidebar({
  isOpen,
  onToggle,
  title = "WebGIS",
  subtitle = "Camadas e Ferramentas",
  logoSrc = "/icons/Logo-nova.png",
  frameTitle = "Camadas disponiveis",
  sections = [],
  activeSection = "camadas",
  onChangeSection,
  onStartTour,
  children,
}) {
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
        <div className="sb-shell">
          <div className="sb-rail" aria-label="Navegacao do painel lateral">
            <div className="sb-railTop">
              {sections.map((section) => (
                <button
                  key={section.id}
                  className={`sb-railBtn ${activeSection === section.id ? "active" : ""}`}
                  data-tour={`sidebar-${section.id}`}
                  type="button"
                  onClick={() => onChangeSection?.(section.id)}
                  title={section.label}
                  aria-label={section.label}
                  aria-pressed={activeSection === section.id}
                >
                  {section.icon ? (
                    <img src={section.icon} alt={section.label} />
                  ) : (
                    <span>{section.shortLabel || section.label.slice(0, 1)}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="sb-main">
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
                </div>

                <div className="sb-frameBody">{children}</div>
              </div>
            </div>

            <div className="sb-footer">
              <span>Sistema cartografico para analise e monitoramento</span>
              {onStartTour && (
                <button
                  type="button"
                  className="sb-tourBtn"
                  data-tour="sidebar-tour"
                  onClick={onStartTour}
                >
                  Tour guiado
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
