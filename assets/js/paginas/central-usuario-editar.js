/**
 * Editar usuário — Área Central.
 *
 * Chega-se aqui pela ação **Editar** da Gestão de usuários. O que se edita é o
 * acesso, não a pessoa: **perfil** e **situação**. Nome, e-mail, login e órgão
 * vêm da base funcional e ficam travados — mudá-los aqui seria decidir sobre um
 * dado que não é nosso.
 *
 * A situação é o que permite **inativar**: o usuário aprovado deixa de acessar
 * o SIPLAM, mas guarda os perfis, e volta a ativo sem passar por nova
 * aprovação. Mudar a situação pede justificativa, porque sem segregação de
 * funções o registro de quem fez o quê é o único controle que resta.
 *
 * Quem aguarda aprovação ou foi reprovado não tem situação a editar aqui: a
 * decisão sobre a solicitação mora em `ver.html`, com a ficha inteira à vista.
 */
import { situacaoUsuario, updItem } from "../dados/store.js";
import { montarShell, barraTitulo, somenteLeitura, url } from "../shell.js";
import { esc } from "../ui.js";
import { avisar } from "../toast.js";
import { campoErro, validar, limparAoDigitar } from "../validacao.js";
import { PERFIS } from "../usuarios-decisao.js";

const { estado } = montarShell();
const leitura = somenteLeitura();
const voltar = url("central-usuarios.html");

const id = new URLSearchParams(location.search).get("id");

/** Só estas duas se escolhem na edição; as outras são da decisão da solicitação. */
const EDITAVEIS = ["aprovado", "inativo"];
const ROTULO_OPCAO = { aprovado: "Ativo", inativo: "Inativo" };

function inexistente() {
    document.getElementById("conteudo").innerHTML = `
    <div class="my-4">
        <div class="alert alert-warning py-3 px-3">
            Este usuário não existe mais.
            <a href="${voltar}" class="fw-semibold">Voltar para Gestão de usuários</a>.
        </div>
    </div>`;
}

/** Campo de texto bloqueado: o dado vem da base funcional. */
const campo = (rotulo, valor, largura = "col-md-6") => `
    <div class="${largura}">
        <div class="mb-3">
            <label class="form-label">${esc(rotulo)}</label>
            <input type="text" class="form-control" value="${esc(valor || "—")}" disabled />
        </div>
    </div>`;

function render() {
    const u = (estado.usuarios ?? []).find((x) => x.id === id);
    if (!u) return inexistente();

    const editavel = !leitura && EDITAVEIS.includes(u.situacao);
    const ficha = url(`central-usuarios/ver.html?id=${encodeURIComponent(u.id)}`);

    const situacao = editavel
        ? `<select class="form-select" id="e-situacao">
                ${EDITAVEIS.map((s) => `<option value="${s}" ${u.situacao === s ? "selected" : ""}>${ROTULO_OPCAO[s]}</option>`).join("")}
            </select>
            <div class="form-text fs-12">Inativo perde o acesso ao SIPLAM, mas guarda os perfis.</div>`
        : `<input type="text" class="form-control" value="${esc(situacaoUsuario(u.situacao).rotulo)}" disabled />
            <div class="form-text fs-12">
                ${
                    u.situacao === "aguardando"
                        ? `A solicitação ainda não foi decidida. <a href="${ficha}">Aprove ou reprove na ficha do usuário</a>.`
                        : u.situacao === "reprovado"
                          ? `Solicitação reprovada. Para conceder acesso, <a href="${ficha}">reveja a decisão na ficha do usuário</a>.`
                          : ""
                }
            </div>`;

    document.getElementById("conteudo").innerHTML = `
    ${barraTitulo(esc(u.nome), ["Editar"])}

    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header d-block p-3">
                    <h4 class="card-title mb-1">Usuário</h4>
                    <p class="text-muted mb-0 fs-13">Nome, e-mail, login e órgão vêm da base funcional e não se editam aqui.</p>
                </div>
                <div class="card-body" id="formulario">
                    <div class="row">
                        ${campo("CPF", u.cpf)}
                        ${campo("Nome completo", u.nome)}
                        ${campo("E-mail institucional", u.email)}
                        ${campo("Login", u.login)}
                        ${campo("Órgão", u.orgao)}
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label" for="e-situacao">Situação${editavel ? '<span class="text-danger">*</span>' : ""}</label>
                                ${situacao}
                            </div>
                        </div>
                        <div class="col-12 d-none" id="bloco-justificativa">
                            <div class="mb-3">
                                <label class="form-label" for="e-justificativa">Justificativa<span class="text-danger">*</span></label>
                                <textarea class="form-control" id="e-justificativa" rows="3"
                                          placeholder="Por que a situação do usuário está mudando?"></textarea>
                                ${campoErro("e-justificativa")}
                            </div>
                        </div>
                        <div class="col-12">
                            <div class="mb-0">
                                <label class="form-label" for="e-perfis">Perfil${editavel ? '<span class="text-danger">*</span>' : ""}</label>
                                <div class="d-flex flex-column gap-1" id="e-perfis">
                                    ${PERFIS.map(
                                        (p) => `
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" value="${p.id}" id="e-${p.id}" data-perfil
                                               ${(u.perfis ?? []).includes(p.id) ? "checked" : ""} ${editavel ? "" : "disabled"} />
                                        <label class="form-check-label" for="e-${p.id}">
                                            ${p.nome}
                                            <span class="fs-12 text-muted">· visão ${p.visao}</span>
                                        </label>
                                    </div>`
                                    ).join("")}
                                </div>
                                ${campoErro("e-perfis")}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="mt-1 mb-4 d-flex justify-content-end gap-2 align-items-center">
        <a href="${voltar}" class="btn btn-light">${editavel ? "Cancelar" : "Voltar"}</a>
        ${editavel ? '<button type="button" class="btn btn-primary" id="salvar">Salvar</button>' : ""}
    </div>`;

    if (editavel) ligar(u);
}

function ligar(u) {
    const escopo = document.getElementById("formulario");
    const select = document.getElementById("e-situacao");
    const bloco = document.getElementById("bloco-justificativa");
    limparAoDigitar(escopo);

    // A justificativa só aparece quando a situação muda: editar o perfil não a pede.
    const mudou = () => select.value !== u.situacao;
    select.addEventListener("change", () => bloco.classList.toggle("d-none", !mudou()));

    document.getElementById("salvar").addEventListener("click", () => {
        const situacao = select.value;
        const perfis = [...escopo.querySelectorAll("[data-perfil]:checked")].map((c) => c.value);
        const justificativa = document.getElementById("e-justificativa").value.trim();

        const ok = validar(escopo, [
            { campo: "e-perfis", valido: perfis.length > 0, mensagem: "Escolha ao menos um perfil." },
            { campo: "e-justificativa", valido: !mudou() || !!justificativa, mensagem: "Explique por que a situação está mudando." },
        ]);
        if (!ok) return;

        const patch = { perfis, situacao };
        if (mudou()) {
            patch.situacaoAlteradaEm = new Date().toLocaleDateString("pt-BR");
            patch.situacaoAlteradaPor = estado.analista;
        }
        updItem("usuarios", u.id, patch, mudou() ? justificativa : "");

        avisar(
            !mudou()
                ? "Usuário editado com sucesso."
                : situacao === "inativo"
                  ? "Usuário inativado. O acesso ao SIPLAM foi suspenso."
                  : "Usuário reativado com acesso ao SIPLAM."
        );
        window.location.href = voltar;
    });
}

render();
