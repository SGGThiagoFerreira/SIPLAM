/**
 * Componentes compartilhados do SIPLAM.
 * Substitui `src/components/ppa/ui.tsx` e `big-numbers.tsx` do protótipo.
 */
import { STATUS_CURTO } from "./dados/regras.js";

const TOM = {
    ok: "chip-ok",
    alerta: "chip-alerta",
    impeditivo: "chip-impeditivo",
    info: "chip-info",
    neutro: "chip-neutro",
};

const STATUS_TOM = {
    em_preenchimento: "neutro",
    enviada: "info",
    em_analise: "info",
    devolvida: "alerta",
    validada: "ok",
    divergencia: "alerta",
};

/** Pílula semântica em cinco tons. */
export function chip(texto, tom = "neutro") {
    return `<span class="chip ${TOM[tom] || TOM.neutro}">${texto}</span>`;
}

/** Chip do status da Iniciativa. */
export function statusChip(status) {
    return chip(STATUS_CURTO[status], STATUS_TOM[status]);
}

/** Faixa horizontal de indicadores — nunca cards soltos. */
export function faixaIndicadores(itens, rodape = "") {
    const celulas = itens
        .map(
            (i) => `
        <div class="faixa-item">
            <div class="faixa-valor">${i.valor}</div>
            <div class="faixa-rotulo">${i.rotulo}</div>
        </div>`
        )
        .join("");

    return `
<div class="card mb-3">
    <div class="faixa-indicadores">${celulas}</div>
    ${rodape ? `<div class="faixa-rodape">${rodape}</div>` : ""}
</div>`;
}

/** Card com cabeçalho de rótulo e slot de ação. */
export function secao(titulo, conteudo, acao = "") {
    return `
<div class="card mb-3">
    <div class="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
        <h6 class="rotulo-secao mb-0">${titulo}</h6>
        ${acao}
    </div>
    <div class="card-body">${conteudo}</div>
</div>`;
}

/** Escapa texto vindo dos dados antes de injetar no HTML. */
export function esc(valor) {
    return String(valor ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
}

/**
 * Lista curta para célula de tabela: o primeiro nome e, havendo mais, um
 * “+N” que mostra os demais ao passar o mouse. As linhas são redesenhadas a
 * cada filtro, então o tooltip é delegado do `body` e criado uma vez só.
 */
let tooltipDelegado = false;
export function listaResumida(nomes, vazio = '<span class="text-muted">—</span>') {
    if (!nomes.length) return vazio;
    if (!tooltipDelegado && window.bootstrap?.Tooltip) {
        new bootstrap.Tooltip(document.body, { selector: "[data-lista-mais]", html: true });
        tooltipDelegado = true;
    }
    const [primeiro, ...resto] = nomes;
    if (!resto.length) return esc(primeiro);
    // O selo fica à direita do nome e não quebra de linha separado dele.
    return `<span class="d-inline-flex align-items-start gap-1">
        <span>${esc(primeiro)}</span>
        <span class="badge bg-light text-body border flex-shrink-0" tabindex="0" data-lista-mais
              data-bs-placement="top" data-bs-title="${esc(resto.map(esc).join("<br>"))}"
              aria-label="Mais ${resto.length}: ${esc(resto.join(", "))}">+${resto.length}</span>
    </span>`;
}

/** Trilha de contexto com separador "›". */
/* ---------- micro-gráficos ----------
   Uma matiz só e o número sempre ao lado: o verde da marca fica abaixo de 3:1
   contra o branco, então a cor nunca é a única portadora da informação. */

/** Medidor de proporção, com o rótulo por fora. */
export function medidor(parte, total, opcoes = {}) {
    const p = total > 0 ? Math.min(100, (parte / total) * 100) : 0;
    return `<div class="medidor ${opcoes.pequeno ? "medidor-sm" : ""}" role="img"
                 aria-label="${p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de ${esc(opcoes.de ?? "total")}"
                 title="${esc(opcoes.titulo ?? "")}"><span style="width:${p}%"></span></div>`;
}

/**
 * Trajetória de uma série curta: barras sem eixo, só a forma.
 * Usada onde comparar altura entre linhas não diria nada — as unidades mudam
 * de uma linha para outra. Os números ficam nas colunas ao lado.
 */
export function faisca(valores, rotulo) {
    const nums = valores.map((v) => (v === null || v === undefined ? null : v));
    const max = Math.max(...nums.filter((v) => v !== null), 0);
    return `<span class="faisca" role="img" aria-label="${esc(rotulo)}" title="${esc(rotulo)}">
        ${nums
            .map((v) =>
                v === null
                    ? `<i class="vazio" style="height:2px"></i>`
                    : `<i style="height:${max > 0 ? Math.max(2, (v / max) * 22) : 2}px"></i>`
            )
            .join("")}
    </span>`;
}
