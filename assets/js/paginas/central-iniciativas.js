/**
 * Cadastro de Iniciativas — Área Central.
 *
 * Reúne num lugar só as Iniciativas de todos os órgãos no plano, sem passar
 * pela tabela de Programas. As colunas são as da tela de Iniciativas do
 * protótipo: Iniciativa (com a unidade responsável), Programa, Status (com as
 * pendências), Entregas, Previsto e % de execução — e as Causas que ela
 * enfrenta, que também filtram a lista.
 *
 * A execução mostrada é **exclusivamente financeira** (SIAFIC): não diz nada
 * sobre o desempenho físico das Entregas, e o rodapé da faixa avisa isso.
 *
 * O formulário mora em `central-iniciativas/criar.html` e `editar.html`.
 */
import { noPlano, ppaCorrente } from "../dados/store.js";
import {
    STATUS_CURTO,
    entregasDaIniciativa,
    pendenciasIniciativa,
    resumoPendencias,
    financeiroIniciativa,
    moeda,
    pct,
} from "../dados/regras.js";
import { montarShell, barraTitulo, somenteLeitura, url } from "../shell.js";
import { esc, statusChip, faixaIndicadores, criarPaginacao, listaResumida } from "../ui.js";
import { criarFiltros, opcoesDe } from "../filtros.js";
import { STATUS_CENTRAL } from "../iniciativa-campos.js";

const { estado } = montarShell();
const leitura = somenteLeitura();

// Um PPA por vez: a Iniciativa pertence ao plano do Programa de onde descende.
// O Programa é opcional; sem ele, quem diz o plano é o `ppaId` da Iniciativa.
const plano = noPlano(estado);
const ppa = ppaCorrente(estado);
const doPlano = (i) => (i.programaId ? plano.iniciativa(i) : !i.ppaId || !ppa || i.ppaId === ppa.id);
const iniciativasDoPlano = () => (estado.iniciativas ?? []).filter(doPlano);
const programaDe = (i) => (estado.programas ?? []).find((p) => p.id === i.programaId);
// O motivo da divergência é uma das três respostas da lista; o gravado antes dela era texto livre.
const MOTIVOS = Object.fromEntries(STATUS_CENTRAL);
const rotuloMotivo = (m, max = Infinity) => MOTIVOS[m] ?? (m.length > max ? `${m.slice(0, max)}…` : m);
/** As causas que a Iniciativa enfrenta: o vínculo mora na causa (`iniciativaIds`). */
const causasDe = (i) => (estado.causas ?? []).filter((c) => (c.iniciativaIds ?? []).includes(i.id));
/** Os indicadores escolhidos no cadastro (`indicadorIds`), do cadastro de Indicadores. */
const indicadoresDe = (i) =>
    (i.indicadorIds ?? []).map((id) => (estado.indicadores ?? []).find((x) => x.id === id)).filter(Boolean);
/**
 * O problema da Iniciativa: o que ela guarda ou, sem ele, o do Programa
 * (`pb-<programa>`). O campo saiu do formulário, mas o dado gravado vale.
 */
const problemaDe = (i) => (estado.problemas ?? []).find((p) => p.id === (i.problemaId || `pb-${i.programaId}`));
const rotuloPrograma = (p) => (p ? `${p.codigo} — ${p.nome}` : "—");

/**
 * Pendências impeditivas, contadas enquanto a Iniciativa está em preenchimento:
 * é quando o órgão ainda pode resolvê-las antes de enviar. Depois disso quem
 * fala é o status.
 */
function pendencias(i) {
    if (i.status !== "em_preenchimento") return 0;
    return resumoPendencias(pendenciasIniciativa(estado, { causas: [], descricao: "", ...i })).impeditivos;
}

// A tabela mostra uma página por vez. A faixa conta o filtro inteiro.
const paginacao = criarPaginacao(() => {
    document.getElementById("corpo-lista").innerHTML = corpo();
    paginacao.atualizar();
});

