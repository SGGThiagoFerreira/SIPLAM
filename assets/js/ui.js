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

/* ---------- paginação das listagens ---------- */

/** Quantos registros por página a pessoa pode escolher. */
export const TAMANHOS_PAGINA = [10, 25, 50, 100];

/**
 * Paginação de uma listagem, no markup do Inspinia (`apps-ecommerce-orders`):
 * rodapé do card com "Mostrando X a Y de Z" à esquerda e a `pagination-boxed`
 * à direita. Não é o `custom-table.js` do template porque ele pagina linhas
 * que já estão no DOM, e aqui o corpo da tabela se refaz a cada filtro.
 *
 * Quem lista filtra e ordena; a paginação só corta. O fluxo é:
 *
 *   const pag = criarPaginacao(refazer);
 *   linhas()  → pag.fatia(listaFiltradaEOrdenada)
 *   render()  → ...</table></div>${pag.html()} ... pag.ligar()
 *   refazer() → corpo.innerHTML = linhas(); pag.atualizar();
 *   filtro    → pag.inicio(); refazer();
 *
 * @param {() => void} aoMudar Redesenha o corpo da tabela e chama `atualizar()`.
 */
let paginacoes = 0;
export function criarPaginacao(aoMudar, { porPagina = TAMANHOS_PAGINA[0] } = {}) {
    const id = `paginacao-${++paginacoes}`;
    let pagina = 1;
    let tamanho = porPagina;
    let total = 0;
    let semCorte = false;

    const paginas = () => Math.max(1, Math.ceil(total / tamanho));

    /** A página da vez. Guarda o total, que o rodapé mostra. */
    function fatia(lista) {
        total = lista.length;
        if (semCorte) return lista;
        // O filtro pode ter encolhido a lista: a página não passa da última.
        pagina = Math.min(pagina, paginas());
        const de = (pagina - 1) * tamanho;
        return lista.slice(de, de + tamanho);
    }

    /** Números com reticências: a primeira, a última e as vizinhas da atual. */
    function numeros() {
        const n = paginas();
        const vistas = [...new Set([1, pagina - 1, pagina, pagina + 1, n])].filter((p) => p >= 1 && p <= n).sort((a, b) => a - b);
        const saida = [];
        vistas.forEach((p, i) => {
            if (i > 0 && p - vistas[i - 1] > 1) saida.push(null);
            saida.push(p);
        });
        return saida;
    }

    function item(rotulo, destino, { ativo = false, desabilitado = false, aria = "" } = {}) {
        return `<li class="page-item ${ativo ? "active" : ""} ${desabilitado ? "disabled" : ""}">
            <a href="#" class="page-link" data-pag-ir="${destino}" ${aria ? `aria-label="${aria}"` : ""}
               ${ativo ? 'aria-current="page"' : ""} ${desabilitado ? 'tabindex="-1" aria-disabled="true"' : ""}>${rotulo}</a>
        </li>`;
    }

    function miolo() {
        // Lista vazia já diz o que tem a dizer no corpo da tabela.
        if (total === 0) return "";
        const n = paginas();
        const de = (pagina - 1) * tamanho + 1;
        const ate = Math.min(pagina * tamanho, total);
        return `<div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div class="d-flex align-items-center gap-2 fs-12 text-muted text-nowrap">
                <span>Mostrar</span>
                <select class="form-select form-select-sm flex-shrink-0" style="width:4.5rem" data-pag-tamanho aria-label="Registros por página">
                    ${TAMANHOS_PAGINA.map((t) => `<option value="${t}" ${t === tamanho ? "selected" : ""}>${t}</option>`).join("")}
                </select>
                <span class="text-nowrap">por página · mostrando <span class="fw-semibold">${de}</span> a
                    <span class="fw-semibold">${ate}</span> de <span class="fw-semibold">${total}</span></span>
            </div>
            <ul class="pagination pagination-sm pagination-boxed mb-0">
                ${item('<i class="ti ti-chevron-left"></i>', pagina - 1, { desabilitado: pagina === 1, aria: "Página anterior" })}
                ${numeros()
                    .map((p) =>
                        p === null
                            ? '<li class="page-item disabled"><span class="page-link">…</span></li>'
                            : item(p, p, { ativo: p === pagina })
                    )
                    .join("")}
                ${item('<i class="ti ti-chevron-right"></i>', pagina + 1, { desabilitado: pagina === n, aria: "Próxima página" })}
            </ul>
        </div>`;
    }

    /** O rodapé do card, para ir logo depois do `.table-responsive`. */
    const html = () => `<div class="card-footer border-0" id="${id}">${miolo()}</div>`;

    /** Refaz o rodapé; chame depois de `fatia()`. */
    function atualizar() {
        const el = document.getElementById(id);
        if (el) el.innerHTML = miolo();
    }

    /** Liga o rodapé já desenhado. Delegado: o miolo se refaz, o rodapé fica. */
    function ligar() {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("click", (e) => {
            const link = e.target.closest("[data-pag-ir]");
            if (!link) return;
            e.preventDefault();
            const destino = Number(link.dataset.pagIr);
            if (link.closest(".disabled") || destino === pagina || destino < 1 || destino > paginas()) return;
            pagina = destino;
            aoMudar();
        });
        el.addEventListener("change", (e) => {
            if (!e.target.matches("[data-pag-tamanho]")) return;
            // Mantém à vista o primeiro registro que estava na tela.
            const primeiro = (pagina - 1) * tamanho;
            tamanho = Number(e.target.value);
            pagina = Math.floor(primeiro / tamanho) + 1;
            aoMudar();
        });
    }

    /** Volta à primeira página — um filtro novo é uma lista nova. */
    const inicio = () => {
        pagina = 1;
    };

    /**
     * Roda `fn` com a lista inteira na tabela. É o que a exportação usa: o
     * arquivo leva todas as linhas do filtro, e não só a página da vez.
     */
    function todas(fn) {
        semCorte = true;
        aoMudar();
        try {
            fn();
        } finally {
            semCorte = false;
            aoMudar();
        }
    }

    return { fatia, html, atualizar, ligar, inicio, todas };
}
