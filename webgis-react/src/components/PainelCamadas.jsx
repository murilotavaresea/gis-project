import React, { useMemo, useState } from "react";
import formatarNomeCamada from "../utils/formatarNomeCamada";

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

function normalizar(str = "") {
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function ordenarCamadasPorNome(camadas = []) {
  return [...camadas].sort((a, b) =>
    collator.compare(formatarNomeCamada(a), formatarNomeCamada(b))
  );
}

function Section({ title, count, defaultOpen = false, level = 0, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const isNested = level > 0;

  return (
    <div className={`pc-section ${isNested ? "is-nested" : ""}`}>
      <button
        className={`pc-sectionHeader ${isNested ? "is-nested" : ""}`}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <div className="pc-sectionHeaderLeft">
          <span className={`pc-chevron ${open ? "open" : ""}`}>{">"}</span>
          <span className="pc-sectionTitle">{title}</span>
        </div>
        <span className="pc-count">{count}</span>
      </button>

      {open && <div className={`pc-sectionBody ${isNested ? "is-nested" : ""}`}>{children}</div>}
    </div>
  );
}

function ActionIconButton({ title, onClick, iconSrc, size = 18 }) {
  return (
    <button className="pc-iconBtn" title={title} onClick={onClick} type="button">
      <img src={iconSrc} alt={title} style={{ width: size, height: size }} />
    </button>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      className={`pc-toggle ${checked ? "on" : ""}`}
      onClick={onChange}
      aria-pressed={checked}
      title={checked ? "Desativar" : "Ativar"}
    >
      <span className="pc-toggleThumb" />
    </button>
  );
}

function LoadingIndicator() {
  return (
    <span className="pc-loadingBadge" title="Carregando camada" aria-label="Carregando camada">
      <span className="pc-inlineSpinner" />
    </span>
  );
}

function LayerRow({ label, checked, onToggle, right, loading = false }) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle?.();
    }
  };

  return (
    <div className={`pc-layerRow ${loading ? "is-loading" : ""}`}>
      <div
        className="pc-layerLeft"
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        <span className={`pc-dot ${checked ? "on" : ""}`} />
        <span className="pc-layerName" title={label}>
          {label}
        </span>
      </div>

      <div className="pc-layerRight">
        {loading && <LoadingIndicator />}
        <Toggle checked={checked} onChange={onToggle} />
        {right}
      </div>
    </div>
  );
}