const filtros = criarFiltros({
    paginacao,
    livre: {
        rotulo: "Iniciativa",
        texto: (i) =>
            `${i.nome} ${i.descricao ?? ""} ${i.motivo ? rotuloMotivo(i.motivo) : ""} ${i.unidadeResponsavel ?? ""} ${i.orgao ?? ""} ${rotuloPrograma(programaDe(i))} ${problemaDe(i)?.nome ?? ""} ${causasDe(i).map((c) => c.nome).join(" ")} ${indicadoresDe(i).map((x) => x.nome).join(" ")}`,
    },
    campos: [
        {
            id: "programa",
            rotulo: "Programa",
            opcoes: () =>
                plano.programas
                    .map((p) => ({ valor: p.id, rotulo: rotuloPrograma(p) }))
                    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
            valorDe: (i) => (i.programaId ? [i.programaId] : []),
        },
        {
            id: "motivo",
            rotulo: "Motivo",
            opcoes: () =>
                opcoesDe(
                    iniciativasDoPlano().filter((i) => i.status === "divergencia"),
                    (i) => i.motivo
                ).map((o) => ({ valor: o.valor, rotulo: rotuloMotivo(o.valor, 60) })),
            valorDe: (i) => (i.status === "divergencia" && i.motivo ? [i.motivo] : []),
        },
        {
            id: "causas",
            rotulo: "Causas",
            opcoes: () =>
                [...new Map(iniciativasDoPlano().flatMap(causasDe).map((c) => [c.id, c])).values()]
                    .map((c) => ({ valor: c.id, rotulo: c.nome }))
                    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
            valorDe: (i) => causasDe(i).map((c) => c.id),
        },
        {
            id: "indicadores",
            rotulo: "Indicadores",
            opcoes: () =>
                [...new Map(iniciativasDoPlano().flatMap(indicadoresDe).map((x) => [x.id, x])).values()]
                    .map((x) => ({ valor: x.id, rotulo: x.nome }))
                    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
            valorDe: (i) => indicadoresDe(i).map((x) => x.id),
        },
        {
            // O órgão gravado na Iniciativa: o informado no cadastro antigo ou,
            // na nova, o órgão de quem a cadastrou.
            id: "orgao",
            rotulo: "Órgão",
            opcoes: () => opcoesDe(iniciativasDoPlano(), (i) => i.orgao),
            valorDe: (i) => (i.orgao ? [i.orgao] : []),
        },
        {
            id: "status",
            rotulo: "Status",
            opcoes: () =>
                opcoesDe(iniciativasDoPlano(), (i) => i.status).map((o) => ({
                    valor: o.valor,
                    rotulo: STATUS_CURTO[o.valor] ?? o.rotulo,
                })),
            valorDe: (i) => (i.status ? [i.status] : []),
        },
    ],
    exportar: "iniciativas",
    acao: () =>
        leitura
            ? ""
            : `<a href="${url("central-iniciativas/criar.html")}" class="btn btn-primary ${plano.programas.length ? "" : "disabled"}">
                <i class="ti ti-plus me-1"></i>Nova Iniciativa
            </a>`,
});

const linhas = () => iniciativasDoPlano().filter((i) => filtros.passa(i));

/** A faixa de números conta o que a tabela mostra, e por isso segue o filtro. */
function faixa() {
    const ls = linhas();
    const entregas = ls.reduce((s, i) => s + entregasDaIniciativa(estado, i.id).length, 0);
    const fin = ls.map((i) => financeiroIniciativa(estado, i.id));
    const previsto = fin.reduce((s, f) => s + f.previsto, 0);
    const executado = fin.reduce((s, f) => s + f.executado, 0);
    return faixaIndicadores(
        [
            { valor: ls.length, rotulo: "Iniciativas" },
            { valor: entregas, rotulo: "Entregas" },
            { valor: moeda(previsto), rotulo: "Previsto no PPA" },
            { valor: moeda(executado), rotulo: "Executado (SIAFIC)" },
            { valor: pct(previsto > 0 ? (executado / previsto) * 100 : null), rotulo: "Execução financeira" },
        ],
        "A execução é exclusivamente financeira (SIAFIC) e não representa o desempenho físico das Entregas."
    );
}

