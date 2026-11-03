/**
 * Gestão de usuários — Área Central.
 *
 * A pessoa se registra sozinha em `registrar.html` e cai aqui como
 * **aguardando aprovação**, sem perfil. O Administrador central lê os dados,
 * aprova ou reprova, e **é na aprovação que o perfil é escolhido** — o papel é
 * concedido, não pedido.
 *
 * Cada linha tem a ação **Editar**, que leva a `central-usuarios/editar.html`.
 * Lá se mudam o perfil e a situação — é por ela que se inativa quem não deve
 * mais acessar. Nome, e-mail, login e órgão seguem travados: vêm da base
 * funcional, e mudá-los aqui seria decidir sobre um dado que não é nosso.
 * Senha não passa por aqui — quem autentica é o Aplicações Expresso.
 *
 * Há um segundo caminho: o Administrador central pode cadastrar alguém sem
 * esperar a pessoa se registrar. Nesse caso o CPF é consultado na base
 * funcional, e os dados vêm de lá — ninguém digita o nome de outra pessoa.
 */
import {
    obterEstado,
    updItem,
    addItem,
    SITUACOES_USUARIO,
    situacaoUsuario,
    buscarNaBaseFuncional,
    cpfValido,
    formatarCpf,
} from "../dados/store.js";
import { montarShell, barraTitulo, somenteLeitura, url } from "../shell.js";
import { criarFiltros, opcoesDe } from "../filtros.js";
import { chip, esc, faixaIndicadores } from "../ui.js";
import { avisar } from "../toast.js";
import { campoErro, validar, limparAoDigitar } from "../validacao.js";
import { PERFIS, nomeDoPerfil } from "../usuarios-decisao.js";

const { estado } = montarShell();
const leitura = somenteLeitura();

const usuarios = () => estado.usuarios ?? [];

/**
 * A ordem é por urgência, não por cadastro: quem aguarda decisão vem primeiro.
 * Uma solicitação nova entra no fim da lista e, com dezenas de aprovados na
 * frente, some da tela — justamente a linha que exige ação.
 */
const URGENCIA = { aguardando: 0, aprovado: 1, inativo: 2, reprovado: 3 };

function visiveis() {
    return usuarios()
        .filter((u) => filtros.passa(u))
        .sort(
            (a, b) =>
                (URGENCIA[a.situacao] ?? 9) - (URGENCIA[b.situacao] ?? 9) ||
                a.nome.localeCompare(b.nome, "pt-BR")
        );
}

/**
 * O filtro espelha a tabela: Usuário no campo livre — que alcança e-mail e
 * login — e Órgão, Perfil e Situação em escolha múltipla.
 */
const filtros = criarFiltros({
    livre: { rotulo: "Usuário", texto: (u) => `${u.nome} ${u.email} ${u.login} ${u.orgao ?? ""}` },
    campos: [
        {
            id: "orgao",
            rotulo: "Órgão",
            icone: "ti-building",
            opcoes: () => opcoesDe(usuarios(), (u) => u.orgao),
            valorDe: (u) => (u.orgao ? [u.orgao] : []),
        },
        {
            id: "perfil",
            rotulo: "Perfil",
            icone: "ti-user-shield",
            opcoes: () =>
                PERFIS.filter((p) => usuarios().some((u) => (u.perfis ?? []).includes(p.id))).map((p) => ({
                    valor: p.id,
                    rotulo: p.nome,
                })),
            valorDe: (u) => u.perfis ?? [],
        },
        {
            id: "situacao",
            rotulo: "Situação",
            icone: "ti-progress",
            opcoes: () =>
                SITUACOES_USUARIO.filter((s) => usuarios().some((u) => u.situacao === s.id)).map((s) => ({
                    valor: s.id,
                    rotulo: s.rotulo,
                })),
            valorDe: (u) => [u.situacao],
        },
    ],
    exportar: "usuarios",
    acao: () => (leitura ? "" : `<button class="btn btn-primary" id="novo"><i class="ti ti-plus me-1"></i>Novo usuário</button>`),
});

function indicadores() {
    const lista = usuarios();
    const conta = (s) => lista.filter((u) => u.situacao === s).length;
    return faixaIndicadores(
        [
            { valor: conta("aguardando"), rotulo: "Aguardando aprovação" },
            { valor: conta("aprovado"), rotulo: "Aprovados" },
            { valor: conta("inativo"), rotulo: "Inativos" },
            { valor: conta("reprovado"), rotulo: "Reprovados" },
        ]
    );
}

