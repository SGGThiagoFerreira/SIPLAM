import { listaResumida } from "../ui.js";
import { obterEstado, ppaCorrente } from "../dados/store.js";

// A mesma comparação do catálogo: sem caixa, sem acento, sem espaço nas pontas.
const norm = (v) =>
    String(v ?? "")
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim();

/**
 * Outro eixo do plano corrente com o mesmo nome. As etiquetas pertencem ao
 * ciclo, então um PPA seguinte pode repetir o nome de um eixo do anterior.
 */
function eixoComMesmoNome(dados) {
    const estado = obterEstado();
    const plano = ppaCorrente(estado);
    return (estado.eixos ?? []).find(
        (e) =>
            e.id !== dados.id &&
            (!e.ppaId || !plano || e.ppaId === plano.id) &&
            norm(e.nome) === norm(dados.nome)
    );
}

/**
 * Cadastro de Eixos.
 *
 * O eixo é o nível mais alto do plano: reúne os objetivos estratégicos e, por
 * eles, os Programas.
 *
 * Dois campos, e são os da matriz de mapeamento: **nome** e **descrição**. A
 * tabela de objetivos que morava aqui saiu em 06/10/2026 — o vínculo se faz do
 * outro lado, no Objetivo estratégico, que é quem guarda o `eixoId`.
 */
export const eixo = {
    colecao: "eixos",
    pasta: "central-eixo",
    listagem: "central-eixo.html",
    titulo: "Cadastro de Eixos",
    subtitulo: "Os eixos do plano, que reúnem os objetivos estratégicos.",
    novoRotulo: "Novo eixo",
    singular: "Eixo",
    rotuloNome: "Nome do eixo",
    exemplo: "Goiás que cuida",
    podeExcluir: true,

    filtros: [
        { tipo: "inverso", id: "objetivos", rotulo: "Objetivos estratégicos", colecao: "objetivos", campo: "eixoId" },
    ],

    extra: {
        // Dois eixos com o mesmo nome seriam o mesmo eixo, cadastrado duas vezes.
        regras: (dados) => [
            {
                campo: "f-nome",
                valido: !dados.nome || !eixoComMesmoNome(dados),
                mensagem: "Já possui um eixo cadastrado com mesmo nome",
            },
        ],

        colunas: [
            {
                rotulo: "Objetivos estratégicos",
                valor: (item, estado) =>
                    listaResumida(
                        (estado.objetivos ?? [])
                            .filter((o) => o.eixoId === item.id)
                            .map((o) => o.nome)
                            .sort((a, b) => a.localeCompare(b, "pt-BR"))
                    ),
            },
        ],
    },
};
