import { esc, chip, listaResumida } from "../ui.js";
import { campoErro } from "../validacao.js";
import { catalogo } from "../catalogo.js";

/**
 * Cadastro de Problemas.
 *
 * Os campos são os da matriz de mapeamento, e na ordem dela:
 *
 *   Nome* · Descrição · População afetada* · Causa e subcausa* · Consequências*
 *
 * O problema **não pertence** a uma causa: ele aponta para elas. A mesma causa
 * explica mais de um problema, o que uma hierarquia proibiria.
 *
 * População afetada é catálogo, e não campo de texto. Dois motivos: "famílias
 * em insegurança alimentar grave" e "crianças de 0 a 3 anos fora da creche" são
 * grupos distintos, com tamanhos distintos, e somá-los numa frase apaga a
 * diferença que o plano precisa enxergar; e o mesmo grupo é atingido por mais de
 * um problema, então o texto vive num lugar só.
 *
 * Indicadores deixaram de ser campo do problema em 06/10/2026: a matriz não os
 * lista aqui — o indicador de impacto se vincula ao Programa.
 */

const valor = (id) => document.getElementById(id)?.value.trim() ?? "";

/** Nomes dos itens vinculados, na ordem em que foram escolhidos. */
const nomesVinculados = (ids, colecao) =>
    (ids ?? []).map((id) => (colecao ?? []).find((c) => c.id === id)?.nome).filter(Boolean);

/* ---------- catálogos ---------- */

const populacoes = catalogo({
    colecao: "populacoes",
    singular: "Grupo populacional",
    plural: "População afetada",
    artigo: "o",
    prefixo: "pop",
    obrigatorio: true,
    campos: [
        {
            id: "estimativa",
            rotulo: "Estimativa de pessoas",
            tipo: "texto",
            ajuda: "Opcional, mas é ela que permite comparar o tamanho de um problema com o de outro.",
        },
    ],
    usos: (id, estado) => (estado.problemas ?? []).filter((p) => (p.populacaoIds ?? []).includes(id)).length,
});

const causas = catalogo({
    colecao: "causas",
    singular: "Causa",
    plural: "Causa e subcausa",
    artigo: "a",
    prefixo: "cau",
    obrigatorio: true,
    campos: [
        { id: "justificativa", rotulo: "Justificativa", ajuda: "Por que ela origina o problema" },
        { id: "descricao", rotulo: "Descrição", ajuda: "O que caracteriza esta causa" },
    ],
    colunasExtra: [
        {
            rotulo: "Subcausas",
            valor: (c, estado) => {
                const subs = (c.subcausaIds ?? [])
                    .map((id) => (estado.subcausas ?? []).find((s) => s.id === id))
                    .filter(Boolean);
                return subs.length ? subs.map((s) => chip(s.nome, "neutro")).join(" ") : '<span class="text-muted">—</span>';
            },
        },
    ],
    usos: (id, estado) => (estado.problemas ?? []).filter((p) => (p.causaIds ?? []).includes(id)).length,
});

/* ---------- o cadastro ---------- */

export const problema = {
    colecao: "problemas",
    pasta: "central-problema",
    listagem: "central-problema.html",
    titulo: "Cadastro de Problemas",
    subtitulo: "O que o plano enfrenta: quem atinge, o que o explica e o que acontece se ele não for enfrentado.",
    novoRotulo: "Novo problema",
    singular: "Problema",
    rotuloNome: "Nome do problema",
    exemplo: "Acesso desigual ao cuidado integral na primeira infância",
    podeExcluir: true,

    // A descrição vem logo abaixo do nome, e não no fim do formulário.
    semDescricao: true,

    filtros: [
        { tipo: "vinculo", id: "populacoes", rotulo: "População afetada", colecao: "populacoes", campo: "populacaoIds" },
        { tipo: "vinculo", id: "causas", rotulo: "Causas", colecao: "causas", campo: "causaIds" },
    ],

    extra: {
        // Os nomes, e não a contagem: com mais de um, o primeiro fica à vista e
        // os demais no selo "+N", como os objetivos na grid de eixos.
        colunas: [
            {
                rotulo: "População afetada",
                valor: (item, estado) => listaResumida(nomesVinculados(item.populacaoIds, estado.populacoes)),
            },
            {
                rotulo: "Causas",
                valor: (item, estado) => listaResumida(nomesVinculados(item.causaIds, estado.causas)),
            },
        ],

        html(item) {
            return `
            <div class="mb-3">
                <label class="form-label" for="f-descricao">Descrição</label>
                <textarea class="form-control" id="f-descricao" rows="3"
                          placeholder="O que caracteriza este problema">${esc(item.descricao ?? "")}</textarea>
            </div>

            ${populacoes.html(item.populacaoIds ?? [])}

            ${causas.html(item.causaIds ?? [])}

            <div class="mb-0">
                <label class="form-label" for="f-consequencias">Consequências <span class="text-danger">*</span></label>
                <textarea class="form-control" id="f-consequencias" rows="3"
                          placeholder="O que acontece se este problema não for enfrentado">${esc(item.consequencias ?? "")}</textarea>
                ${campoErro("f-consequencias")}
            </div>`;
        },

        ligar(escopo) {
            populacoes.ligar(escopo);
            causas.ligar(escopo);
        },

        ler: () => ({
            populacaoIds: populacoes.ler(),
            causaIds: causas.ler(),
            consequencias: valor("f-consequencias"),
        }),

        // Os campos de lista não são `input`: o erro vai para o espaço que o
        // catálogo reserva, com o id do campo de busca.
        regras: (dados) => [
            {
                campo: "pop-busca",
                valido: (dados.populacaoIds ?? []).length > 0,
                mensagem: "Escolha ao menos um grupo da população afetada.",
            },
            {
                campo: "cau-busca",
                valido: (dados.causaIds ?? []).length > 0,
                mensagem: "Escolha ao menos uma causa. Um problema sem causa não se explica.",
            },
            { campo: "f-consequencias", valido: !!dados.consequencias, mensagem: "Descreva as consequências do problema." },
        ],
    },
};