function linha(u) {
    const s = situacaoUsuario(u.situacao);
    const semAcesso = u.situacao === "reprovado" || u.situacao === "inativo";
    // Clicar no usuário abre a tela dele, e é lá que se aprova ou reprova. A linha
    // toda é clicável; o nome é um link de verdade, para quem navega pelo teclado.
    const destino = url(`central-usuarios/ver.html?id=${encodeURIComponent(u.id)}`);
    return `
    <tr class="linha-clicavel ${semAcesso ? "text-muted" : ""}" data-href="${destino}">
        <td>
            <a href="${destino}" class="fw-medium text-reset">${esc(u.nome)}</a>
            <span class="fs-12 text-muted d-block">${esc(u.email)}</span>
        </td>
        <td class="codigo">${esc(u.login)}</td>
        <td>${u.orgao ? esc(u.orgao) : '<span class="text-muted">—</span>'}</td>
        <td>
            ${
                u.perfis.length
                    ? `<div class="d-flex flex-wrap gap-1">${u.perfis.map((id) => chip(nomeDoPerfil(id), "neutro")).join("")}</div>`
                    : '<span class="text-muted fs-12">definido na aprovação</span>'
            }
        </td>
        <td>${chip(s.rotulo, s.tom)}</td>
        ${
            leitura
                ? ""
                : `<td class="text-end coluna-acoes">
            <a href="${url(`central-usuarios/editar.html?id=${encodeURIComponent(u.id)}`)}" class="btn btn-sm btn-outline-primary">Editar</a>
        </td>`
        }
    </tr>`;
}

function render() {
    const lista = visiveis();
    document.getElementById("conteudo").innerHTML = `
    ${barraTitulo("Gestão de usuários")}
    ${indicadores()}

    <div class="card">
        ${filtros.html()}
        <div class="table-responsive">
            <table class="table table-sm table-densa align-middle mb-0">
                <thead>
                    <tr>
                        <th>Usuário</th>
                        <th style="width:10rem">Login</th>
                        <th style="width:16rem">Órgão</th>
                        <th style="width:14rem">Perfil</th>
                        <th style="width:11rem">Situação</th>
                        ${leitura ? "" : '<th class="text-end coluna-acoes" style="width:7rem">Ações</th>'}
                    </tr>
                </thead>
                <tbody id="corpo-lista">${lista.length ? lista.map(linha).join("") : vazio()}</tbody>
            </table>
        </div>
    </div>

    <div class="modal fade" id="modal-novo" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" id="modal-novo-conteudo"></div>
        </div>
    </div>`;

    ligar();
}

/* ---------- cadastro pelo Administrador central ---------- */

/** O que a consulta ao CPF trouxe. Fica fora do formulário: não se digita. */
let encontrado = null;
let documento = null;

function corpoNovo(erro = "", cpfDigitado = "") {
    const campo = (rotulo, valor) => `
    <div class="col-6">
        <div class="rotulo-secao mb-1">${rotulo}</div>
        <p class="fs-13 mb-0">${valor ? esc(valor) : "—"}</p>
    </div>`;

    return `
    <div class="modal-header">
        <h5 class="modal-title">Novo usuário</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
    </div>
    <div class="modal-body" id="form-novo">
        <label class="form-label" for="n-cpf">CPF<span class="text-danger">*</span></label>
        <div class="input-group">
            <input type="text" class="form-control" id="n-cpf" inputmode="numeric" autocomplete="off"
                   placeholder="000.000.000-00" maxlength="14" value="${esc(cpfDigitado)}"
                   ${encontrado ? "disabled" : ""} />
            <button class="btn btn-outline-primary" type="button" id="buscar-cpf" ${encontrado ? "disabled" : ""}>
                Buscar
            </button>
        </div>
        <div class="form-text fs-12">Os dados vêm da base funcional do Estado.</div>
        <div class="invalid-feedback d-block" id="n-cpf-erro">${esc(erro)}</div>

        ${
            encontrado
                ? `
        <hr class="my-3" />
        <div class="row g-3 mb-2">
            ${campo("Nome", encontrado.nome)}
            ${campo("E-mail", encontrado.email)}
            ${campo("Login", encontrado.login)}
            ${campo("Órgão", encontrado.orgao)}
        </div>
        <button type="button" class="btn btn-sm btn-link px-0 fs-12" id="trocar-cpf">Consultar outro CPF</button>

        <hr class="my-3" />
        <label class="form-label" for="n-documento">Documento <span class="fs-12 text-muted">(opcional)</span></label>
        <input type="file" class="form-control" id="n-documento" />
        <div class="form-text fs-12" id="ajuda-documento">Portaria, ofício ou o que autoriza o acesso.</div>

        <label class="form-label mt-3" for="n-perfis">Perfil a conceder<span class="text-danger">*</span></label>
        <div class="d-flex flex-column gap-1" id="n-perfis">
            ${PERFIS.map(
                (p) => `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${p.id}" id="n-${p.id}" data-perfil-novo />
                <label class="form-check-label" for="n-${p.id}">
                    ${p.nome}
                    <span class="fs-12 text-muted">· visão ${p.visao}</span>
                </label>
            </div>`
            ).join("")}
        </div>
        ${campoErro("n-perfis")}`
                : ""
        }
    </div>
    <div class="modal-footer">
        <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-primary" id="salvar-novo" ${encontrado ? "" : "disabled"}>
            Cadastrar
        </button>
    </div>`;
}

