/**
 * Cadastro de Programa — Área Central.
 *
 * Lista os Programas e leva às telas de criar e editar, que vivem em
 * `central-programas/criar.html` e `central-programas/editar.html`.
 */
import { obterEstado, ppaCorrente } from "../dados/store.js";
import { APTIDAO_LABEL, DISPONIBILIZACAO_LABEL } from "../dados/regras.js";
import { montarShell, barraTitulo, somenteLeitura, url } from "../shell.js";
import { chip, esc, faixaIndicadores, criarPaginacao, listaResumida } from "../ui.js";
import { criarFiltros, opcoesDe } from "../filtros.js";

const { estado } = montarShell();
const leitura = somenteLeitura();

// Um PPA por vez: só os Programas do plano escolhido no cabeçalho. Programa sem
// `ppaId` é anterior ao vínculo e continua visível.
const plano = ppaCorrente(estado);
const doPlano = (p) => !p.ppaId || !plano || p.ppaId === plano.id;
const programasDoPlano = () => estado.programas.filter(doPlano);


/**
 * O que falta para o Programa operar. É a regra da matriz de mapeamento para o
 * status "vigente": problema e indicadores cadastrados.
 */
function faltaParaDisponibilizar(p) {
    const falta = [];
    if (!p.problema?.trim()) falta.push("problema");
    if ((p.indicadores ?? []).length === 0) falta.push("indicadores");
    return falta;
}

/** Nomes das Iniciativas que os órgãos vincularam ao Programa. */
function iniciativasDe(programaId) {
    return estado.iniciativas.filter((i) => i.programaId === programaId).map((i) => i.nome).filter(Boolean);
}

/**
 * Nomes das causas do Programa. O cadastro novo guarda `causaIds`, que apontam
 * para o catálogo; o Programa anterior a ele ainda traz `causas` com o texto.
 */
function causasDe(p) {
    const doCatalogo = (p.causaIds ?? [])
        .map((id) => (estado.causas ?? []).find((c) => c.id === id)?.nome)
        .filter(Boolean);
    return doCatalogo.length ? doCatalogo : (p.causas ?? []).map((c) => c.texto).filter(Boolean);
}

/**
 * O filtro espelha a tabela: código e nome no campo livre, e um multisselect
 * para cada coluna que classifica o Programa.
 */
// A tabela mostra uma página por vez. A faixa de números conta o filtro
// inteiro, não a página: ela não se refaz quando só a página muda.
const paginacao = criarPaginacao(() => {
    document.getElementById("corpo-lista").innerHTML = corpo();
    paginacao.atualizar();
});

const filtros = criarFiltros({
    paginacao,
    livre: { rotulo: "Programa", texto: (p) => `${p.codigo} ${p.nome} ${p.eixo ?? ""} ${p.objetivoEstrategico ?? ""}` },
    campos: [
        {
            id: "eixo",
            rotulo: "Eixo",
            opcoes: () => opcoesDe(programasDoPlano(), (p) => p.eixo),
            valorDe: (p) => (p.eixo ? [p.eixo] : []),
        },
        {
            id: "objetivo",
            rotulo: "Objetivo estratégico",
            opcoes: () => opcoesDe(programasDoPlano(), (p) => p.objetivoEstrategico),
            valorDe: (p) => (p.objetivoEstrategico ? [p.objetivoEstrategico] : []),
        },
        {
            id: "aptidao",
            rotulo: "Aptidão",
            opcoes: () =>
                opcoesDe(programasDoPlano(), (p) => p.aptidao ?? "incompleto").map((o) => ({
                    valor: o.valor,
                    rotulo: APTIDAO_LABEL[o.valor] ?? o.rotulo,
                })),
            valorDe: (p) => [p.aptidao ?? "incompleto"],
        },
        {
            id: "disponibilizacao",
            rotulo: "Disponibilização",
            opcoes: () =>
                opcoesDe(programasDoPlano(), (p) => p.disponibilizacao ?? "em_estruturacao").map((o) => ({
                    valor: o.valor,
                    rotulo: DISPONIBILIZACAO_LABEL[o.valor] ?? o.rotulo,
                })),
            valorDe: (p) => [p.disponibilizacao ?? "em_estruturacao"],
        },
    ],
    exportar: "programas",
    acao: () =>
        leitura
            ? ""
            : `<a href="${url("central-programas/criar.html")}" class="btn btn-primary">
                <i class="ti ti-plus me-1"></i>Novo Programa
            </a>`,
});

