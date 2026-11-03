/**
 * Barra de filtros das listagens.
 *
 * É o componente do Inspinia, e não um parecido: o cabeçalho do card guarda os
 * campos, cada um dentro de um `.app-search` com o ícone à esquerda, como em
 * `apps-ecommerce-orders`. O campo de escolha múltipla é o `select` com
 * `data-choices` do template (`form-select.html`), montado pelo Choices que já
 * vem no `vendors.min.js`.
 *
 * Os campos ocupam a largura toda porque o rótulo de um vínculo é uma frase —
 * "Ampliar a rede de cuidado à pessoa idosa" não cabe num campo de 12rem.
 *
 * O filtro espelha a tabela: um campo livre para o nome do registro e um campo
 * de escolha múltipla para cada coluna de vínculo ou de classificação. Filtrar
 * por coluna que a tabela não mostra é pedir à pessoa que confie no resultado
 * sem poder conferi-lo.
 *
 * **Filtra quando se manda filtrar.** Marcar três eixos e ver a lista se refazer
 * a cada marca é trabalhar contra quem está escolhendo: o que está escolhido só
 * vale depois de "Buscar" — ou de Enter no campo livre.
 *
 * Combinação: **E** entre campos, **OU** dentro de um campo. Escolher dois
 * eixos amplia; escolher um eixo e um programa restringe.
 */
import { esc } from "./ui.js";

/** Comparação que ignora acento e caixa — quem busca "orcamento" quer achar "orçamento". */
const normal = (t) =>
    (t ?? "")
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");

/**
 * @param {object} cfg
 * @param {{rotulo: string, texto: (item: object) => string}} cfg.livre
 * @param {Array<object>} [cfg.campos] Um por coluna filtrável. O `tipo` é o componente
 *   da aba Filtros da matriz de mapeamento:
 *     "multi"    (padrão) escolha múltipla — `opcoes()` e `valorDe(item)` devolvem listas;
 *     "texto"    campo de texto livre — `valorDe(item)` devolve o texto a procurar;
 *     "booleano" Sim/Não — `valorDe(item)` devolve ["sim"] ou ["nao"], e `sim`/`nao`
 *                dão os rótulos das duas escolhas.
 * @param {string} [cfg.exportar] Nome do arquivo gerado; sem ele, não há botão de exportar.
 * @param {() => string} [cfg.acao] A ação da tela — "Novo…" —, que no Inspinia mora
 *   no cabeçalho do card, junto dos filtros, e não numa faixa acima dele.
 * @param {object} [cfg.paginacao] A de `criarPaginacao`, quando a tabela é paginada:
 *   a exportação a desliga enquanto lê, para levar todas as páginas.
 */
