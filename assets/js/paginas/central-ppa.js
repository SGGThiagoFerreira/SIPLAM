/**
 * PPA — Administração.
 *
 * Lista os planos e leva às telas de criar e editar, que vivem em
 * `central-ppa/criar.html` e `central-ppa/editar.html`.
 */
import { obterEstado, situacaoPpa } from "../dados/store.js";
import { montarShell, barraTitulo, somenteLeitura, perfilAtual, url } from "../shell.js";
import { esc, chip, criarPaginacao } from "../ui.js";
import { criarFiltros } from "../filtros.js";

const { estado } = montarShell();

/**
 * O cadastro do PPA é exclusivo do Administrador central. Os demais perfis
 * enxergam o plano — precisam dele para se situar — mas não o criam nem o
 * alteram: abrir o ciclo é ato da administração do plano.
 */
const leitura = somenteLeitura() || (!!perfilAtual() && !["admin-central", "gestao-central"].includes(perfilAtual()));

/** O período do plano, como a tabela o mostra. */
const vigenciaDe = (p) => `${p.primeiroAno}–${p.ultimoAno}`;

/** Cada ano que o plano cobre: quem digita "2030" quer o plano que o inclui. */
const anosDe = (p) => {
    const anos = [];
    for (let a = Number(p.primeiroAno); a <= Number(p.ultimoAno); a += 1) anos.push(String(a));
    return anos;
};

/**
 * Os filtros são os da aba "Filtros" da matriz de mapeamento, campo a campo e
 * com o componente que ela indica:
 *
 *   Plano — texto livre · Vigência — texto · Processo SEI — texto (número do processo) ·
 *   Situação — escolha múltipla · Descrição — texto
 *
 * A matriz deixa Situação e Descrição sem componente; escolhi o que o dado pede:
 * a situação é uma lista curta e fechada, e a descrição é prosa.
 */
// A tabela mostra uma página por vez; filtro e paginação se refazem juntos.
const refazer = () => {
    document.getElementById("corpo-lista").innerHTML = linhas();
    paginacao.atualizar();
};
const paginacao = criarPaginacao(refazer);

const filtros = criarFiltros({
    paginacao,
    livre: { rotulo: "Plano", texto: (p) => p.nome },
    campos: [
        {
            id: "vigencia",
            tipo: "texto",
            rotulo: "Vigência",
            icone: "ti-calendar",
            valorDe: (p) => `${vigenciaDe(p)} ${anosDe(p).join(" ")}`,
        },
        {
            id: "processo",
            tipo: "texto",
            rotulo: "Processo SEI",
            icone: "ti-file-text",
            valorDe: (p) => p.processoSei ?? "",
        },
        {
            id: "situacao",
            rotulo: "Situação",
            icone: "ti-progress",
            opcoes: () => {
                const vistas = new Map();
                for (const p of estado.ppas) vistas.set(p.situacao, { valor: p.situacao, rotulo: situacaoPpa(p.situacao).rotulo });
                return [...vistas.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
            },
            valorDe: (p) => [p.situacao],
        },
        {
            id: "descricao",
            tipo: "texto",
            rotulo: "Descrição",
            icone: "ti-align-left",
            valorDe: (p) => p.descricao ?? "",
        },
    ],
    exportar: "ppas",
    acao: () =>
        leitura
            ? `<span class="fs-12 text-muted">O cadastro do PPA é exclusivo do Administrador central.</span>`
            : `<a href="${url("central-ppa/criar.html")}" class="btn btn-primary">
                <i class="ti ti-plus me-1"></i>Novo PPA
            </a>`,
});

function linhas() {
    const ppas = [...estado.ppas].filter((p) => filtros.passa(p)).sort((a, b) => Number(b.primeiroAno) - Number(a.primeiroAno));

    if (ppas.length === 0) {
        return `<tr><td colspan="6" class="text-center text-muted py-4 fs-12">${
            estado.ppas.length === 0 ? "Nenhum plano cadastrado. Comece por “Novo PPA”." : "Nenhum plano corresponde ao filtro."
        }</td></tr>`;
    }

    return paginacao
        .fatia(ppas)
        .map(
            (p) => `
        <tr>
            <td class="fw-medium">${esc(p.nome)}</td>
            <td class="codigo">${esc(vigenciaDe(p))}</td>
            <td class="codigo fs-13">${p.processoSei ? esc(p.processoSei) : '<span class="text-muted">—</span>'}</td>
            <td>${chip(situacaoPpa(p.situacao).rotulo, situacaoPpa(p.situacao).tom)}</td>
            <!-- A descrição do plano é um texto longo: na tabela cabe uma linha, o
                 resto vira reticência, e o texto inteiro fica na tela do plano.
                 Assim a altura da linha não depende do tamanho do texto. -->
            <td class="fs-13 text-muted celula-truncada">${esc(p.descricao || "—")}</td>
            <td class="text-end coluna-acoes">
                ${(() => {
                    // Só um plano em elaboração se edita; nos demais o botão diz
                    // "Ver", para não prometer o que a tela não faz.
                    const podeEditar = !leitura && situacaoPpa(p.situacao).editavel;
                    return `
                <a href="${url(`central-ppa/editar.html?id=${encodeURIComponent(p.id)}`)}"
                   class="btn btn-sm ${podeEditar ? "btn-outline-primary" : "btn-light"}">
                    ${podeEditar ? "Editar" : "Ver"}
                </a>`;
                })()}
            </td>
        </tr>`
        )
        .join("");
}

function render() {

    document.getElementById("conteudo").innerHTML = `
    ${barraTitulo("Cadastro de Planos Plurianuais")}

    <div class="card">
        ${filtros.html()}
        <div class="table-responsive">
            <table class="table table-hover tabela-fixa mb-0">
                <thead>
                    <tr>
                        <th style="width:20rem">Plano</th>
                        <th style="width:9rem">Vigência</th>
                        <th style="width:12rem">Processo SEI</th>
                        <th style="width:11rem">Situação</th>
                        <th class="celula-truncada">Descrição</th>
                        <th class="text-end coluna-acoes" style="width:7rem">Ações</th>
                    </tr>
                </thead>
                <tbody id="corpo-lista">${linhas()}</tbody>
            </table>
        </div>
        ${paginacao.html()}
    </div>`;

    paginacao.ligar();
    filtros.ligar(() => {
        paginacao.inicio();
        refazer();
    });
}

render();
