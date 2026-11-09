/**
 * Criar e editar Iniciativa — Área Central.
 *
 * Os campos são os da matriz de mapeamento, e na ordem dela:
 *
 *   Nome da iniciativa* (texto) · Descrição da iniciativa (texto) ·
 *   Programa (lista) · Causa e subcausa (lista) · Indicadores (lista)
 *
 * **Status e Motivo saíram do formulário** em 05/11/2026. A Iniciativa nova
 * nasce "Em preenchimento", e o status anda pelo fluxo (envio, análise) na
 * ficha. Ao editar, status e motivo já gravados não são tocados.
 *
 * **Nome sem duplicidade dentro do Programa.** Duas Iniciativas com o mesmo nome
 * no mesmo Programa seriam a mesma contribuição cadastrada duas vezes.
 */
import {
    addIniciativa,
    updIniciativa,
    updItem,
    removeIniciativa,
    vinculosDe,
    descreverVinculos,
    ppaCorrente,
} from "../dados/store.js";
import { montarShell, barraTitulo, somenteLeitura, url } from "../shell.js";
import { esc, chip } from "../ui.js";
import { catalogo } from "../catalogo.js";
import { confirmarExclusao } from "../confirmar.js";
import { avisar } from "../toast.js";
import { campoErro, validar, limparAoDigitar } from "../validacao.js";

// A mesma comparação dos outros cadastros: sem caixa, sem acento, sem espaço nas pontas.
const norm = (v) =>
    String(v ?? "")
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim();

/*
 * Programa e Causa e subcausa são vínculos com cadastros do sistema, e
 * seguem o padrão de todos os vínculos: busca em cima de uma tabela
 * (`catalogo.js`). Ao clicar na busca, a lista mostra tudo o que há; digitar
 * filtra. O Programa é de um só; as causas, de muitas.
 *
 * O Problema saiu do formulário em 05/11/2026. O `problemaId` já gravado não é
 * apagado: salvar não o toca.
 */
const catalogoPrograma = catalogo({
    colecao: "programas",
    singular: "Programa",
    plural: "Programa",
    artigo: "o",
    prefixo: "iprg",
    unico: true,
    semCriar: true,
    campos: [],
    colunasExtra: [{ rotulo: "Código", valor: (p) => esc(p.codigo ?? "—") }],
    detalhe: (p) => [p.codigo, p.eixo].filter(Boolean).join(" · "),
});

const subcausasDe = (c, estado) =>
    (c.subcausaIds ?? []).map((id) => (estado.subcausas ?? []).find((s) => s.id === id)).filter(Boolean);

const catalogoCausas = catalogo({
    colecao: "causas",
    singular: "Causa",
    plural: "Causa e subcausa",
    artigo: "a",
    prefixo: "icau",
    semCriar: true,
    campos: [],
    colunasExtra: [
        {
            rotulo: "Subcausas",
            valor: (c, estado) => {
                const subs = subcausasDe(c, estado);
                return subs.length ? subs.map((s) => chip(esc(s.nome), "neutro")).join(" ") : '<span class="text-muted">—</span>';
            },
        },
    ],
    detalhe: (c, estado) => {
        const subs = subcausasDe(c, estado);
        return subs.length ? `Subcausas: ${subs.map((s) => s.nome).join(", ")}` : "";
    },
});

/**
 * Indicadores: os do cadastro de Indicadores, escolhidos como no Programa. O
 * indicador tem cadastro próprio, com regras que não cabem numa janela de três
 * linhas: aqui só se escolhe o que já existe. Guardado em `indicadorIds`.
 */
const catalogoIndicadores = catalogo({
    colecao: "indicadores",
    singular: "Indicador",
    plural: "Indicadores",
    artigo: "o",
    prefixo: "iind",
    semCriar: true,
    campos: [],
    colunasExtra: [
        { rotulo: "Tipo", valor: (i) => (i.tipo ? esc(i.tipo) : '<span class="text-muted">—</span>') },
        { rotulo: "Unidade", valor: (i) => (i.unidade ? esc(i.unidade) : '<span class="text-muted">—</span>') },
        { rotulo: "Linha de base", valor: (i) => (i.linhaBase ? esc(i.linhaBase) : '<span class="text-muted">—</span>') },
    ],
    detalhe: (i) => [i.tipo, i.unidade].filter(Boolean).join(" · "),
});

