import { esc } from "../ui.js";
import { catalogo } from "../catalogo.js";
import { obterEstado, ppaCorrente } from "../dados/store.js";

// A mesma comparação do catálogo: sem caixa, sem acento, sem espaço nas pontas.
const norm = (v) =>
    String(v ?? "")
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim();

/**
 * Outro objetivo do plano corrente com o mesmo nome. Como no eixo, o nome só
 * precisa ser único dentro do ciclo.
 */
function objetivoComMesmoNome(dados) {
    const estado = obterEstado();
    const plano = ppaCorrente(estado);
    return (estado.objetivos ?? []).find(
        (o) =>
            o.id !== dados.id &&
            (!o.ppaId || !plano || o.ppaId === plano.id) &&
            norm(o.nome) === norm(dados.nome)
    );
}

/**
 * Cadastro de Objetivos Estratégicos.
 *
 * O eixo deixou de ser um campo de seleção: quem cadastra um objetivo costuma
 * estar montando o plano de cima para baixo, e o eixo de que ele precisa às
 * vezes ainda não existe. Com o catálogo, ele busca o que há e cadastra o que
 * falta sem sair daqui.
 *
 * O vínculo é de um só — um objetivo pertence a um eixo — e continua guardado
 * em `eixoId`, no próprio objetivo.
 */

const eixos = catalogo({
    colecao: "eixos",
    singular: "Eixo",
    plural: "Eixo",
    artigo: "o",
    prefixo: "eix",
    obrigatorio: true,
    unico: true,
    campos: [{ id: "descricao", rotulo: "Descrição", ajuda: "O que este eixo reúne" }],
    usos: (id, estado) => (estado.objetivos ?? []).filter((o) => o.eixoId === id).length,
});

export const objetivo = {
    colecao: "objetivos",
    pasta: "central-objetivo",
    listagem: "central-objetivo.html",
    titulo: "Cadastro de Objetivos Estratégicos",
    subtitulo: "O que cada eixo se propõe a alcançar.",
    novoRotulo: "Novo objetivo estratégico",
    singular: "Objetivo estratégico",
    rotuloNome: "Nome do objetivo estratégico",
    exemplo: "Ampliar a rede de cuidado à pessoa idosa.",
    podeExcluir: true,

    // A descrição vem antes do eixo, porque explica o registro que está sendo
    // cadastrado — e não o nível acima dele.
    semDescricao: true,

    filtros: [{ tipo: "vinculo", id: "eixo", rotulo: "Eixo", colecao: "eixos", campo: "eixoId" }],

    extra: {
        coluna: {
            rotulo: "Eixo",
            valor: (item, estado) => {
                const eixo = (estado.eixos ?? []).find((e) => e.id === item.eixoId);
                return eixo ? esc(eixo.nome) : '<span class="text-muted">Sem eixo</span>';
            },
        },

        html: (item) => `
            <div class="mb-3">
                <label class="form-label" for="f-descricao">Descrição</label>
                <textarea class="form-control" id="f-descricao" rows="3"
                          placeholder="O que este objetivo persegue">${esc(item.descricao ?? "")}</textarea>
            </div>
            ${eixos.html(item.eixoId ? [item.eixoId] : [])}`,

        ligar: (escopo) => eixos.ligar(escopo),

        ler: () => ({ eixoId: eixos.ler()[0] ?? "" }),

        // RF6: o eixo é obrigatório. Um objetivo sem eixo não entra na estrutura
        // do plano — ficaria num nível que a lei não tem.
        regras: (dados) => [
            {
                campo: "f-nome",
                valido: !dados.nome || !objetivoComMesmoNome(dados),
                mensagem: "Já possui um objetivo estratégico cadastrado com mesmo nome",
            },
            { campo: "eix-busca", valido: !!dados.eixoId, mensagem: "Escolha o eixo a que este objetivo pertence." },
        ],
    },

    // `filhos` não aparece mais na tela: nem coluna na listagem, nem campo no
    // formulário. Fica porque é ele que impede excluir um objetivo do qual
    // Programas dependem — apagar aqui deixaria Programas apontando para o nada.
    filhos: [
        {
            colecao: "programas",
            campo: "objetivoId",
            rotulo: "Programas",
            href: "central-programas.html",
            tela: "Cadastro de Programa",
        },
    ],
};