export function criarFiltros(cfg) {
    const campos = (cfg.campos ?? []).filter(Boolean);

    // O que está escolhido na tela e o que está valendo na tabela são duas
    // coisas: é "Buscar" que leva um ao outro. A escolha da tela mora no
    // próprio campo; aqui fica só o que já está valendo.
    const valendo = new Map(campos.map((c) => [c.id, new Set()]));
    let termo = "";
    let termoValendo = "";

    const tipoDe = (c) => c.tipo ?? "multi";

    // As opções saem dos próprios registros: opção que não filtra nada não
    // aparece. Calculadas uma vez, porque a barra não se redesenha.
    const opcoes = new Map(campos.filter((c) => tipoDe(c) === "multi").map((c) => [c.id, c.opcoes()]));

    const ativo = () => !!termoValendo.trim() || campos.some((c) => valendo.get(c.id).size > 0);

    function passa(item) {
        if (termoValendo.trim() && !normal(cfg.livre.texto(item)).includes(normal(termoValendo.trim()))) return false;
        for (const c of campos) {
            const escolhidos = valendo.get(c.id);
            if (escolhidos.size === 0) continue;

            if (tipoDe(c) === "texto") {
                const [procurado] = [...escolhidos];
                if (!normal([c.valorDe(item)].flat().join(" ")).includes(normal(procurado))) return false;
                continue;
            }

            const valores = [c.valorDe(item) ?? []].flat();
            if (!valores.some((v) => escolhidos.has(v))) return false;
        }
        return true;
    }

    /** Ícone do campo, escolhido pelo que ele filtra. */
    const icone = (c) => c.icone ?? "ti-filter";

    function html() {
        return `
        <div class="card-header border-light filtros" id="barra-filtros">
            <div class="d-flex flex-wrap align-items-center gap-2">
                <div class="filtro-campo">
                    <div class="app-search">
                        <input type="search" id="filtro-livre" class="form-control"
                               placeholder="${esc(cfg.livre.rotulo)}" aria-label="Filtrar por ${esc(cfg.livre.rotulo)}" />
                        <i class="ti ti-search app-search-icon text-muted"></i>
                    </div>
                </div>
                ${campos
                    .map((c) => {
                        if (tipoDe(c) === "texto") {
                            return `
                <div class="filtro-campo">
                    <div class="app-search">
                        <input type="search" class="form-control" id="filtro-${esc(c.id)}" data-filtro="${esc(c.id)}"
                               placeholder="${esc(c.rotulo)}" aria-label="Filtrar por ${esc(c.rotulo)}" />
                        <i class="ti ${esc(icone(c))} app-search-icon text-muted"></i>
                    </div>
                </div>`;
                        }

                        if (tipoDe(c) === "booleano") {
                            return `
                <div class="filtro-campo">
                    <div class="app-search">
                        <select class="form-select form-control" id="filtro-${esc(c.id)}" data-filtro="${esc(c.id)}"
                                aria-label="Filtrar por ${esc(c.rotulo)}">
                            <option value="">${esc(c.rotulo)}</option>
                            <option value="sim">${esc(c.sim ?? "Sim")}</option>
                            <option value="nao">${esc(c.nao ?? "Não")}</option>
                        </select>
                        <i class="ti ${esc(icone(c))} app-search-icon text-muted"></i>
                    </div>
                </div>`;
                        }

                        const lista = opcoes.get(c.id);
                        if (!lista.length) return "";
                        return `
                <div class="filtro-campo">
                    <div class="app-search">
                        <select class="form-control" id="filtro-${esc(c.id)}" data-filtro="${esc(c.id)}"
                                data-choices data-choices-removeItem multiple
                                aria-label="Filtrar por ${esc(c.rotulo)}" data-placeholder="${esc(c.rotulo)}">
                            ${lista.map((o) => `<option value="${esc(o.valor)}">${esc(o.rotulo)}</option>`).join("")}
                        </select>
                        <i class="ti ${esc(icone(c))} app-search-icon text-muted"></i>
                    </div>
                </div>`;
                    })
                    .join("")}

                <div class="filtro-botoes d-flex align-items-center gap-2">
                    ${
                        cfg.exportar
                            ? `
                    <div class="dropdown">
                        <button class="btn btn-default dropdown-toggle drop-arrow-none" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="ti ti-download me-1"></i> Exportar <i class="ti ti-chevron-down align-middle ms-1"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><button class="dropdown-item" type="button" data-exportar="csv">Exportar como CSV</button></li>
                            <li><button class="dropdown-item" type="button" data-exportar="xls">Exportar como Excel</button></li>
                        </ul>
                    </div>`
                            : ""
                    }
                    <button type="button" class="btn btn-light" id="filtro-limpar">Limpar</button>
                    <button type="button" class="btn btn-primary" id="filtro-buscar"><i class="ti ti-search me-1"></i>Buscar</button>
                    ${cfg.acao?.() ?? ""}
                </div>
            </div>
        </div>`;
    }

    /**
     * Liga a barra já desenhada. `aoMudar` redesenha só o corpo da tabela — a
     * barra fica de pé, com os campos como estavam.
     */
    function ligar(aoMudar) {
        const barra = document.getElementById("barra-filtros");
        if (!barra) return;

        // O Choices vem no vendors.min.js do template; sem ele o campo continua
        // sendo um `select multiple` que funciona, só mais feio.
        const escolhas = new Map();
        if (typeof Choices !== "undefined") {
            for (const c of campos.filter((c) => tipoDe(c) === "multi")) {
                const campo = barra.querySelector(`#filtro-${c.id}`);
                if (!campo) continue;
                escolhas.set(
                    c.id,
                    new Choices(campo, {
                        removeItemButton: true,
                        shouldSort: false,
                        searchEnabled: true,
                        placeholderValue: c.rotulo,
                        searchPlaceholderValue: c.rotulo,
                        noResultsText: "Nada encontrado",
                        noChoicesText: "Nada a escolher",
                        itemSelectText: "",
                    })
                );
            }
        }

        const lerCampo = (c) => {
            const campo = barra.querySelector(`#filtro-${c.id}`);
            if (tipoDe(c) === "multi") return new Set([...(campo?.selectedOptions ?? [])].map((o) => o.value));
            // Texto e booleano guardam um valor só; vazio quer dizer "sem filtro".
            const v = (campo?.value ?? "").trim();
            return v ? new Set([v]) : new Set();
        };

        const aplicar = () => {
            termo = barra.querySelector("#filtro-livre")?.value ?? "";
            termoValendo = termo;
            for (const c of campos) valendo.set(c.id, lerCampo(c));
            aoMudar();
        };

        // Enter no campo livre é "Buscar": quem digita e aperta Enter não espera
        // ter de procurar um botão.
        barra.addEventListener("keydown", (e) => {
            if ((e.target.id === "filtro-livre" || e.target.matches?.('input[data-filtro]')) && e.key === "Enter") {
                e.preventDefault();
                aplicar();
            }
        });

        barra.addEventListener("click", (e) => {
            if (e.target.closest("#filtro-buscar")) {
                aplicar();
                return;
            }

            if (e.target.closest("#filtro-limpar")) {
                barra.querySelector("#filtro-livre").value = "";
                for (const c of campos) {
                    const campo = barra.querySelector(`#filtro-${c.id}`);
                    if (!campo) continue;
                    const escolha = escolhas.get(c.id);
                    if (escolha) escolha.removeActiveItems();
                    else if (tipoDe(c) === "multi") for (const o of campo.options ?? []) o.selected = false;
                    else campo.value = "";
                }
                aplicar();
                return;
            }

            const formato = e.target.closest("[data-exportar]")?.dataset.exportar;
            if (formato) exportar(formato);
        });
    }

    /**
     * Exporta o que está na tela.
     *
     * Lê a própria tabela, e não os registros: assim o arquivo tem as mesmas
     * linhas, as mesmas colunas e a mesma ordem que a pessoa está vendo — um
     * relatório que diverge da tela é pior que nenhum. A coluna de ações fica
     * de fora, porque num arquivo ela não é nada. A paginação é a exceção: o
     * arquivo leva todas as páginas do filtro, não só a que está à vista.
     */
    function exportar(formato) {
        if (cfg.paginacao) cfg.paginacao.todas(() => gerar(formato));
        else gerar(formato);
    }

    function gerar(formato) {
        const tabela = document.querySelector("#conteudo table");
        if (!tabela) return;

        const util = (celulas) =>
            [...celulas].filter((c) => !c.classList.contains("coluna-acoes")).map((c) => c.textContent.replace(/\s+/g, " ").trim());

        const cabecalho = util(tabela.querySelectorAll("thead th"));
        const linhas = [...tabela.querySelectorAll("tbody tr")]
            .filter((tr) => tr.querySelectorAll("td").length > 1)
            .map((tr) => util(tr.querySelectorAll("td")));

        const nome = `${cfg.exportar}-${new Date().toISOString().slice(0, 10)}`;

        if (formato === "csv") {
            // Ponto e vírgula e BOM: é assim que o Excel em português abre o
            // arquivo já separado em colunas, sem passar pelo assistente.
            const linha = (cs) => cs.map((c) => `"${c.replace(/"/g, '""')}"`).join(";");
            baixar(`${nome}.csv`, "﻿" + [cabecalho, ...linhas].map(linha).join("\r\n"), "text/csv;charset=utf-8");
            return;
        }

        const cela = (t, tag) => `<${tag}>${esc(t)}</${tag}>`;
        const corpo = linhas.map((cs) => `<tr>${cs.map((c) => cela(c, "td")).join("")}</tr>`).join("");
        baixar(
            `${nome}.xls`,
            `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head><body>
            <table><thead><tr>${cabecalho.map((c) => cela(c, "th")).join("")}</tr></thead><tbody>${corpo}</tbody></table>
            </body></html>`,
            "application/vnd.ms-excel;charset=utf-8"
        );
    }

    function baixar(nome, conteudo, tipo) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
        link.download = nome;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    return { html, ligar, passa, ativo };
}

/** Lista de opções sem repetição, em ordem alfabética, a partir dos registros. */
export function opcoesDe(itens, valor) {
    const vistos = new Map();
    for (const i of itens) {
        for (const v of [valor(i)].flat()) {
            if (v === undefined || v === null || v === "") continue;
            if (!vistos.has(v)) vistos.set(v, { valor: String(v), rotulo: String(v) });
        }
    }
    return [...vistos.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}