export function montarFormularioIniciativa({ novo }) {
    const { estado } = montarShell();
    const leitura = somenteLeitura();
    const voltar = url("central-iniciativas.html");
    const id = new URLSearchParams(location.search).get("id");
    const original = novo ? null : (estado.iniciativas ?? []).find((i) => i.id === id);

    if (!novo && !original) {
        document.getElementById("conteudo").innerHTML = `
        <div class="my-4">
            <div class="alert alert-warning py-3 px-3">
                Esta Iniciativa não existe mais. Ela pode ter sido excluída em outra aba.
                <a href="${voltar}" class="fw-semibold">Voltar para o Cadastro de Iniciativas</a>.
            </div>
        </div>`;
        return;
    }

    const edicao = novo
        ? { nome: "", descricao: "", programaId: "", causas: [] }
        : structuredClone(original);

    const vinculos = novo ? [] : vinculosDe("iniciativas", edicao.id);
    const dis = leitura ? " disabled" : "";
    /**
     * As causas da Iniciativa. O vínculo mora na causa (`iniciativaIds`), que é
     * quem diz por quais Iniciativas é enfrentada.
     */
    const causasDaIniciativa = () =>
        novo ? [] : (estado.causas ?? []).filter((c) => (c.iniciativaIds ?? []).includes(edicao.id)).map((c) => c.id);

    /** Outra Iniciativa do mesmo Programa com o mesmo nome. */
    const mesmoNome = (dados) =>
        (estado.iniciativas ?? []).find(
            (i) => i.id !== edicao.id && (i.programaId ?? "") === dados.programaId && norm(i.nome) === norm(dados.nome)
        );


    function campos() {
        return `
        ${
            vinculos.length
                ? `<div class="alert alert-light border fs-13"><i class="ti ti-lock me-1"></i>Não pode ser excluída: está vinculada a <strong>${esc(descreverVinculos(vinculos))}</strong>. Desfaça esses vínculos antes.</div>`
                : ""
        }
        <div class="mb-3">
            <label class="form-label" for="f-nome">Nome da iniciativa <span class="text-danger">*</span></label>
            <input type="text" class="form-control" id="f-nome" value="${esc(edicao.nome ?? "")}"
                   placeholder="Ampliação da rede pública de alimentação"${dis} />
            ${campoErro("f-nome")}
        </div>

        <div class="mb-3">
            <label class="form-label" for="f-descricao">Descrição da iniciativa</label>
            <textarea class="form-control" id="f-descricao" rows="3"${dis}>${esc(edicao.descricao ?? "")}</textarea>
        </div>

        ${catalogoPrograma.html(edicao.programaId ? [edicao.programaId] : [])}

        ${catalogoCausas.html(causasDaIniciativa())}

        ${catalogoIndicadores.html(edicao.indicadorIds ?? [])}`;
    }

    function acoes() {
        if (leitura) return `<a href="${voltar}" class="btn btn-light">Voltar</a>`;
        const excluir = novo
            ? ""
            : `<button type="button" class="btn btn-danger" id="excluir"
                ${vinculos.length ? `disabled title="Não pode ser excluída: está vinculada a ${esc(descreverVinculos(vinculos))}"` : ""}>
                Excluir
            </button>`;
        return `
        ${excluir}
        <a href="${voltar}" class="btn btn-light">Cancelar</a>
        <button type="button" class="btn btn-primary" id="salvar">${novo ? "Cadastrar" : "Salvar"}</button>`;
    }

    function ler() {
        const v = (c) => document.getElementById(c)?.value ?? "";
        return {
            nome: v("f-nome").trim(),
            descricao: v("f-descricao").trim(),
            programaId: catalogoPrograma.ler()[0] ?? "",
            causaIds: catalogoCausas.ler(),
            indicadorIds: catalogoIndicadores.ler(),
        };
    }

    function render() {
        document.getElementById("conteudo").innerHTML = `
        ${barraTitulo(novo ? "Nova Iniciativa" : "Editar iniciativa", [novo ? "Novo" : "Editar"])}
        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-header d-flex flex-wrap justify-content-between align-items-start gap-2 p-3">
                        <div>
                            <h4 class="card-title mb-1">Cadastro de Iniciativas</h4>
                            <p class="text-muted mb-0 fs-13">A contribuição de um órgão para um Programa do plano.</p>
                        </div>
                        <div class="d-flex gap-2 align-items-center">${acoes()}</div>
                    </div>
                    <div class="card-body" id="formulario">${campos()}</div>
                </div>
            </div>
        </div>`;

        const escopo = document.getElementById("formulario");
        limparAoDigitar(escopo);
        if (leitura) {
            // Só leitura: as listas mostram o vínculo, sem busca nem botão de tirar.
            escopo.querySelectorAll("input, textarea, select, button").forEach((c) => (c.disabled = true));
            return;
        }
        catalogoPrograma.ligar(escopo);
        catalogoCausas.ligar(escopo);
        catalogoIndicadores.ligar(escopo);

        document.getElementById("salvar").addEventListener("click", () => {
            const dados = ler();
            const ok = validar(escopo, [
                { campo: "f-nome", valido: !!dados.nome, mensagem: "Informe o nome da iniciativa." },
                {
                    campo: "f-nome",
                    valido: !dados.nome || !mesmoNome(dados),
                    mensagem: dados.programaId
                        ? "Já possui uma iniciativa cadastrada com mesmo nome neste Programa"
                        : "Já possui uma iniciativa sem Programa cadastrada com mesmo nome",
                },
            ]);
            if (!ok) return;

            const { causaIds, ...campos } = dados;
            // `causas` é o espelho antigo, com o id local da causa dentro do
            // Programa (`ca-<programa>-<local>` vira `<local>`): a ficha e as
            // pendências ainda leem por ele.
            campos.causas = causaIds.map((cid) =>
                campos.programaId && cid.startsWith(`ca-${campos.programaId}-`) ? cid.slice(`ca-${campos.programaId}-`.length) : cid
            );

            let iniId = edicao.id;
            if (novo) {
                iniId = addIniciativa(campos);
                // Sem Programa, é o PPA que liga a Iniciativa ao plano corrente.
                updIniciativa(iniId, { ppaId: ppaCorrente(estado)?.id ?? "", indicadorIds: campos.indicadorIds });
            } else {
                updIniciativa(iniId, campos);
            }

            // O vínculo com a causa mora na causa: acrescenta onde foi escolhida, tira onde deixou de ser.
            const escolhidas = new Set(causaIds);
            for (const c of estado.causas ?? []) {
                const tem = (c.iniciativaIds ?? []).includes(iniId);
                if (escolhidas.has(c.id) && !tem) updItem("causas", c.id, { iniciativaIds: [...(c.iniciativaIds ?? []), iniId] });
                if (!escolhidas.has(c.id) && tem) updItem("causas", c.id, { iniciativaIds: c.iniciativaIds.filter((x) => x !== iniId) });
            }
            avisar(`Iniciativa ${novo ? "criada" : "editada"} com sucesso.`);
            window.location.href = voltar;
        });

        document.getElementById("excluir")?.addEventListener("click", async () => {
            if (vinculos.length) return;
            const justificativa = await confirmarExclusao({
                titulo: "Excluir iniciativa",
                texto: `“${esc(edicao.nome)}” será removida do cadastro.`,
                confirmar: "Excluir",
            });
            if (!justificativa) return;
            const r = removeIniciativa(edicao.id, justificativa);
            if (!r.ok) {
                avisar(r.motivo, "erro");
                return;
            }
            avisar("Iniciativa excluída com sucesso.");
            window.location.href = voltar;
        });
    }

    render();
}