export default function PainelCamadas({
  camadas,
  toggleLayer,
  camadasImportadas,
  toggleCamadaImportada,
  removerCamadaImportada,
  exportarCamadaImportada,
  removerTodasCamadasCAR,
  formatarNomeCAR,
  desenhos,
  exportarDesenhoIndividual,
  editarDesenhoIndividual,
  finalizarEdicaoIndividual,
  removerDesenhoIndividual,
  alternarDesenhoParaExportacao,
  removerTodosDesenhos,
  indiceEditando,
  camadasCarregando = {},
}) {
  const [busca, setBusca] = useState("");

  const filtrar = (arr) => {
    if (!busca.trim()) return arr;
    const q = normalizar(busca);

    return arr.filter((camada) => {
      const alvo = `${camada.nome || ""} ${camada.titulo || ""}`;
      return normalizar(alvo).includes(q);
    });
  };

  const externasFiltradas = filtrar(camadas || []);
  const gruposExternos = useMemo(() => {
    const gruposMap = new Map();
    const ordemGrupos = ["Alertas", "Mosaicos", "Fontes Externas", "Imoveis"];

    ordenarCamadasPorNome(externasFiltradas).forEach((camada) => {
      const grupoNome = camada.grupoExterno || "Fontes Externas";
      const subgrupoNome = camada.subgrupoExterno || null;

      if (!gruposMap.has(grupoNome)) {
        gruposMap.set(grupoNome, {
          title: grupoNome,
          camadas: [],
          subgrupos: new Map(),
        });
      }

      const grupo = gruposMap.get(grupoNome);

      if (subgrupoNome) {
        if (!grupo.subgrupos.has(subgrupoNome)) {
          grupo.subgrupos.set(subgrupoNome, []);
        }

        grupo.subgrupos.get(subgrupoNome).push(camada);
        return;
      }

      grupo.camadas.push(camada);
    });

    return [...gruposMap.values()]
      .sort((a, b) => {
        const indiceA = ordemGrupos.indexOf(a.title);
        const indiceB = ordemGrupos.indexOf(b.title);

        if (indiceA !== -1 || indiceB !== -1) {
          const ordemA = indiceA === -1 ? Number.MAX_SAFE_INTEGER : indiceA;
          const ordemB = indiceB === -1 ? Number.MAX_SAFE_INTEGER : indiceB;
          return ordemA - ordemB;
        }

        return collator.compare(a.title, b.title);
      })
      .map((grupo) => ({
        ...grupo,
        subgrupos: [...grupo.subgrupos.entries()]
          .map(([title, camadasDoSubgrupo]) => ({
            title,
            camadas: ordenarCamadasPorNome(camadasDoSubgrupo),
          }))
          .sort((a, b) => collator.compare(a.title, b.title)),
      }));
  }, [externasFiltradas]);
  const totalAtivas = (camadas || []).filter((camada) => camada.visivel).length;
  const resumoItems = [
    `${camadas.length} fontes`,
    `${totalAtivas} ativas`,
    `${camadasImportadas.length + desenhos.length} arquivos locais`,
  ];

  return (
    <div className="pc">
      <div className="pc-header">
        <div className="pc-summaryBar" aria-label="Resumo das camadas">
          {resumoItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <div className="pc-searchRow">
          <div className="pc-search">
            <input
              id="pc-search-input"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar camada..."
            />
          </div>
        </div>
      </div>

      <div className="pc-content">
        <div className="pc-blockTitle">Camadas Externas</div>

        {gruposExternos.map((grupo) => (
          <Section
            key={grupo.title}
            title={grupo.title}
            level={0}
            count={
              grupo.camadas.length +
              grupo.subgrupos.reduce((total, subgrupo) => total + subgrupo.camadas.length, 0)
            }
          >
            {grupo.camadas.map((camada) => (
              <LayerRow
                key={camada.nome}
                label={formatarNomeCamada(camada)}
                checked={!!camada.visivel}
                loading={!!camadasCarregando[camada.nome] && !!camada.visivel}
                onToggle={() => toggleLayer(camada.nome)}
              />
            ))}
            {grupo.subgrupos.map((subgrupo) => (
              <Section
                key={`${grupo.title}-${subgrupo.title}`}
                title={subgrupo.title}
                count={subgrupo.camadas.length}
                level={1}
              >
                {subgrupo.camadas.map((camada) => (
                  <LayerRow
                    key={camada.nome}
                    label={formatarNomeCamada(camada)}
                    checked={!!camada.visivel}
                    loading={!!camadasCarregando[camada.nome] && !!camada.visivel}
                    onToggle={() => toggleLayer(camada.nome)}
                  />
                ))}
              </Section>
            ))}
          </Section>
        ))}
        {externasFiltradas.length === 0 && (
          <div className="pc-empty">Nenhuma camada externa encontrada.</div>
        )}

        <div className="pc-divider" />

        <div className="pc-rowHeader">
          <div>
            <div className="pc-blockTitle">Importadas (CAR)</div>
            <div className="pc-muted">Camadas importadas</div>
          </div>
          <ActionIconButton
            title="Remover todas as camadas CAR"
            onClick={removerTodasCamadasCAR}
            iconSrc="/icons/lixo.png"
            size={18}
          />
        </div>

        <div className="pc-list">
          {camadasImportadas.map((camada, index) => (
            <LayerRow
              key={`${camada.nome}-${index}`}
              label={formatarNomeCAR ? formatarNomeCAR(camada.nome) : camada.nome || "Camada importada"}
              checked={!!camada.visivel}
              onToggle={() => toggleCamadaImportada(camada.nome)}
              right={
                <>
                  {camada.exportavel && (
                    <ActionIconButton
                      title="Exportar camada em KML"
                      onClick={() => exportarCamadaImportada(index)}
                      iconSrc="/icons/download.svg"
                      size={16}
                    />
                  )}
                  <ActionIconButton
                    title="Remover camada"
                    onClick={() => removerCamadaImportada(index)}
                    iconSrc="/icons/lixo.png"
                    size={16}
                  />
                </>
              }
            />
          ))}
          {camadasImportadas.length === 0 && (
            <div className="pc-empty">Nenhuma camada CAR importada ainda.</div>
          )}
        </div>

        <div className="pc-divider" />

        <div className="pc-rowHeader">
          <div>
            <div className="pc-blockTitle">Desenhos Manuais</div>
            <div className="pc-muted">Todos os desenhos</div>
          </div>
          <ActionIconButton
            title="Remover todos os desenhos"
            onClick={removerTodosDesenhos}
            iconSrc="/icons/lixo.png"
            size={18}
          />
        </div>

        <div className="pc-list">
          {desenhos.map((desenho, index) => (
            <div key={`${desenho.tipo}-${index}`} className="pc-layerRow pc-layerRow-desenho">
              <div className="pc-layerMain">
                <div
                  className="pc-layerLeft"
                  onClick={() => alternarDesenhoParaExportacao(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      alternarDesenhoParaExportacao(index);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className={`pc-dot ${desenho.visivel !== false ? "on" : ""}`} />
                  <div className="pc-layerText">
                    <span className="pc-layerName" title={desenho.tipo}>
                      {desenho.tipo}
                    </span>
                  </div>
                </div>

                <div className="pc-layerRight">
                  <Toggle
                    checked={desenho.visivel !== false}
                    onChange={() => alternarDesenhoParaExportacao(index)}
                  />

                  {indiceEditando === index && (
                    <button
                      className="pc-miniBtn"
                      onClick={finalizarEdicaoIndividual}
                      title="Finalizar edicao"
                      type="button"
                    >
                      OK
                    </button>
                  )}

                  <ActionIconButton
                    title="Exportar desenho em KML"
                    onClick={() => exportarDesenhoIndividual(index)}
                    iconSrc="/icons/download.svg"
                    size={16}
                  />

                  <ActionIconButton
                    title="Editar desenho"
                    onClick={() => editarDesenhoIndividual(index)}
                    iconSrc="/icons/pencil-line.svg"
                    size={16}
                  />

                  <ActionIconButton
                    title="Excluir desenho"
                    onClick={() => removerDesenhoIndividual(index)}
                    iconSrc="/icons/lixo.png"
                    size={16}
                  />
                </div>
              </div>

              {desenho.resumo?.valor && (
                <div className={`pc-layerMetaRow ${indiceEditando === index ? "is-live" : ""}`}>
                  {desenho.resumo.rotulo}: {desenho.resumo.valor}
                </div>
              )}
            </div>
          ))}

          {desenhos.length === 0 && (
            <div className="pc-empty">Nenhum desenho manual criado.</div>
          )}
        </div>

        <div className="pc-footerSpace" />
      </div>
    </div>
  );
}
