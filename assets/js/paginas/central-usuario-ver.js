/**
 * Visualizar usuário — Área Central.
 *
 * Quem clica num usuário da lista chega aqui, e é aqui que se decide: **Aprovar**
 * e **Reprovar** moram nesta tela, não mais no menu de cada linha. A lista serve
 * para achar a pessoa; a decisão pede a ficha inteira à vista — dados, perfil
 * pedido, observação e documentos —, e a linha de uma tabela não a comporta.
 *
 * A tela só lê. Os dados são os que a pessoa declarou ao se registrar, e mudar o
 * nome ou o órgão dela aqui seria decidir sobre um dado que não é nosso. O que
 * se decide é o acesso, e só enquanto ele está pendente: depois de aprovar ou
 * reprovar, os botões de decisão somem.
 */
import { situacaoUsuario } from "../dados/store.js";
import { montarShell, barraTitulo, somenteLeitura, url } from "../shell.js";
import { esc, chip } from "../ui.js";
import { abrirAprovacao, abrirReprovacao, nomeDoPerfil, tamanhoLegivel } from "../usuarios-decisao.js";

const { estado } = montarShell();
const leitura = somenteLeitura();
const voltar = url("central-usuarios.html");

const id = new URLSearchParams(location.search).get("id");

function inexistente() {
    document.getElementById("conteudo").innerHTML = `
    <div class="my-4">
        <div class="alert alert-warning py-3 px-3">
            Este usuário não existe mais.
            <a href="${voltar}" class="fw-semibold">Voltar para Gestão de usuários</a>.
        </div>
    </div>`;
}

/**
 * Campo de texto, bloqueado.
 *
 * É o mesmo campo dos formulários, no mesmo desenho, só que desabilitado: esta
 * tela mostra o que a pessoa declarou, e quem analisa não o altera — mudar o
 * nome ou o órgão dela seria decidir sobre um dado que não é nosso.
 */
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

    const s = situacaoUsuario(u.situacao);
    const perfis = (u.perfis ?? []).map(nomeDoPerfil).join(", ");

    // Só se decide o que ainda está pendente. Quem já foi aprovado não oferece
    // "reprovar", e quem foi reprovado não oferece "aprovar": a decisão tomada
    // fica tomada, e o botão que a desfaria não aparece.
    const pendente = !leitura && u.situacao === "aguardando";
    const podeAprovar = pendente;
    const podeReprovar = pendente;

    document.getElementById("conteudo").innerHTML = `
    ${barraTitulo(esc(u.nome), ["Visualizar"])}

    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header d-block p-3">
                    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <div>
                            <h4 class="card-title mb-1">Usuário</h4>
                            <p class="text-muted mb-0 fs-13">Solicitado em ${esc(u.criadoEm ?? "—")}${u.decididoEm ? ` · decidido em ${esc(u.decididoEm)}${u.decididoPor ? ` por ${esc(u.decididoPor)}` : ""}` : ""}</p>
                        </div>
                        ${chip(s.rotulo, s.tom)}
                    </div>
                </div>
                <div class="card-body">
                    ${
                        u.foraDaBase
                            ? `<div class="alert alert-warning py-2 px-3 fs-12">
                        <i class="ti ti-alert-triangle me-1"></i>
                        Este CPF não estava no vínculo funcional: nome, e-mail e login foram digitados pela
                        própria pessoa e não foram conferidos por ninguém.
                    </div>`
                            : ""
                    }
                    <div class="row">
                        ${campo("CPF", u.cpf)}
                        ${campo("Nome completo", u.nome)}
                        ${campo("E-mail institucional", u.email)}
                        ${campo("Login", u.login)}
                        ${campo("Órgão", u.orgao)}
                        ${campo("Perfil pedido", u.perfilSolicitado ? nomeDoPerfil(u.perfilSolicitado) : "")}
                        ${perfis ? campo("Perfil concedido", perfis, "col-12") : ""}
                        <div class="col-12">
                            <div class="mb-3">
                                <label class="form-label">Observação</label>
                                <textarea class="form-control" rows="3" disabled>${esc(u.observacao || "")}</textarea>
                            </div>
                        </div>
                        <div class="col-12">
                            <div class="mb-0">
                                <label class="form-label">Documento</label>
                                ${
                                    (u.anexos ?? []).length
                                        ? `<ul class="list-group">
                                    ${u.anexos
                                        .map(
                                            (a) => `
                                    <li class="list-group-item d-flex align-items-center gap-2 py-2">
                                        <i class="ti ti-paperclip text-muted"></i>
                                        <span class="fs-13 text-truncate">${esc(a.nome)}</span>
                                        <span class="fs-12 text-muted ms-auto">${esc(tamanhoLegivel(a.tamanho))}</span>
                                    </li>`
                                        )
                                        .join("")}
                                </ul>`
                                        : '<input type="text" class="form-control" value="Nenhum documento anexado" disabled />'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="mt-1 mb-4 d-flex justify-content-end gap-2 align-items-center">
        <a href="${voltar}" class="btn btn-light">Voltar</a>
        ${!leitura && !pendente && u.situacao !== "reprovado" ? `<a href="${url(`central-usuarios/editar.html?id=${encodeURIComponent(u.id)}`)}" class="btn btn-outline-primary"><i class="ti ti-pencil me-1"></i>Editar</a>` : ""}
        ${podeReprovar ? '<button type="button" class="btn btn-outline-danger" id="reprovar">Reprovar</button>' : ""}
        ${podeAprovar ? '<button type="button" class="btn btn-primary" id="aprovar">Aprovar</button>' : ""}
    </div>`;

    // Decidir recarrega a tela: a situação mudou, e com ela os botões que cabem.
    document.getElementById("aprovar")?.addEventListener("click", () => abrirAprovacao(u, render));
    document.getElementById("reprovar")?.addEventListener("click", () => abrirReprovacao(u, render));
}

render();
