import React from "react";

export default function PainelCamadas({
  camadas,
  toggleLayer,
  camadasImportadas,
  toggleCamadaImportada,
  removerCamadaImportada,
  removerTodasCamadasCAR,
  formatarNomeCAR,
  desenhos,
  editarDesenhoIndividual,
  finalizarEdicaoIndividual,
  removerDesenhoIndividual,
  alternarDesenhoParaExportacao,
  removerTodosDesenhos,
  indiceEditando
}) {
  return (
    <>
      <h2>Camadas</h2>

      <h3>Banco de Dados</h3>
      <ul>
        {camadas
          .filter(c =>
            !c.nome.toUpperCase().includes('MAPBIOMAS') &&
            !c.nome.split(':').pop().toUpperCase().startsWith('FPB') &&
            !['ASSENTAMENTO', 'QUILOMBOLA', 'TERRAS INDÍGENAS', 'UNIDADES DE CONSERVAÇÃO'].includes(c.nome.split(':').pop().toUpperCase())
          )
          .map((c, index) => {
            const nomeLimpo = c.nome.includes(':') ? c.nome.split(':')[1] : c.nome;
            return (
              <li key={index}>
                <label>
                  <input type="checkbox" checked={c.visivel} onChange={() => toggleLayer(c.nome)} />
                  {nomeLimpo}
                </label>
              </li>
            );
          })}
      </ul>

      <details style={{ marginTop: '10px' }}>
        <summary><strong>Florestas Públicas (FPB)</strong></summary>
        <ul>
          {camadas
            .filter(c => c.nome.split(':').pop().toUpperCase().startsWith('FPB'))
            .map((c, index) => {
              const nomeLimpo = c.nome.split(':').pop();
              return (
                <li key={index}>
                  <label>
                    <input type="checkbox" checked={c.visivel} onChange={() => toggleLayer(c.nome)} />
                    {nomeLimpo}
                  </label>
                </li>
              );
            })}
        </ul>
      </details>

      <details style={{ marginTop: '10px' }}>
        <summary><strong>Mapbiomas </strong></summary>
        <ul>
          {camadas
            .filter(c => c.nome.toUpperCase().includes('MAPBIOMAS'))
            .map((c, index) => {
              const nomeLimpo = c.nome.includes(':') ? c.nome.split(':')[1] : c.nome;
              return (
                <li key={index}>
                  <label>
                    <input type="checkbox" checked={c.visivel} onChange={() => toggleLayer(c.nome)} />
                    {nomeLimpo}
                  </label>
                </li>
              );
            })}
        </ul>
      </details>

      <details style={{ marginTop: '10px' }}>
        <summary><strong>Áreas Protegidas</strong></summary>
        <ul>
          {camadas
            .filter(c =>
              ['ASSENTAMENTO', 'QUILOMBOLA', 'TERRAS INDÍGENAS', 'UNIDADES DE CONSERVAÇÃO'].includes(
                c.nome.split(':').pop().toUpperCase()
              )
            )
            .map((c, index) => {
              const nomeLimpo = c.nome.split(':').pop();
              return (
                <li key={index}>
                  <label>
                    <input type="checkbox" checked={c.visivel} onChange={() => toggleLayer(c.nome)} />
                    {nomeLimpo}
                  </label>
                </li>
              );
            })}
        </ul>
      </details>


      <h3>Importadas (CAR)</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Camadas importadas</span>
        <button onClick={removerTodasCamadasCAR}>
          <img src="/icons/lixo.png" alt="Remover" style={{ width: '20.5px', height: '20.5px' }} />
        </button>
      </div>
      <ul>
        {camadasImportadas.map((c, index) => (
          <li key={index}>
            <label>
              <input type="checkbox" checked={c.visivel} onChange={() => toggleCamadaImportada(c.nome)} />
              {formatarNomeCAR(c.nome)}
            </label>
            <button onClick={() => removerCamadaImportada(index)}>
              <img src="/icons/lixo.png" alt="Excluir" style={{ width: '16px', height: '16px' }} />
            </button>
          </li>
        ))}
      </ul>

      <h3>Desenhos Manuais</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Todos os desenhos</span>
        <button onClick={removerTodosDesenhos}>
          <img src="/icons/lixo.png" alt="Remover" style={{ width: '20.5px', height: '20.5px' }} />
        </button>
      </div>
      <ul>
        {desenhos.map((d, i) => (
          <li key={i}>
            <label>
              <input type="checkbox" checked={d.exportar} onChange={() => alternarDesenhoParaExportacao(i)} />
              {d.tipo}
            </label>
            <div>
              {indiceEditando === i && (
                <button onClick={finalizarEdicaoIndividual}>✅</button>
              )}
              <button onClick={() => editarDesenhoIndividual(i)}>
                <img src="/icons/desenho.png" alt="Editar" />
              </button>
              <button onClick={() => removerDesenhoIndividual(i)}>
                <img src="/icons/lixo.png" alt="Excluir" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