const linhas = () => programasDoPlano().filter((p) => filtros.passa(p));

/** A faixa de números conta o que a tabela mostra, e por isso segue o filtro. */
function faixa() {
    const ls = linhas();
    return faixaIndicadores(
        [
            { valor: ls.length, rotulo: "Programas" },
            { valor: ls.filter((p) => p.aptidao === "apto").length, rotulo: "Aptos" },
            { valor: ls.filter((p) => p.disponibilizacao === "disponivel").length, rotulo: "Disponíveis aos órgãos" },
            { valor: ls.filter((p) => faltaParaDisponibilizar(p).length > 0).length, rotulo: "Com diagnóstico incompleto" },
            {
                valor: estado.iniciativas.filter((i) => programasDoPlano().some((p) => p.id === i.programaId)).length,
                rotulo: "Iniciativas recebidas",
            },
        ],
        "Um Programa sem causas cadastradas impede o órgão de concluir qualquer Iniciativa nele."
    );
}

/**
 * Corpo da tabela — ele e a faixa são o que se refaz quando um filtro muda.
 * Causas e Iniciativas mostram os nomes, e não a contagem: com mais de um, o
 * primeiro fica à vista e os demais no selo "+N", como na grid de problemas.
 */
function corpo() {
    const ls = linhas();
    if (ls.length === 0) {
        return '<tr><td colspan="7" class="text-center text-muted py-4 fs-12">Nenhum Programa corresponde ao filtro.</td></tr>';
    }
    return paginacao
        .fatia(ls)
        .map((p) => {
            const falta = faltaParaDisponibilizar(p);
            return `
        <tr>
            <td class="codigo text-muted">${esc(p.codigo)}</td>
            <td>
                <a href="${url(`programa.html?id=${p.id}`)}" class="fw-medium">${esc(p.nome)}</a>
                <div class="fs-12 text-muted">${esc(p.eixo)}</div>
                ${falta.length ? `<div class="fs-12 text-warning mt-1">Falta: ${esc(falta.join(", "))}</div>` : ""}
            </td>
            <td class="fs-13">${listaResumida(causasDe(p), chip("Nenhuma", "alerta"))}</td>
            <td class="fs-13">${listaResumida(iniciativasDe(p.id))}</td>
            <td>${chip(APTIDAO_LABEL[p.aptidao ?? "incompleto"], p.aptidao === "apto" ? "ok" : "alerta")}</td>
            <td>${chip(
                DISPONIBILIZACAO_LABEL[p.disponibilizacao ?? "em_estruturacao"],
                p.disponibilizacao === "disponivel" || p.disponibilizacao === "vigente" ? "ok" : "neutro"
            )}</td>
            <td class="text-end coluna-acoes">${
                leitura
                    ? `<a href="${url(`programa.html?id=${p.id}`)}" class="btn btn-sm btn-light">Ver</a>`
                    : `<a href="${url(`central-programas/editar.html?id=${p.id}`)}" class="btn btn-sm btn-outline-primary">Editar</a>`
            }</td>
        </tr>`;
        })
        .join("");
}

function render() {
    document.getElementById("conteudo").innerHTML = `
    ${barraTitulo("Cadastro de Programa")}
    <div id="faixa">${faixa()}</div>
    <div class="card">
        ${filtros.html()}
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead>
                    <tr>
                        <th style="width:5rem">Código</th>
                        <th>Programa</th>
                        <th style="width:16rem">Causas</th>
                        <th style="width:14rem">Iniciativas</th>
                        <th style="width:11rem">Aptidão</th>
                        <th style="width:14rem">Disponibilização</th>
                        <th class="text-end coluna-acoes" style="width:7rem">Ações</th>
                    </tr>
                </thead>
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