function corpo() {
    const ls = linhas();
    if (ls.length === 0) {
        return `<tr><td colspan="10" class="text-center text-muted py-4 fs-12">${
            iniciativasDoPlano().length === 0
                ? "Nenhuma Iniciativa neste plano. Comece por “Nova Iniciativa”."
                : "Nenhuma Iniciativa corresponde ao filtro."
        }</td></tr>`;
    }
    return paginacao
        .fatia(ls)
        .map((i) => {
            const n = pendencias(i);
            const fin = financeiroIniciativa(estado, i.id);
            const qtdEntregas = entregasDaIniciativa(estado, i.id).length;
            return `
        <tr>
            <td>
                <a href="${url(`central-iniciativa.html?id=${encodeURIComponent(i.id)}`)}" class="fw-medium">${esc(i.nome)}</a>
                ${i.unidadeResponsavel ? `<div class="fs-12 text-muted">${esc(i.unidadeResponsavel)}</div>` : ""}
            </td>
            <td class="fs-13">${
                programaDe(i)
                    ? `<div class="fs-12 text-muted">${esc(programaDe(i).codigo)}</div><div>${esc(programaDe(i).nome)}</div>`
                    : '<span class="text-muted">—</span>'
            }</td>
            <td class="fs-13 text-muted">${
                problemaDe(i)
                    ? `<span title="${esc(problemaDe(i).nome)}" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(problemaDe(i).nome)}</span>`
                    : "—"
            }</td>
            <td class="fs-13">${listaResumida(causasDe(i).map((c) => c.nome))}</td>
            <td class="text-center" style="font-variant-numeric:tabular-nums">${indicadoresDe(i).length}</td>
            <td class="fs-13 text-muted">${esc(i.orgao ?? "—")}</td>
            <td>
                ${statusChip(i.status)}
                ${i.status === "divergencia" && i.motivo ? `<div class="fs-12 text-muted mt-1" title="${esc(rotuloMotivo(i.motivo))}">Motivo: ${esc(rotuloMotivo(i.motivo, 60))}</div>` : ""}
                ${n ? `<div class="fs-12 text-warning mt-1">${n} pendência${n > 1 ? "s" : ""}</div>` : ""}
            </td>
            <td class="text-center" style="font-variant-numeric:tabular-nums">${qtdEntregas}</td>
            <td class="num">${moeda(fin.previsto)}</td>
            <td class="text-end coluna-acoes">
                <a href="${url(`central-iniciativas/editar.html?id=${encodeURIComponent(i.id)}`)}"
                   class="btn btn-sm ${leitura ? "btn-light" : "btn-outline-primary"}">${leitura ? "Ver" : "Editar"}</a>
            </td>
        </tr>`;
        })
        .join("");
}

function render() {
    document.getElementById("conteudo").innerHTML = `
    ${barraTitulo("Cadastro de Iniciativas")}
    <div id="faixa">${faixa()}</div>
    <div class="card">
        ${filtros.html()}
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead>
                    <tr>
                        <th style="min-width:10rem">Iniciativa</th>
                        <th style="width:10rem">Programa</th>
                        <th style="width:13rem">Problema</th>
                        <th style="width:12rem">Causas</th>
                        <th class="text-center" style="width:6rem">Indicadores</th>
                        <th style="width:9rem">Órgão</th>
                        <th style="width:9rem">Status</th>
                        <th class="text-center" style="width:5rem">Entregas</th>
                        <th class="num" style="width:9rem">Previsto</th>
                        <th class="text-end coluna-acoes" style="width:6rem">Ações</th>
                    </tr>
                </thead>
                <!-- Tudo alinhado ao topo: as células têm alturas diferentes, e
                     centralizar deixava cada coluna começando numa altura. O
                     template centraliza toda célula, por isso o !important. -->
                <style>#corpo-lista > tr > td { vertical-align: top !important; }</style>
                <tbody id="corpo-lista">${corpo()}</tbody>
            </table>
        </div>
        ${paginacao.html()}
    </div>`;

    paginacao.ligar();
    filtros.ligar(() => {
        paginacao.inicio();
        document.getElementById("corpo-lista").innerHTML = corpo();
        paginacao.atualizar();
        document.getElementById("faixa").innerHTML = faixa();
    });
}

render();