function desenharNovo(erro = "", cpfDigitado = "") {
    document.getElementById("modal-novo-conteudo").innerHTML = corpoNovo(erro, cpfDigitado);
    ligarNovo();
}

const soDigitos = (valor) => String(valor ?? "").replace(/[^0-9]/g, "");

function ligarNovo() {
    const escopo = document.getElementById("form-novo");
    const cpf = document.getElementById("n-cpf");

    // Formata enquanto digita: o CPF é lido em blocos, não como 11 dígitos seguidos.
    cpf?.addEventListener("input", () => {
        cpf.value = formatarCpf(cpf.value);
        document.getElementById("n-cpf-erro").textContent = "";
    });
    cpf?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("buscar-cpf")?.click();
    });

    document.getElementById("buscar-cpf")?.addEventListener("click", () => {
        const valor = cpf.value.trim();

        if (!cpfValido(valor)) return desenharNovo("CPF inválido. Confira os números.", valor);

        const jaTem = usuarios().find((u) => soDigitos(u.cpf) === soDigitos(valor));
        if (jaTem) return desenharNovo(`${jaTem.nome} já está cadastrado.`, valor);

        const pessoa = buscarNaBaseFuncional(valor);
        if (!pessoa) return desenharNovo("Nenhum servidor encontrado com esse CPF na base funcional.", valor);

        encontrado = pessoa;
        documento = null;
        desenharNovo("", valor);
    });

    document.getElementById("trocar-cpf")?.addEventListener("click", () => {
        encontrado = null;
        documento = null;
        desenharNovo();
    });

    // Sem servidor, o arquivo não sobe: guardamos o nome para a tela mostrar o
    // que foi anexado. O anexo de verdade fica para quando houver back-end.
    document.getElementById("n-documento")?.addEventListener("change", (e) => {
        documento = e.target.files?.[0]?.name ?? null;
        const ajuda = document.getElementById("ajuda-documento");
        if (!ajuda) return;
        ajuda.innerHTML = documento
            ? `Anexado: <strong>${esc(documento)}</strong>.`
            : "Portaria, ofício ou o que autoriza o acesso.";
    });

    limparAoDigitar(escopo);

    document.getElementById("salvar-novo")?.addEventListener("click", () => {
        const perfis = [...escopo.querySelectorAll("[data-perfil-novo]:checked")].map((c) => c.value);
        const ok = validar(escopo, [
            { campo: "n-perfis", valido: perfis.length > 0, mensagem: "Escolha ao menos um perfil." },
        ]);
        if (!ok) return;

        addItem("usuarios", {
            nome: encontrado.nome,
            cpf: encontrado.cpf,
            email: encontrado.email,
            login: encontrado.login,
            orgao: encontrado.orgao,
            documento,
            perfis,
            situacao: "aprovado",
            decididoEm: new Date().toLocaleDateString("pt-BR"),
            decididoPor: estado.analista,
        });
        avisar("Usuário cadastrado com acesso ativo.");
        bootstrap.Modal.getInstance(document.getElementById("modal-novo")).hide();
        render();
    });
}

function abrirNovo() {
    encontrado = null;
    documento = null;
    const el = document.getElementById("modal-novo");
    desenharNovo();
    new bootstrap.Modal(el).show();
    el.addEventListener(
        "hidden.bs.modal",
        () => {
            encontrado = null;
            documento = null;
        },
        { once: true }
    );
}

/**
 * Liga o que a tela precisa depois de desenhada.
 *
 * Só o corpo da tabela se refaz a cada filtro; a barra fica de pé, com o que
 * foi escolhido, e as ações das linhas novas precisam ser religadas.
 */
function ligar() {
    document.getElementById("novo")?.addEventListener("click", abrirNovo);

    filtros.ligar(() => {
        document.getElementById("corpo-lista").innerHTML = visiveis().map(linha).join("") || vazio();
    });

    // O corpo da tabela é refeito a cada filtro, mas o elemento fica: um ouvinte
    // nele serve a todas as linhas, as de agora e as que vierem.
    document.getElementById("corpo-lista").addEventListener("click", (e) => {
        const linhaClicada = e.target.closest("tr[data-href]");
        if (linhaClicada && !e.target.closest("a")) window.location.href = linhaClicada.dataset.href;
    });
}

function vazio() {
    return `<tr><td colspan="${leitura ? 5 : 6}" class="text-center text-muted py-4 fs-12">
        ${usuarios().length ? "Nenhum usuário com esse recorte." : "Nenhuma solicitação de acesso."}
    </td></tr>`;
}

render();
