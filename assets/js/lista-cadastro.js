/**
 * Listagem dos Cadastros Estratégicos.
 *
 * Só lista e leva às telas de criar e editar — o formulário mora em
 * `<cadastro>/criar.html` e `<cadastro>/editar.html`, montado por
 * `form-pagina.js` a partir desta mesma configuração.
 *
 * A configuração é única de propósito: listagem e formulário discordarem sobre
 * o que o cadastro tem é o tipo de erro que só aparece em produção.
 */
import { obterEstado, ppaCorrente } from "./dados/store.js";
import { montarShell, barraTitulo, somenteLeitura, url } from "./shell.js";
import { esc, criarPaginacao } from "./ui.js";
import { criarFiltros, opcoesDe } from "./filtros.js";

export function montarLista(cfg) {
    const { estado } = montarShell();
    const leitura = somenteLeitura() || cfg.somenteAdminCentral === true;
    // Um PPA por vez: a listagem mostra só o que pertence ao plano escolhido no
    // cabeçalho. Registro sem `ppaId` é anterior ao vínculo — aparece sempre,
    // senão sumiria sem que ninguém pudesse alcançá-lo.
    const plano = ppaCorrente(estado);
    const doPlano = (i) => !i.ppaId || !plano || i.ppaId === plano.id;

    const itens = () => (estado[cfg.colecao] ?? []).filter(doPlano);
    const opcoesPai = () => (cfg.pai ? (estado[cfg.pai.colecao] ?? []).filter(doPlano) : []);

    const nomeDoPai = (item) => {
        if (!cfg.pai) return "";
        return opcoesPai().find((p) => p.id === item[cfg.pai.campo])?.nome ?? "—";
    };

    // Um cadastro pode mostrar mais de um vínculo na tabela. `coluna` no
    // singular continua valendo para quem tem só um.
    const extras = cfg.extra?.colunas ?? (cfg.extra?.coluna ? [cfg.extra.coluna] : []);

    /**
     * Os filtros espelham as colunas da tabela. Cada cadastro declara de onde
     * vem o valor de cada uma; o tipo diz quem guarda o vínculo:
     *
     *   vinculo — o próprio registro aponta (`item[campo]`, um id ou vários);
     *   inverso — quem aponta é o outro lado (o objetivo é que guarda o eixo);
     *   texto   — o valor está no próprio registro, como unidade ou situação.
     */
    function campoDeFiltro(f) {
        const registros = () => (estado[f.colecao] ?? []).filter(doPlano);

        if (f.tipo === "texto") {
            return {
                id: f.id,
                rotulo: f.rotulo,
                opcoes: () => opcoesDe(itens(), (i) => i[f.campo]),
                valorDe: (i) => (i[f.campo] ? [String(i[f.campo])] : []),
            };
        }

        const opcoes = () =>
            registros()
                .map((r) => ({ valor: r.id, rotulo: r.nome }))
                .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));

        if (f.tipo === "inverso") {
            // Quem guarda o vínculo é o outro lado, e ele pode guardá-lo num
            // campo só ou numa lista.
            const aponta = (r, id) => {
                const v = r[f.campo];
                return Array.isArray(v) ? v.includes(id) : v === id;
            };
            return {
                id: f.id,
                rotulo: f.rotulo,
                opcoes,
                valorDe: (i) => registros().filter((r) => aponta(r, i.id)).map((r) => r.id),
            };
        }

        return {
            id: f.id,
            rotulo: f.rotulo,
            opcoes,
            valorDe: (i) => [i[f.campo]].flat().filter(Boolean),
        };
    }

    // A tabela mostra uma página por vez; filtro e paginação se refazem juntos.
    const refazer = () => {
        document.getElementById("corpo-lista").innerHTML = linhas();
        paginacao.atualizar();
    };
    const paginacao = criarPaginacao(refazer);

    const filtros = criarFiltros({
        paginacao,
        livre: {
            rotulo: cfg.singular,
            // O campo livre varre todo texto do registro: procurar pela
            // evidência e não achar a subcausa seria procurar às cegas.
            texto: (i) =>
                Object.entries(i)
                    .filter(([chave, v]) => typeof v === "string" && chave !== "id" && chave !== "ppaId")
                    .map(([, v]) => v)
                    .join(" ") + (cfg.codigo ? ` ${cfg.codigo(i, estado)}` : ""),
        },
        campos: (cfg.filtros ?? []).map(campoDeFiltro),
        exportar: cfg.colecao,
        // A ação da tela vive no cabeçalho do card, como no Inspinia. Sem o
        // nível acima não há o que vincular: o botão fica visível e desabilitado,
        // porque esconder deixaria a pessoa procurando uma ação que existe.
        acao: () =>
            leitura
                ? `<span class="fs-12 text-muted">${esc(cfg.avisoLeitura ?? "Perfil sem edição neste cadastro.")}</span>`
                : `<a href="${criar}" class="btn btn-primary ${semPai() ? "disabled" : ""}">
                    <i class="ti ti-plus me-1"></i>${esc(cfg.novoRotulo)}
                </a>`,
    });

    // Sem o nível acima não há o que vincular.
    const semPai = () => cfg.pai && !cfg.pai.opcional && opcoesPai().length === 0;

    const criar = url(`${cfg.pasta}/criar.html`);
    const editar = (id) => url(`${cfg.pasta}/editar.html?id=${encodeURIComponent(id)}`);

    /** Corpo da tabela — é só ele que se refaz quando um filtro muda. */
    function linhas() {
        const lista = itens().filter((i) => filtros.passa(i));

        const colunas = 2 + (cfg.semDescricao ? 0 : 1) + (cfg.pai ? 1 : 0) + extras.length + (cfg.codigo ? 1 : 0);

        if (lista.length === 0) {
            return `<tr><td colspan="${colunas}" class="text-center text-muted py-4 fs-12">
                ${itens().length === 0 ? `Nenhum registro. Comece por “${esc(cfg.novoRotulo)}”.` : "Nenhum registro corresponde ao filtro."}
            </td></tr>`;
        }

        return paginacao
            .fatia(lista)
            .map(
                (i) => `
            <tr>
                ${cfg.codigo ? `<td class="codigo text-muted">${esc(cfg.codigo(i, estado))}</td>` : ""}
                <td class="fw-medium">${esc(i.nome)}</td>
                ${cfg.pai ? `<td class="fs-13 text-muted">${esc(nomeDoPai(i))}</td>` : ""}
                ${extras.map((c) => `<td class="fs-13 text-muted">${c.valor(i, estado)}</td>`).join("")}
                ${cfg.semDescricao ? "" : `<td class="fs-13 text-muted">${esc(i.descricao || "—")}</td>`}
                <td class="text-end coluna-acoes">
                    <a href="${editar(i.id)}" class="btn btn-sm ${leitura ? "btn-light" : "btn-outline-primary"}">
                        ${leitura ? "Ver" : "Editar"}
                    </a>
                </td>
            </tr>`
            )
            .join("");
    }

    function render() {
        document.getElementById("conteudo").innerHTML = `
        ${barraTitulo(esc(cfg.titulo))}

        ${
            semPai()
                ? `<div class="alert alert-warning py-2 px-3 fs-13">
                Cadastre ao menos ${esc(cfg.pai.artigo)}
                <a href="${url(cfg.pai.href)}" class="fw-semibold">${esc(cfg.pai.rotulo)}</a>
                antes de usar “${esc(cfg.novoRotulo)}”.
            </div>`
                : ""
        }

        <div class="card">
            ${filtros.html()}
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead>
                        <tr>
                            ${cfg.codigo ? '<th class="codigo" style="width:5rem">Nº</th>' : ""}
                            <th style="width:22rem">${esc(cfg.singular)}</th>
                            ${cfg.pai ? `<th style="width:18rem">${esc(cfg.pai.rotulo)}</th>` : ""}
                            ${extras.map((c) => `<th style="width:12rem">${esc(c.rotulo)}</th>`).join("")}
                            ${cfg.semDescricao ? "" : "<th>Descrição</th>"}
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
}
