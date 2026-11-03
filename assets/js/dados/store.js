/**
 * Estado do SIPLAM sobre o localStorage.
 *
 * Substitui o contexto React do protótipo (`src/lib/ppa/store.tsx`) mantendo as
 * mesmas ações e o mesmo formato de estado. Sem servidor: o que o usuário faz
 * fica no navegador dele.
 *
 * Quem altera o estado deve fazê-lo pelas funções daqui — elas cuidam de
 * registrar evento, tocar a data de atualização e gravar.
 */
import { estadoInicial, ANOS, REGIOES, ACOES } from "./seed.js";
import { anosDoPlano } from "./anos.js";
import { PPAS, DESCRICOES_EIXO, DESCRICOES_OBJETIVO, SUBCAUSAS, CAUSAS, INDICADORES } from "./exemplos.js";
import { ESTRUTURA_REAL, PROGRAMAS_PPA } from "./programas-ppa.js";

/**
 * Situações do PPA. Não é uma fila reta: a submissão se bifurca.
 *
 *   elaboração → submetido → aprovado → vigente → encerrado
 *                     ↓
 *                 reprovado → volta para elaboração
 *
 * O corte importante está entre **submetido** e o que vem antes: em elaboração o
 * plano é construído; a partir da submissão ele vira peça formal e não se edita
 * mais. Reprovado é o único estado que anda para trás — e anda porque precisa:
 * o plano volta a ser editável para ser corrigido e submetido de novo.
 *
 * Um plano vigente também muda, mas por alteração — outro caminho, que o sistema
 * ainda não tem.
 */
export const SITUACOES_PPA = [
    { id: "elaboracao", rotulo: "Em elaboração", tom: "info", editavel: true, ajuda: "Em construção pelos órgãos e pela Área Central." },
    { id: "submetido", rotulo: "Submetido", tom: "alerta", editavel: false, ajuda: "Encaminhado para apreciação; não se edita mais." },
    { id: "aprovado", rotulo: "Aprovado", tom: "ok", editavel: false, ajuda: "Aprovado, aguardando o início da vigência." },
    { id: "reprovado", rotulo: "Reprovado", tom: "impeditivo", editavel: false, ajuda: "Não aprovado. Para corrigir, o plano volta à elaboração." },
    { id: "vigente", rotulo: "Vigente", tom: "ok", editavel: false, ajuda: "Em execução. Mudanças só por alteração do plano." },
    { id: "encerrado", rotulo: "Encerrado", tom: "neutro", editavel: false, ajuda: "Ciclo concluído. Permanece para consulta." },
];

export const situacaoPpa = (id) => SITUACOES_PPA.find((s) => s.id === id) ?? SITUACOES_PPA[0];

/**
 * O ano em que um plano é elaborado: o anterior ao primeiro de vigência.
 * O PPA é construído no ano que antecede o ciclo que ele rege.
 */
export const anoDeElaboracao = (ppa) => Number(ppa.primeiroAno) - 1;

/** Onde fica o plano escolhido no cabeçalho. Vale por navegador, como a sessão. */
const CHAVE_PPA = "siplam.ppaSelecionado";

const lerEscolha = () => {
    try {
        return localStorage.getItem(CHAVE_PPA);
    } catch (e) {
        return null;
    }
};

/** Troca o plano em que se está trabalhando. */
export function selecionarPpa(id) {
    try {
        localStorage.setItem(CHAVE_PPA, id);
    } catch (e) {
        console.warn("SIPLAM: não foi possível guardar o plano escolhido.", e);
    }
}

/**
 * O plano a que pertencem os cadastros feitos agora.
 *
 * Vale o que foi escolhido no cabeçalho. Sem escolha — ou se o plano escolhido
 * foi excluído —, o sistema decide: o que está em elaboração, depois o vigente,
 * por último o mais recente. Nada fica órfão.
 */
export function ppaCorrente(estado) {
    const ppas = estado?.ppas ?? [];
    const escolhido = ppas.find((p) => p.id === lerEscolha());
    return (
        escolhido ??
        ppas.find((p) => p.situacao === "elaboracao") ??
        ppas.find((p) => p.situacao === "vigente") ??
        [...ppas].sort((a, b) => Number(b.primeiroAno) - Number(a.primeiroAno))[0] ??
        null
    );
}

/** Os anos cobertos por um plano. */
export function anosDoPpa(ppa) {
    const anos = [];
    for (let a = Number(ppa.primeiroAno); a <= Number(ppa.ultimoAno); a++) anos.push(a);
    return anos;
}

/** Outro plano que ocupa algum dos mesmos anos. Dois PPAs não se sobrepõem. */
export function ppaQueColide(estado, candidato) {
    const anos = new Set(anosDoPpa(candidato));
    return (estado.ppas ?? []).find((p) => p.id !== candidato.id && anosDoPpa(p).some((a) => anos.has(a))) ?? null;
}

/**
 * O plano como entidade, que o protótipo não tinha.
 *
 * É uma lista: o sistema atravessa mais de um ciclo. O ciclo costuma ter quatro anos, mas não
 * sempre — se um governador sai e o vice assume, o plano pode cobrir menos.
 * Por ora são quatro campos; os demais entram depois de conversar com o usuário.
 */
function ppasIniciais() {
    return PPAS.map((p) => ({ ...p }));
}

/**
 * Situações do usuário, na ordem do fluxo.
 *
 *   aguardando → aprovado, ou aguardando → reprovado
 *                   ↕
 *                inativo
 *
 * Quem se registra em `registrar.html` entra como **aguardando**, sem perfil.
 * O perfil é escolhido pelo Administrador central no momento da aprovação — é
 * ele que decide o papel, não quem se cadastrou.
 *
 * **Inativo** é o aprovado cujo acesso foi suspenso na edição do usuário: sai
 * do sistema mas guarda os perfis, para voltar a ativo sem nova aprovação.
 */
export const SITUACOES_USUARIO = [
    { id: "aguardando", rotulo: "Aguardando aprovação", tom: "alerta" },
    { id: "aprovado", rotulo: "Aprovado", tom: "ok" },
    { id: "inativo", rotulo: "Inativo", tom: "neutro" },
    { id: "reprovado", rotulo: "Reprovado", tom: "impeditivo" },
];

export const situacaoUsuario = (id) => SITUACOES_USUARIO.find((s) => s.id === id) ?? SITUACOES_USUARIO[0];

/**
 * Usuários do sistema.
 *
 * `perfis` é lista porque a mesma pessoa pode acumular papéis. Fica vazia
 * enquanto o cadastro aguarda aprovação: quem se registra informa quem é, não
 * o que pode fazer.
 */
function usuariosIniciais() {
    return [
        { id: "us-1", nome: "Vagner Ribeiro", cpf: "071.709.743-98", email: "vagner.ribeiro@exemplo.go", login: "vagner.ribeiro", orgao: "Secretaria de Desenvolvimento Social", perfis: ["setorial"], situacao: "aprovado", criadoEm: "02/03/2026", decididoEm: "04/03/2026", decididoPor: "Maria Fonseca" },
        { id: "us-2", nome: "Maria Fonseca", cpf: "620.256.002-91", email: "maria.fonseca@exemplo.go", login: "maria.fonseca", orgao: "", perfis: ["admin-central"], situacao: "aprovado", criadoEm: "02/03/2026", decididoEm: "02/03/2026", decididoPor: "Maria Fonseca" },
        { id: "us-3", nome: "João Peixoto", cpf: "783.262.215-62", email: "joao.peixoto@exemplo.go", login: "joao.peixoto", orgao: "", perfis: ["admin-central", "gestao-central"], situacao: "aprovado", criadoEm: "15/03/2026", decididoEm: "16/03/2026", decididoPor: "Maria Fonseca" },
        { id: "us-4", nome: "Cláudia Bastos", cpf: "286.946.420-77", email: "claudia.bastos@exemplo.go", login: "claudia.bastos", orgao: "Secretaria de Saúde", perfis: ["setorial", "gestao-setorial"], situacao: "aprovado", criadoEm: "20/04/2026", decididoEm: "22/04/2026", decididoPor: "Maria Fonseca" },
        { id: "us-5", nome: "Tereza Nunes", cpf: "230.925.185-27", email: "tereza.nunes@exemplo.go", login: "tereza.nunes", orgao: "", perfis: ["controle"], situacao: "aprovado", criadoEm: "11/05/2026", decididoEm: "12/05/2026", decididoPor: "João Peixoto" },
        { id: "us-6", nome: "Helena Arantes", cpf: "477.984.131-38", email: "helena.arantes@exemplo.go", login: "helena.arantes", orgao: "Secretaria de Educação", perfis: ["gestao-setorial"], situacao: "aprovado", criadoEm: "03/06/2026", decididoEm: "05/06/2026", decididoPor: "Maria Fonseca" },
        { id: "us-7", nome: "Marcos Tavares", email: "marcos.tavares@exemplo.go", login: "marcos.tavares", orgao: "Secretaria de Meio Ambiente", perfis: ["setorial"], situacao: "aprovado", criadoEm: "19/06/2026", decididoEm: "19/06/2026", decididoPor: "João Peixoto" },

        { id: "us-8", nome: "Renato Camargo", email: "renato.camargo@exemplo.go", login: "renato.camargo", orgao: "Secretaria de Agricultura", perfis: [], situacao: "aguardando", criadoEm: "14/09/2026" },
        { id: "us-9", nome: "Bianca Siqueira", email: "bianca.siqueira@exemplo.go", login: "bianca.siqueira", orgao: "Secretaria de Segurança Pública", perfis: [], situacao: "aguardando", criadoEm: "16/09/2026" },
        { id: "us-10", nome: "Otávio Lemes", email: "otavio.lemes@exemplo.go", login: "otavio.lemes", orgao: "Secretaria de Infraestrutura", perfis: [], situacao: "aguardando", criadoEm: "17/09/2026" },

        { id: "us-11", nome: "Paulo Medeiros", email: "paulo.medeiros@exemplo.go", login: "paulo.medeiros", orgao: "Secretaria de Infraestrutura", perfis: ["setorial"], situacao: "reprovado", criadoEm: "03/02/2026", decididoEm: "05/02/2026", decididoPor: "João Peixoto" },
        { id: "us-12", nome: "Lúcia Andrade", email: "lucia.andrade@exemplo.go", login: "lucia.andrade", orgao: "Secretaria de Indústria e Comércio", perfis: ["setorial", "gestao-setorial"], situacao: "reprovado", criadoEm: "27/01/2026", decididoEm: "29/01/2026", decididoPor: "Maria Fonseca" },

        { id: "us-13", nome: "Sérgio Vilela", email: "sergio.vilela@exemplo.go", login: "sergio.vilela", orgao: "Secretaria de Agricultura", perfis: [], situacao: "reprovado", criadoEm: "28/08/2026", decididoEm: "30/08/2026", decididoPor: "Maria Fonseca" },
        { id: "us-14", nome: "Daniel Prado", email: "daniel.prado@exemplo.go", login: "daniel.prado", orgao: "Secretaria de Saúde", perfis: [], situacao: "reprovado", criadoEm: "09/09/2026", decididoEm: "10/09/2026", decididoPor: "João Peixoto" },
    ];
}

/**
 * Base funcional consultada pelo CPF.
 *
 * No sistema real quem responde é o cadastro corporativo do Estado — o mesmo que
 * o Aplicações Expresso usa. Aqui é uma lista fixa, só para a tela ter o que
 * encontrar: a busca não inventa ninguém, devolve o que existe ou nada.
 */
const BASE_FUNCIONAL = [
    // Fácil de digitar, para testar a busca sem consultar a lista.
    { cpf: "12345678909", nome: "Marcela Andrade Reis", email: "marcela.reis@exemplo.go", login: "marcela.reis", orgao: "Secretaria de Saúde" },
    { cpf: "30310265355", nome: "Ana Lima Prado", email: "ana.prado@exemplo.go", login: "ana.prado", orgao: "Secretaria de Saúde" },
    { cpf: "55154169379", nome: "Carlos Bento Nunes", email: "carlos.nunes@exemplo.go", login: "carlos.nunes", orgao: "Secretaria de Educação" },
    { cpf: "08836478930", nome: "Fernanda Rocha Dias", email: "fernanda.dias@exemplo.go", login: "fernanda.dias", orgao: "Secretaria de Desenvolvimento Social" },
    { cpf: "82096043921", nome: "Gustavo Pinheiro", email: "gustavo.pinheiro@exemplo.go", login: "gustavo.pinheiro", orgao: "Secretaria de Infraestrutura" },
    { cpf: "68997329200", nome: "Juliana Peixoto Sá", email: "juliana.sa@exemplo.go", login: "juliana.sa", orgao: "Secretaria de Meio Ambiente" },
    { cpf: "02856603300", nome: "Rodrigo Teixeira", email: "rodrigo.teixeira@exemplo.go", login: "rodrigo.teixeira", orgao: "Secretaria de Segurança Pública" },
    // Este já está na Gestão de usuários: serve para a tela avisar em vez de duplicar.
    { cpf: "07170974398", nome: "Vagner Ribeiro", email: "vagner.ribeiro@exemplo.go", login: "vagner.ribeiro", orgao: "Secretaria de Desenvolvimento Social" },
];

const digitos = (valor) => String(valor ?? "").replace(/\D/g, "");

/** Formata para 000.000.000-00. */
export const formatarCpf = (valor) => {
    const n = digitos(valor).slice(0, 11);
    return n.replace(/^(\d{3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (_, a, b, c, d) =>
        [a, b && "." + b, c && "." + c, d && "-" + d].join("")
    );
};

/** Dígitos verificadores do CPF. Evita que um erro de digitação vire consulta. */
export function cpfValido(valor) {
    const n = digitos(valor);
    // 111.111.111-11 e afins passam na conta dos dígitos, mas não são CPF.
    if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
    const verificador = (base) => {
        const peso = base.length + 1;
        const soma = [...base].reduce((s, d, i) => s + Number(d) * (peso - i), 0);
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };
    return Number(n[9]) === verificador(n.slice(0, 9)) && Number(n[10]) === verificador(n.slice(0, 10));
}

/** Quem a base funcional conhece com esse CPF. */
export function buscarNaBaseFuncional(cpf) {
    const n = digitos(cpf);
    const achado = BASE_FUNCIONAL.find((p) => p.cpf === n);
    return achado ? { ...achado, cpf: formatarCpf(achado.cpf) } : null;
}

/**
 * Diagnóstico como cadastro, derivado do que já existe dentro dos Programas.
 *
 * O diagnóstico sempre esteve no Programa — problema central, evidências,
 * causas e consequências. As telas de cadastro foram construídas
 * depois, com uma estrutura própria, e nasciam vazias: o sistema mostrava no
 * Hub causas que o Cadastro de Causa jurava não existir.
 *
 * Nada aqui é hierarquia rígida: causa, problema e iniciativa se apontam.
 *
 *   Diagnóstico → aponta para os problemas que ele caracteriza
 *   Problema    → aponta para as causas que o explicam
 *   Causa       → aponta para as Iniciativas que a enfrentam
 *
 * Assim uma mesma causa pode explicar mais de um problema e ser enfrentada por
 * mais de uma Iniciativa, o que uma árvore não permitiria.
 *
 * Só roda quando as coleções estão vazias, para não passar por cima do que
 * alguém tenha cadastrado à mão.
 */
function diagnosticoDosProgramas(programas, iniciativas = [], ppaId = "") {
    const diagnosticos = [];
    const problemas = [];
    const causas = [];

    for (const p of programas) {
        diagnosticos.push({
            id: `dg-${p.id}`,
            ppaId,
            nome: `Diagnóstico ${p.codigo}`,
            descricao: (p.evidencias ?? []).join(" · "),
            problemaIds: p.problema ? [`pb-${p.id}`] : [],
        });

        // Cada Iniciativa guarda, em `causas`, o identificador local das causas
        // que ataca — local porque só é único dentro do Programa. Aqui o vínculo
        // é virado para o lado da causa, com o id inteiro, que não é ambíguo.
        const doPrograma = iniciativas.filter((i) => i.programaId === p.id);
        const vinculadas = [];

        for (const c of p.causas ?? []) {
            const causaId = `ca-${p.id}-${c.id}`;
            const exemplo = CAUSAS[c.texto] ?? {};
            causas.push({
                id: causaId,
                ppaId,
                nome: c.texto,
                justificativa: exemplo.justificativa ?? "",
                evidencia: exemplo.evidencia ?? "",
                // Resolvido para identificadores depois, quando o catálogo de
                // subcausas já existir no estado.
                subcausaNomes: exemplo.subcausas ?? [],
                iniciativaIds: doPrograma.filter((i) => (i.causas ?? []).includes(c.id)).map((i) => i.id),
            });
            vinculadas.push(causaId);
        }

        if (!p.problema) continue;
        problemas.push({
            id: `pb-${p.id}`,
            ppaId,
            nome: p.problema,
            // As evidências do Programa caracterizam o problema; as consequências
            // são o que acontece se ele não for enfrentado. Antes as duas coisas
            // iam para o mesmo campo, e a distinção se perdia.
            descricao: (p.evidencias ?? []).join(" "),
            consequencias: (p.consequencias ?? []).join(" · "),
            // Resolvido para identificadores depois, quando o catálogo de
            // grupos populacionais já existir no estado.
            populacaoNomes: p.populacaoAfetada ? [p.populacaoAfetada] : [],
            // Liga ao Cadastro de Indicadores pelo nome: os indicadores de
            // resultado do Programa e os do cadastro são os mesmos do plano.
            indicadorNomes: (p.indicadores ?? []).map((i) => i.nome),
            causaIds: vinculadas,
        });
    }

    return { diagnosticos, problemas, causas };
}

/**
 * Eixo e Objetivo Estratégico como cadastro, derivados dos Programas.
 *
 * Os dois sempre existiram dentro do Programa, como texto solto: `eixo` e
 * `objetivoEstrategico`. Os filtros do sistema já os tratavam como estrutura —
 * escolher um eixo restringe os objetivos —, mas não havia onde cadastrá-los.
 *
 *   Eixo → Objetivo Estratégico → Programa
 *
 * Os Programas ganham `eixoId` e `objetivoId` para que o vínculo seja por
 * identidade, não por texto igual. Os campos de texto continuam onde estavam:
 * as telas que filtram por eles seguem funcionando.
 */
function estruturaDosProgramas(programas, ppaId = "", prefixo = "") {
    const eixos = [];
    const objetivos = [];
    const porEixo = new Map();
    const porObjetivo = new Map();

    for (const p of programas) {
        if (p.eixo && !porEixo.has(p.eixo)) {
            const eixo = { id: `ex${prefixo}-${porEixo.size + 1}`, ppaId, nome: p.eixo, descricao: DESCRICOES_EIXO[p.eixo] ?? "" };
            porEixo.set(p.eixo, eixo);
            eixos.push(eixo);
        }
        const chave = p.objetivoEstrategico;
        if (chave && !porObjetivo.has(chave)) {
            const objetivo = {
                id: `ob${prefixo}-${porObjetivo.size + 1}`,
                ppaId,
                eixoId: porEixo.get(p.eixo)?.id ?? "",
                nome: chave,
                descricao: DESCRICOES_OBJETIVO[chave] ?? "",
            };
            porObjetivo.set(chave, objetivo);
            objetivos.push(objetivo);
        }
        p.ppaId = ppaId;
        p.eixoId = porEixo.get(p.eixo)?.id ?? "";
        p.objetivoId = porObjetivo.get(chave)?.id ?? "";
    }

    eixos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    objetivos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return { eixos, objetivos };
}

/**
 * Conteúdo do plano vigente, a partir do ciclo em elaboração.
 *
 * O plano de 2024–2027 está em execução: foi elaborado, aprovado e fechado, e é
 * dele que o ciclo seguinte parte. O conteúdo é o mesmo em substância — os
 * Programas do Estado não mudam de um plano para o outro — mas em registros
 * próprios, com identificadores próprios e os anos do seu ciclo.
 *
 * E, por estar fechado, **não tem pendência**: toda meta preenchida, todo
 * comportamento validado, todo território informado, toda Entrega com Ação
 * Orçamentária. Um plano completo ao lado do plano em construção é o que dá
 * medida às telas de pendência.
 */
function planoConcluido(base, ppa) {
    const anos = anosDoPlano(ppa);
    const sufixo = `-${ppa.primeiroAno}`;
    const rid = (id) => `${id}${sufixo}`;

    /** As metas deste ciclo, sem buraco: o que veio do outro plano, e o resto preenchido. */
    function metasCheias(entrega, anteriores) {
        const comportamento = entrega.comportamento ?? entrega.comportamentoSugerido ?? "fluxo";
        const valores = anteriores.filter((v) => v !== null && v !== undefined).map(Number);
        // Sem nenhum valor de referência, um número plausível para o tipo de
        // meta: percentual sobe até perto do teto, quantidade cresce por ano.
        const inicial = valores[0] ?? (comportamento === "percentual" ? 60 : 12);
        const passo = comportamento === "percentual" ? 8 : Math.max(1, Math.round(inicial * 0.2));

        return Object.fromEntries(
            anos.map((ano, i) => {
                const herdado = anteriores[i];
                if (herdado !== null && herdado !== undefined) return [ano, herdado];
                if (comportamento === "marco") return [ano, i === anos.length - 1 ? 1 : 0];
                if (comportamento === "percentual") return [ano, Math.min(98, inicial + passo * i)];
                if (comportamento === "acumulativa") return [ano, inicial + passo * i];
                return [ano, inicial + passo * Math.min(i, 2)];
            })
        );
    }

    const programas = base.programas
        .filter((p) => p.ppaId !== ppa.id)
        .map((p) => ({
            ...structuredClone(p),
            id: rid(p.id),
            ppaId: ppa.id,
            aptidao: "apto",
            disponibilizacao: "disponivel",
        }));

    const iniciativas = base.iniciativas.map((i) => ({
        ...structuredClone(i),
        id: rid(i.id),
        programaId: rid(i.programaId),
        ppaId: ppa.id,
        // Plano fechado: nenhuma contribuição ficou pelo caminho.
        status: "validada",
        atualizadoEm: `31/12/${ppa.primeiroAno}`,
    }));

    // Programa sem Iniciativa é Programa que nenhum órgão atendeu. Num plano
    // concluído isso não acontece: o coordenador responde pelo que restou, com
    // uma contribuição tirada do objetivo e das causas do próprio Programa.
    const orfaos = programas.filter((p) => !iniciativas.some((i) => i.programaId === p.id));
    const iniciativasProprias = orfaos.map((p) => ({
        id: `ini${sufixo}-${p.id}`,
        programaId: p.id,
        ppaId: ppa.id,
        orgao: p.orgaoCoordenador,
        nome: p.resultadoEsperado ?? `Contribuição ao ${p.nome}`,
        descricao: p.objetivo ?? "",
        publicoAlvo: p.populacaoAfetada ?? "",
        causas: (p.causas ?? []).map((c) => c.id),
        status: "validada",
        atualizadoEm: `31/12/${ppa.primeiroAno}`,
        versao: 1,
        unidadeResponsavel: p.orgaoCoordenador,
        resultadoEsperado: p.resultadoEsperado ?? "",
        indicadores: (p.indicadores ?? []).map((ind, n) => ({
            id: `iin${sufixo}-${p.id}-${n + 1}`,
            nome: ind.nome,
            descricao: "",
            unidade: ind.unidade ?? "Unidade",
            formula: "",
            fonte: "Sistema de informação do órgão coordenador",
            periodicidade: "Anual",
            linhaBase: ind.linhaBase ?? "",
            meta: ind.meta ?? "",
        })),
    }));
    iniciativas.push(...iniciativasProprias);

    const entregas = [];
    for (const i of [...base.iniciativas, ...iniciativasProprias]) {
        const suas = base.entregas.filter((e) => e.iniciativaId === i.id);
        // Iniciativa sem Entrega é pendência impeditiva, e num plano concluído
        // não existe: a que faltou nasce do resultado esperado da Iniciativa.
        const fonte = suas.length
            ? suas
            : [
                  {
                      id: `ent-${i.id}`,
                      iniciativaId: i.id,
                      nome: i.resultadoEsperado?.split(",")[0] ?? `Resultado da ${i.nome}`,
                      descricao: i.resultadoEsperado ?? "",
                      unidadeMedida: "Unidade",
                      metodoComprovacao: "",
                      comportamentoSugerido: "acumulativa",
                      metas: {},
                      territorio: { tipo: null, regioes: [] },
                      gomap: "nao",
                  },
              ];

        // As Iniciativas próprias já nascem com o id deste plano; as herdadas
        // do outro ciclo ainda precisam do sufixo.
        const iniciativaId = i.ppaId === ppa.id ? i.id : rid(i.id);

        for (const e of fonte) {
            const anteriores = ANOS.map((a) => e.metas?.[a] ?? null);
            const territorializavel = (e.territorio?.tipo ?? "territorializavel") === "territorializavel";
            entregas.push({
                ...structuredClone(e),
                id: rid(e.id),
                iniciativaId,
                ppaId: ppa.id,
                comportamento: e.comportamento ?? e.comportamentoSugerido ?? "fluxo",
                comportamentoValidado: true,
                metas: metasCheias(e, anteriores),
                metodoComprovacao:
                    e.metodoComprovacao?.trim() ||
                    "Relatório anual de execução, com os registros do sistema do órgão.",
                territorio: territorializavel
                    ? {
                          tipo: "territorializavel",
                          regioes: e.territorio?.regioes?.length ? [...e.territorio.regioes] : [...REGIOES],
                      }
                    : { ...e.territorio },
            });
        }
    }

    const vinculos = base.vinculos
        .filter((v) => entregas.some((e) => e.id === rid(v.entregaId)))
        .map((v) => ({ ...v, id: rid(v.id), entregaId: rid(v.entregaId) }));

    // Toda Entrega de um plano concluído tem Ação Orçamentária: é dela que vem o
    // valor financeiro do PPA, que nunca é digitado.
    const vinculosAcao = [];
    for (const e of entregas) {
        const originais = base.vinculosAcao.filter((v) => rid(v.entregaId) === e.id);
        if (originais.length) {
            vinculosAcao.push(...originais.map((v) => ({ ...v, id: rid(v.id), entregaId: e.id })));
            continue;
        }
        const orgao = iniciativas.find((i) => i.id === e.iniciativaId)?.orgao;
        const acao = ACOES.find((a) => a.orgao === orgao) ?? ACOES[0];
        vinculosAcao.push({ id: `va${sufixo}-${e.id}`, entregaId: e.id, acaoId: acao.id });
    }

    const estrutura = estruturaDosProgramas(programas, ppa.id, sufixo);
    const diagnostico = diagnosticoDosProgramas(programas, iniciativas, ppa.id);

    return { programas, iniciativas, entregas, vinculos, vinculosAcao, ...estrutura, ...diagnostico };
}

/** Junta o conteúdo de um plano ao estado, sem tocar no que já estava lá. */
function acrescentarPlano(base, conteudo) {
    for (const [colecao, itens] of Object.entries(conteudo)) {
        base[colecao] = [...(base[colecao] ?? []), ...itens];
    }
}

const CHAVE = "siplam.estado.v1";

const uid = () => Math.random().toString(36).slice(2, 9);
const hoje = () => new Date().toLocaleDateString("pt-BR");

let estado = null;
const ouvintes = new Set();

/* ---------- persistência ---------- */

function carregar() {
    let base = null;
    try {
        const bruto = localStorage.getItem(CHAVE);
        if (bruto) base = JSON.parse(bruto);
    } catch (e) {
        // Estado incompatível ou armazenamento bloqueado: recomeça do seed.
        console.warn("SIPLAM: não foi possível ler o estado salvo, usando os dados de demonstração.", e);
    }
    if (!base) base = estadoInicial();
    // Estado gravado antes de o PPA existir como entidade.
    // Estado gravado antes de o PPA existir, ou quando ele ainda era único.
    if (!base.ppas) base.ppas = base.ppa ? [base.ppa] : ppasIniciais();
    // Estado gravado quando o seed tinha só o plano em elaboração: o plano
    // vigente entra junto, para que haja um ciclo em execução a que o próximo
    // suceda. Só no estado intocado — plano apagado de propósito não volta.
    if (base.ppas.length === 1 && base.ppas[0].id === "ppa-2028") {
        base.ppas.unshift(ppasIniciais()[0]);
    }
    delete base.ppa;

    aplicarPlanoReal(base);

    // Estrutura do plano: eixos e objetivos, derivados dos Programas.
    for (const colecao of ["eixos", "objetivos"]) {
        if (!base[colecao]) base[colecao] = [];
    }
    if (!base.eixos.length && !base.objetivos.length) {
        Object.assign(base, estruturaDosProgramas(base.programas ?? [], ppaCorrente(base)?.id ?? ""));
    }

    // Coleções de cadastro do diagnóstico, mais o cadastro de indicadores.
    // `indicadores` nasce vazio: os indicadores que já existem hoje vivem dentro
    // do Programa e da Iniciativa, e continuam lá.
    for (const colecao of ["diagnosticos", "problemas", "causas", "indicadores", "subcausas", "populacoes"]) {
        if (!base[colecao]) base[colecao] = [];
    }
    // A causa deixou de pendurar no problema; estado gravado nessa forma é
    // refeito do seed. O subproblema, esse não voltou.
    delete base.subproblemas;
    const forma = base.causas.some((c) => c.problemaId !== undefined || c.diagnosticoId !== undefined);
    if (forma || (!base.diagnosticos.length && !base.problemas.length && !base.causas.length)) {
        const derivado = diagnosticoDosProgramas(base.programas ?? [], base.iniciativas ?? [], ppaCorrente(base)?.id ?? "");
        // As causas são refeitas, mas o catálogo de subcausas é cadastro à parte
        // e não se desfaz com elas.
        Object.assign(base, derivado);
    }

    // O plano vigente nasce completo, com o conteúdo do ciclo seguinte. Só é
    // preenchido se ainda não tiver nada: quem apagou seus Programas apagou.
    const vigente = base.ppas.find((p) => p.situacao === "vigente");
    if (vigente && !base.programas.some((p) => p.ppaId === vigente.id)) {
        acrescentarPlano(base, planoConcluido(base, vigente));
    }

    completarCadastros(base);

    // A subcausa saiu de dentro da causa e virou cadastro do sistema. Estado
    // gravado com elas aninhadas é convertido: o texto vai para a coleção e a
    // causa fica com os identificadores.
    for (const c of base.causas) {
        if (!Array.isArray(c.subcausas)) continue;
        c.subcausaIds = c.subcausas.map((s) => {
            const igual = base.subcausas.find(
                (x) => x.nome.toLocaleLowerCase("pt-BR") === (s.nome ?? "").toLocaleLowerCase("pt-BR")
            );
            if (igual) return igual.id;
            const novo = { ...s, id: s.id || `sc-${uid()}`, ppaId: c.ppaId ?? "" };
            base.subcausas.push(novo);
            return novo.id;
        });
        delete c.subcausas;
    }

    // Estado gravado antes de existir o cadastro de usuários.
    if (!base.usuarios) base.usuarios = usuariosIniciais();
    // Usuários gravados quando a situação era "ativo"/"revogado" e não havia login.
    // "inativo" não se converte: voltou a existir, como acesso suspenso.
    for (const u of base.usuarios) {
        if (u.situacao === "ativo") u.situacao = "aprovado";
        if (u.situacao === "revogado") u.situacao = "inativo";
        if (!u.login) u.login = (u.email ?? "").split("@")[0];
    }

    // O valor previsto deixou de ser campo: passou a ser a soma das Ações
    // Orçamentárias vinculadas. Planos gravados com o número digitado o perdem.
    for (const ppa of base.ppas) {
        delete ppa.valorPrevisto;
        if (!ppa.situacao) ppa.situacao = "elaboracao";
        if (ppa.processoSei === undefined) ppa.processoSei = "";
    }
    // Histórico de ações nos cadastros (auditoria). Estado antigo nasce sem eventos.
    if (!Array.isArray(base.auditoria)) base.auditoria = [];
    // Protótipo: um histórico de exemplo, uma vez só, para a lista não nascer vazia.
    if (!base.auditoriaSemeada) {
        base.auditoriaSemeada = true;
        if (!base.auditoria.length) base.auditoria = historicoDeExemplo(base);
    }

    return base;
}

/**
 * Põe o conteúdo do PPA 2024–2027 de Goiás no lugar do conteúdo genérico.
 *
 * Os dez Programas que o protótipo já tinha carregam Iniciativas e Entregas, e
 * por isso não são substituídos: ganham o código e o eixo que têm no plano de
 * verdade. Os demais Programas do plano entram ao lado deles, ainda sem
 * contribuição de órgão — que é a situação real de um ciclo em elaboração.
 *
 * Roda antes de derivar eixos, objetivos e diagnóstico, porque é dos Programas
 * que os três saem.
 */
function aplicarPlanoReal(base) {
    for (const p of base.programas ?? []) {
        const real = ESTRUTURA_REAL[p.id];
        if (!real) continue;
        p.codigo = real.codigo;
        p.eixo = real.eixo;
        p.objetivoEstrategico = real.objetivo;
    }

    for (const novo of PROGRAMAS_PPA) {
        if (base.programas.some((p) => p.id === novo.id)) continue;
        base.programas.push({ ...structuredClone(novo), aptidao: "apto", disponibilizacao: "disponivel" });
    }
}

/**
 * O que os cadastros novos precisam para não nascerem vazios.
 *
 * Roda na carga e no reinício: tela vazia não se avalia, e quem abre o
 * protótipo pela primeira vez precisa ver o cadastro cheio para dizer se o
 * campo está no lugar certo. Só preenche o que estiver vazio — quem apagou,
 * apagou.
 */
function completarCadastros(base) {
    const ppaId = ppaCorrente(base)?.id ?? "";

    if (!base.subcausas?.length) {
        base.subcausas = SUBCAUSAS.map(([nome, justificativa, evidencia], n) => ({
            id: `sc-${n + 1}`,
            ppaId,
            nome,
            justificativa,
            evidencia,
            criadoEm: hoje(),
        }));
    }

    if (!base.indicadores?.length) {
        // A ordem dos campos espelha a do formulário, para conferir lado a lado.
        base.indicadores = INDICADORES.map(
            (
                [nome, descricao, formula, polaridade, periodicidade, unidade, fonte, site, abrangencia, linhaBase, dataLinhaBase, orgaos, situacao],
                n
            ) => ({
                id: `in-${String(n + 1).padStart(3, "0")}`,
                ppaId,
                nome,
                descricao,
                formula,
                polaridade,
                periodicidade,
                unidade,
                fonte,
                site,
                abrangencia,
                linhaBase,
                dataLinhaBase,
                orgaos,
                situacao,
                responsavelTecnico: "Armando Melo e Santos",
                criadoEm: hoje(),
            })
        );
    }

    /**
     * Os indicadores que moram dentro do Programa viram cadastro.
     *
     * O Programa sempre guardou os seus indicadores de resultado como uma lista
     * aninhada — nome, unidade, linha de base —, e o Cadastro de Indicadores foi
     * construído depois, com outros. Quem abria o Programa para editar via zero
     * indicadores onde havia dois, e salvar os apagava. Aqui cada um que o cadastro
     * ainda não tem passa a ter, e o Programa passa a apontar para eles pelo
     * identificador — que é o vínculo que a matriz de mapeamento descreve.
     */
    const proximoNumero = () =>
        (base.indicadores ?? []).reduce((m, i) => Math.max(m, Number(String(i.id).replace(/\D/g, "")) || 0), 0) + 1;
    for (const prog of base.programas ?? []) {
        if (Array.isArray(prog.indicadorIds)) continue;

        prog.indicadorIds = (prog.indicadores ?? []).map((legado) => {
            const achado = base.indicadores.find((i) => i.nome === legado.nome);
            if (achado) return achado.id;
            const novo = {
                id: `in-${String(proximoNumero()).padStart(3, "0")}`,
                ppaId: prog.ppaId ?? ppaId,
                nome: legado.nome,
                descricao: "",
                tipo: "Resultado",
                unidade: legado.unidade ?? "",
                linhaBase: legado.linhaBase ?? "",
                situacao: "Ativo",
                metas: [],
                criadoEm: hoje(),
            };
            base.indicadores.push(novo);
            return novo.id;
        });
    }

    /**
     * O vocabulário dos indicadores passou a ser o da matriz de mapeamento
     * (06/10/2026). Quatro listas tinham sido preenchidas sem referência — as que
     * a matriz agora define —, e o estado já gravado traz os valores antigos.
     * Cada um vira o seu equivalente; o que não tem equivalente fica como está,
     * e a tela o mantém escolhível em vez de apagá-lo.
     */
    const TROCA = {
        polaridade: { "Quanto maior, melhor": "Maior-Melhor", "Quanto menor, melhor": "Menor-Melhor", "Quanto mais próximo da meta, melhor": "" },
        unidade: { Unidade: "Número absoluto" },
        abrangencia: { Regional: "Regional (região de planejamento)" },
        situacao: { Novo: "Em construção", "Em uso": "Ativo", "Em revisão": "Em construção" },
    };
    for (const ind of base.indicadores ?? []) {
        for (const [campo, mapa] of Object.entries(TROCA)) {
            if (Object.hasOwn(mapa, ind[campo])) ind[campo] = mapa[ind[campo]];
        }
        ind.metas ??= [];
    }

    // A descrição do Programa passou a ser obrigatória (matriz de mapeamento) e
    // boa parte dos Programas anteriores não a tem. O objetivo é o texto mais
    // próximo do que uma descrição diria; sem ele, editar qualquer um desses
    // Programas esbarraria num campo vazio que a pessoa nem sabe o que pôr.
    for (const p of base.programas ?? []) {
        if (!p.descricao?.trim() && p.objetivo?.trim()) p.descricao = p.objetivo;
    }

    // As causas guardam nomes de subcausa até aqui; agora viram vínculo por
    // identidade, que é o que o cadastro usa.
    for (const c of base.causas ?? []) {
        if (!Array.isArray(c.subcausaNomes)) continue;
        c.subcausaIds = c.subcausaNomes.map((nome) => base.subcausas.find((s) => s.nome === nome)?.id).filter(Boolean);
        delete c.subcausaNomes;
    }

    // O mesmo para os indicadores do problema.
    for (const pb of base.problemas ?? []) {
        if (!Array.isArray(pb.indicadorNomes)) continue;
        pb.indicadorIds = pb.indicadorNomes
            .map((nome) => base.indicadores.find((i) => i.nome === nome)?.id)
            .filter(Boolean);
        delete pb.indicadorNomes;
    }

    /**
     * Grupos populacionais: catálogo do sistema, como as subcausas.
     *
     * O mesmo grupo é atingido por mais de um problema — "famílias em
     * insegurança alimentar grave" aparece na alimentação e na renda. Guardado
     * dentro de cada problema, seria redigitado a cada vez, com outra grafia.
     */
    const grupo = (nome) => {
        const achado = base.populacoes.find((g) => g.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"));
        if (achado) return achado.id;
        const novo = { id: `pop-${base.populacoes.length + 1}`, ppaId, nome, estimativa: "", criadoEm: hoje() };
        base.populacoes.push(novo);
        return novo.id;
    };

    for (const pb of base.problemas ?? []) {
        // Estado gravado quando a população afetada era lista dentro do problema.
        if (Array.isArray(pb.populacaoAfetada) && pb.populacaoAfetada.length && !Array.isArray(pb.populacaoNomes)) {
            pb.populacaoNomes = pb.populacaoAfetada.map((g) => g.grupo).filter(Boolean);
        }
        if (!Array.isArray(pb.populacaoNomes)) continue;
        pb.populacaoIds = pb.populacaoNomes.filter(Boolean).map(grupo);
        delete pb.populacaoNomes;
        delete pb.populacaoAfetada;
    }
}

function gravar() {
    try {
        localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (e) {
        console.warn("SIPLAM: não foi possível gravar o estado.", e);
    }
    ouvintes.forEach((fn) => fn(estado));
}

/** Estado atual. Carrega do armazenamento na primeira chamada. */
export function obterEstado() {
    if (!estado) {
        estado = carregar();
        // O que a carga completou — planos, estrutura, diagnóstico — fica
        // gravado. Fora daqui há quem leia o estado direto do armazenamento,
        // como `anos.js`, e leria uma versão anterior à migração.
        gravar();
    }
    return estado;
}

/** Recebe o estado a cada alteração. Devolve a função que cancela a inscrição. */
export function aoMudar(fn) {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
}

/**
 * O recorte do plano corrente.
 *
 * Um PPA por vez: nenhuma lista mistura ciclos. O vínculo do registro com o
 * plano é o Programa — Iniciativa e Entrega pertencem ao plano do Programa de
 * onde descendem. Registro sem `ppaId` é anterior ao vínculo e fica visível,
 * senão sumiria sem que ninguém pudesse alcançá-lo.
 */
export function noPlano(estado) {
    const plano = ppaCorrente(estado);
    const programas = (estado.programas ?? []).filter((p) => !p.ppaId || !plano || p.ppaId === plano.id);
    const idsPrograma = new Set(programas.map((p) => p.id));
    const idsIniciativa = new Set(
        (estado.iniciativas ?? []).filter((i) => idsPrograma.has(i.programaId)).map((i) => i.id)
    );
    return {
        programas,
        programa: (p) => idsPrograma.has(p.id),
        iniciativa: (i) => idsPrograma.has(i.programaId),
        entrega: (e) => idsIniciativa.has(e.iniciativaId),
    };
}

/** Volta aos dados de demonstração. */
export function reiniciar() {
    estado = estadoInicial();
    estado.ppas = ppasIniciais();
    aplicarPlanoReal(estado);
    Object.assign(estado, estruturaDosProgramas(estado.programas, ppaCorrente(estado)?.id ?? ""));
    Object.assign(estado, diagnosticoDosProgramas(estado.programas, estado.iniciativas, ppaCorrente(estado)?.id ?? ""));
    const vigente = estado.ppas.find((p) => p.situacao === "vigente");
    if (vigente) acrescentarPlano(estado, planoConcluido(estado, vigente));
    estado.usuarios = usuariosIniciais();
    estado.subcausas = [];
    estado.indicadores = [];
    estado.populacoes = [];
    completarCadastros(estado);
    gravar();
}

/* ---------- Cadastros (diagnóstico, problema, causa) ---------- */

/**
 * CRUD genérico das coleções de cadastro. Todas têm a mesma forma —
 * identificação, descrição e o vínculo com o nível acima — então uma função
 * serve as quatro.
 */
/* ---------- Histórico (auditoria) ---------- */

/** Eventos de exemplo, montados sobre registros que existem, do mais novo para o mais antigo. */
function historicoDeExemplo(base) {
    const eventos = [];
    const ppaCorr = base.ppas.find((p) => p.situacao === "elaboracao") ?? base.ppas[0];
    const quando = (diasAtras, hora) => {
        const d = new Date();
        d.setDate(d.getDate() - diasAtras);
        d.setHours(hora, 12, 0, 0);
        return d;
    };
    const add = (dias, hora, ator, perfil, colecao, registro, acao, extra = {}) => {
        const d = quando(dias, hora);
        eventos.push({
            id: `au-ex${eventos.length}`,
            em: d.toISOString(),
            dataHora: `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
            colecao,
            registroId: registro.id,
            registroNome: nomeDoRegistro(registro),
            acao,
            acaoOriginal: "",
            ator,
            perfil,
            ppaId: colecao === "ppas" ? registro.id : (registro.ppaId ?? ppaCorr?.id ?? null),
            campos: [],
            antes: null,
            depois: null,
            reverte: null,
            justificativa: "",
            revertidoPor: null,
            ...extra,
        });
    };
    const eixo = base.eixos.find((e) => e.ppaId === ppaCorr?.id) ?? base.eixos[0];
    const objetivo = base.objetivos.find((o) => o.ppaId === ppaCorr?.id) ?? base.objetivos[0];
    const programa = base.programas.find((p) => p.ppaId === ppaCorr?.id) ?? base.programas[0];
    const causa = (base.causas ?? [])[0];

    if (causa) add(0, 15, "João Peixoto", "admin-central", "causas", causa, "editou", { campos: ["descricao"], antes: { descricao: "Texto anterior da descrição." }, depois: { descricao: causa.descricao ?? "" } });
    if (programa) add(1, 10, "Maria Fonseca", "admin-central", "programas", programa, "editou", { campos: ["eixo"], antes: { eixo: "Eixo anterior" }, depois: { eixo: programa.eixo ?? "" } });
    if (objetivo) add(2, 16, "Maria Fonseca", "admin-central", "objetivos", objetivo, "criou", { campos: Object.keys(objetivo), depois: clone(objetivo) });
    if (eixo) add(3, 9, "João Peixoto", "gestao-central", "eixos", eixo, "editou", { campos: ["descricao"], antes: { descricao: "Descrição revisada em reunião de alinhamento." }, depois: { descricao: eixo.descricao ?? "" } });
    if (ppaCorr) add(4, 14, "João Peixoto", "admin-central", "ppas", ppaCorr, "editou", { campos: ["situacao"], antes: { situacao: "elaboracao" }, depois: { situacao: ppaCorr.situacao }, justificativa: "Plano devolvido para ajustes dos órgãos setoriais." });
    add(6, 11, "Maria Fonseca", "admin-central", "eixos", { id: "eixo-duplicado", nome: "Eixo duplicado" }, "excluiu", {
        campos: ["nome"],
        antes: { id: "eixo-duplicado", nome: "Eixo duplicado", ppaId: ppaCorr?.id },
        justificativa: "Cadastro duplicado, já existia um eixo com o mesmo nome.",
    });
    return eventos;
}

/*
 * Toda criação, edição e exclusão nos cadastros deixa um evento aqui: quem, quando, o que era antes e o
 * que ficou. O log só cresce — reverter uma ação não a apaga, acrescenta outro evento com a justificativa
 * (RNF1 e RNF2 do documento de requisitos).
 */

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const LIMITE_AUDITORIA = 500;
const ROTULO_ACAO = { criou: "Criou", editou: "Editou", excluiu: "Excluiu", reverteu: "Reverteu" };

function atorAtual() {
    let nome = null;
    let perfil = "";
    try {
        nome = localStorage.getItem("siplam.usuario");
        perfil = localStorage.getItem("siplam.perfilSessao") || localStorage.getItem("siplam.perfil") || "";
    } catch (e) {
        /* navegador sem armazenamento */
    }
    return { nome: nome || estado.analista || "Sistema", perfil };
}

const nomeDoRegistro = (r) => r?.nome ?? r?.titulo ?? r?.id ?? "—";

/** O plano a que o registro pertence: o próprio PPA, ou o `ppaId` do registro. */
const planoDoRegistro = (colecao, r) => (colecao === "ppas" ? r?.id : r?.ppaId) ?? "";

function registrarAuditoria({ colecao, registro, acao, antes, depois, campos, reverte = null, justificativa = "", acaoOriginal = "" }) {
    if (!estado.auditoria) estado.auditoria = [];
    const ator = atorAtual();
    const agora = new Date();
    const evento = {
        id: `au-${uid()}${uid()}`,
        em: agora.toISOString(),
        dataHora: `${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        colecao,
        registroId: registro.id,
        registroNome: nomeDoRegistro(registro),
        acao,
        acaoOriginal,
        ator: ator.nome,
        perfil: ator.perfil,
        ppaId: planoDoRegistro(colecao, registro),
        campos,
        antes,
        depois,
        reverte,
        justificativa,
        revertidoPor: null,
    };
    estado.auditoria.unshift(evento);
    if (estado.auditoria.length > LIMITE_AUDITORIA) estado.auditoria.length = LIMITE_AUDITORIA;
    return evento;
}

/** Aplica o patch e registra só o que de fato mudou; patch sem mudança não deixa evento. */
function editarComAuditoria(colecao, item, patch, justificativa = "") {
    const campos = Object.keys(patch).filter((k) => !igual(item[k], patch[k]));
    const antes = {};
    const depois = {};
    campos.forEach((k) => {
        antes[k] = clone(item[k]);
        depois[k] = clone(patch[k]);
    });
    Object.assign(item, patch);
    if (campos.length) registrarAuditoria({ colecao, registro: item, acao: "editou", antes, depois, campos, justificativa });
}

export const eventosDeAuditoria = () => estado?.auditoria ?? [];

export const ROTULO_CADASTRO = {
    ppas: "PPA",
    programas: "Programa",
    eixos: "Eixo",
    objetivos: "Objetivo estratégico",
    causas: "Causa",
    subcausas: "Subcausa",
    problemas: "Problema",
    populacoes: "População afetada",
    indicadores: "Indicador",
    usuarios: "Usuário",
    iniciativas: "Iniciativa",
    entregas: "Entrega",
    diagnosticos: "Diagnóstico",
    vinculos: "Vínculo de Projeto",
    vinculosAcao: "Vínculo de Ação Orçamentária",
};

// O histórico do próprio registro (tramitação, comentários, auditoria) não é vínculo: some junto com ele.
const SEM_VINCULO = new Set(["auditoria", "eventos", "comentarios"]);

/**
 * Quem aponta para o registro. Devolve `[{ colecao, rotulo, qtd }]`; vazio quer dizer que ele está livre.
 *
 * É a regra única de exclusão: algo que já está vinculado não se exclui, nem pela tela nem por aqui, e a
 * reversão de uma criação também a respeita. A busca é pelo id em qualquer outro registro do estado, o que
 * pega os vínculos de hoje e os de amanhã sem manter uma lista de quem aponta para quem.
 */
export function vinculosDe(colecao, id) {
    const registro = (estado[colecao] ?? []).find((r) => r.id === id);
    if (!registro) return [];
    const contagem = new Map();
    const soma = (c) => contagem.set(c, (contagem.get(c) ?? 0) + 1);
    for (const [nomeColecao, lista] of Object.entries(estado)) {
        if (!Array.isArray(lista) || SEM_VINCULO.has(nomeColecao)) continue;
        // usuário carrega o `ppaId` do plano em que se cadastrou, mas não está “dentro” dele
        if (colecao === "ppas" && nomeColecao === "usuarios") continue;
        for (const r of lista) {
            if (nomeColecao === colecao && r.id === id) continue;
            if (JSON.stringify(r).includes(`"${id}"`)) soma(nomeColecao);
        }
    }
    // Eixo e objetivo estratégico são apontados pelo nome nos Programas.
    if (colecao === "eixos") estado.programas.filter((p) => p.eixo === registro.nome).forEach(() => soma("programas"));
    if (colecao === "objetivos") estado.programas.filter((p) => p.objetivoEstrategico === registro.nome).forEach(() => soma("programas"));
    return [...contagem].map(([c, qtd]) => ({ colecao: c, rotulo: ROTULO_CADASTRO[c] ?? c, qtd }));
}

export const descreverVinculos = (v) => v.map((x) => `${x.rotulo} (${x.qtd})`).join(", ");

/** Excluir exige justificativa e registro livre de vínculos. */
function podeExcluir(colecao, registro, justificativa) {
    const texto = String(justificativa ?? "").trim();
    if (texto.length < 20) return { ok: false, motivo: "Justifique a exclusão com ao menos 20 caracteres." };
    const v = vinculosDe(colecao, registro.id);
    if (v.length) return { ok: false, motivo: `Não pode ser excluído: está vinculado a ${descreverVinculos(v)}.`, vinculos: v };
    return { ok: true, texto };
}

/**
 * Dá para reverter este evento? Devolve `{ ok: true }` ou `{ ok: false, motivo }`.
 *
 * As travas existem para não sobrescrever trabalho de outra pessoa: só o Administrador central reverte;
 * um evento só se reverte uma vez; se o registro mudou depois, reverte-se primeiro o mais recente;
 * criação não se reverte se algo já aponta para o registro; e registros de um plano fora da elaboração
 * só mudam pelo fluxo de alteração.
 */
export function avaliarReversao(evento) {
    const { perfil } = atorAtual();
    if (perfil !== "admin-central") return { ok: false, motivo: "Só o Administrador central reverte ações." };
    if (!evento) return { ok: false, motivo: "Evento não encontrado." };
    if ((evento.colecao === "iniciativas" || evento.colecao === "entregas") && evento.acao === "excluiu") {
        return { ok: false, motivo: "Excluir Iniciativa ou Entrega leva junto vínculos e histórico, e não se reverte por aqui." };
    }
    if (evento.revertidoPor) return { ok: false, motivo: `Este evento já foi revertido por ${evento.revertidoPor.por} em ${evento.revertidoPor.em}.` };

    const doRegistro = (estado.auditoria ?? []).filter((e) => e.colecao === evento.colecao && e.registroId === evento.registroId);
    const instante = new Date(evento.em).getTime();
    const posteriores = doRegistro.filter((e) => {
        if (e.id === evento.id || new Date(e.em).getTime() <= instante || e.revertidoPor) return false;
        // reversão de um evento ainda mais novo devolve o registro ao estado anterior: não conta como mudança
        if (e.reverte) {
            const original = doRegistro.find((x) => x.id === e.reverte);
            if (original && new Date(original.em).getTime() > instante) return false;
        }
        return true;
    });
    if (posteriores.length) {
        const m = posteriores[0];
        return { ok: false, motivo: `O registro mudou depois (${ROTULO_ACAO[m.acao] ?? m.acao} em ${m.dataHora}, por ${m.ator}). Reverta primeiro a ação mais recente.` };
    }

    if (evento.colecao !== "usuarios" && evento.ppaId) {
        const plano = estado.ppas.find((p) => p.id === evento.ppaId);
        if (plano && plano.situacao !== "elaboracao") {
            return { ok: false, motivo: "O plano não está em elaboração. Mudar um plano já fechado é o fluxo de alteração, que ainda não existe." };
        }
    }

    const lista = estado[evento.colecao] ?? [];
    const atual = lista.find((r) => r.id === evento.registroId);
    if (evento.antes === null) {
        if (!atual) return { ok: false, motivo: "O registro criado por este evento já não existe." };
        const quem = vinculosDe(evento.colecao, atual.id);
        if (quem.length) return { ok: false, motivo: `Há registros que apontam para ele (${descreverVinculos(quem)}). Remova esses vínculos antes.` };
    } else if (evento.depois === null) {
        if (atual) return { ok: false, motivo: "O registro excluído por este evento já foi recriado." };
    } else {
        if (!atual) return { ok: false, motivo: "O registro já não existe." };
        const mudou = evento.campos.filter((k) => !igual(atual[k], evento.depois[k]));
        if (mudou.length) return { ok: false, motivo: "O valor atual não é mais o que este evento gravou." };
    }
    return { ok: true };
}

/** Reverte um evento, com justificativa. Devolve `{ ok }` ou `{ ok: false, motivo }`. */
export function reverterEvento(eventoId, justificativa) {
    const ev = (estado.auditoria ?? []).find((e) => e.id === eventoId);
    const aval = avaliarReversao(ev);
    if (!aval.ok) return aval;
    const texto = String(justificativa ?? "").trim();
    if (texto.length < 20) return { ok: false, motivo: "Justifique a reversão com ao menos 20 caracteres." };

    let registro;
    let antes;
    let depois;
    if (ev.antes === null) {
        // criação revertida: o registro sai
        registro = estado[ev.colecao].find((r) => r.id === ev.registroId);
        antes = clone(registro);
        depois = null;
        estado[ev.colecao] = estado[ev.colecao].filter((r) => r.id !== ev.registroId);
    } else if (ev.depois === null) {
        // exclusão revertida: o registro volta, com o mesmo id
        registro = clone(ev.antes);
        estado[ev.colecao].push(registro);
        antes = null;
        depois = clone(registro);
    } else {
        // edição revertida: os campos voltam ao que eram
        registro = estado[ev.colecao].find((r) => r.id === ev.registroId);
        antes = {};
        depois = {};
        ev.campos.forEach((k) => {
            antes[k] = clone(registro[k]);
            if (ev.antes[k] === undefined) delete registro[k];
            else registro[k] = clone(ev.antes[k]);
            depois[k] = clone(registro[k]);
        });
    }
    const novo = registrarAuditoria({ colecao: ev.colecao, registro, acao: "reverteu", acaoOriginal: ev.acao, antes, depois, campos: ev.campos, reverte: ev.id, justificativa: texto });
    ev.revertidoPor = { eventoId: novo.id, em: novo.dataHora, por: novo.ator, justificativa: texto };
    gravar();
    return { ok: true };
}


export function addItem(colecao, item) {
    // O PPA é o vínculo de tudo que se cadastra dentro dele.
    const novo = {
        ppaId: ppaCorrente(estado)?.id ?? "",
        ...item,
        id: item.id || `${colecao}-${uid()}`,
        criadoEm: hoje(),
    };
    estado[colecao].push(novo);
    registrarAuditoria({ colecao, registro: novo, acao: "criou", antes: null, depois: clone(novo), campos: Object.keys(novo) });
    gravar();
    return novo;
}

export function updItem(colecao, id, patch, justificativa = "") {
    const item = estado[colecao].find((x) => x.id === id);
    if (!item) return;
    editarComAuditoria(colecao, item, patch, justificativa);
    gravar();
}

/** Exclui um registro. Exige justificativa e que nada aponte para ele; devolve `{ ok }` ou `{ ok: false, motivo }`. */
export function removeItem(colecao, id, justificativa) {
    const item = estado[colecao].find((x) => x.id === id);
    if (!item) return { ok: false, motivo: "Registro não encontrado." };
    const aval = podeExcluir(colecao, item, justificativa);
    if (!aval.ok) return aval;
    estado[colecao] = estado[colecao].filter((x) => x.id !== id);
    registrarAuditoria({ colecao, registro: item, acao: "excluiu", antes: clone(item), depois: null, campos: Object.keys(item), justificativa: aval.texto });
    gravar();
    return { ok: true };
}

/* ---------- PPA ---------- */

export function addPpa(ppa) {
    const novo = { ...ppa, id: ppa.id || `ppa-${uid()}` };
    estado.ppas.push(novo);
    registrarAuditoria({ colecao: "ppas", registro: novo, acao: "criou", antes: null, depois: clone(novo), campos: Object.keys(novo) });
    gravar();
}

export function updPpa(id, patch, justificativa = "") {
    const ppa = estado.ppas.find((p) => p.id === id);
    if (!ppa) return;
    editarComAuditoria("ppas", ppa, patch, justificativa);
    gravar();
}

export function removePpa(id, justificativa) {
    const ppa = estado.ppas.find((p) => p.id === id);
    if (!ppa) return { ok: false, motivo: "Plano não encontrado." };
    const aval = podeExcluir("ppas", ppa, justificativa);
    if (!aval.ok) return aval;
    estado.ppas = estado.ppas.filter((p) => p.id !== id);
    registrarAuditoria({ colecao: "ppas", registro: ppa, acao: "excluiu", antes: clone(ppa), depois: null, campos: Object.keys(ppa), justificativa: aval.texto });
    gravar();
    return { ok: true };
}

/** Modelo de um plano novo, já com o período seguinte ao último cadastrado. */
export function ppaVazio() {
    const ultimo = [...estado.ppas].sort((a, b) => Number(b.ultimoAno) - Number(a.ultimoAno))[0];
    const inicio = ultimo ? Number(ultimo.ultimoAno) + 1 : 2028;
    return {
        id: `ppa-${uid()}`,
        nome: `Plano Plurianual ${inicio}–${inicio + 3}`,
        primeiroAno: String(inicio),
        ultimoAno: String(inicio + 3),
        descricao: "",
        situacao: "elaboracao",
        // Em branco até o plano ser cadastrado no SEI e o número voltar de lá.
        processoSei: "",
    };
}

/* ---------- utilidades internas ---------- */

function registrarEvento(iniciativaId, autor, texto) {
    estado.eventos.push({ id: `ev-${uid()}`, iniciativaId, quando: hoje(), autor, texto });
}

function tocar(iniciativaId) {
    const ini = estado.iniciativas.find((i) => i.id === iniciativaId);
    if (ini) ini.atualizadoEm = hoje();
}

/* ---------- Iniciativa ---------- */

export function addIniciativa({ programaId, nome, descricao, publicoAlvo = "", causas = [], problemaId = "", status = "em_preenchimento", motivo = "" }) {
    const id = `ini-${uid()}`;
    estado.iniciativas.push({
        id,
        programaId,
        orgao: estado.orgaoAtual,
        nome,
        descricao,
        publicoAlvo,
        causas,
        problemaId,
        motivo,
        status,
        atualizadoEm: hoje(),
        versao: 1,
    });
    registrarEvento(id, estado.orgaoAtual, "Iniciativa criada");
    gravar();
    return id;
}

export function updIniciativa(id, patch) {
    const ini = estado.iniciativas.find((i) => i.id === id);
    if (!ini) return;
    Object.assign(ini, patch);
    tocar(id);
    gravar();
}

export function removeIniciativa(id, justificativa) {
    const ini = estado.iniciativas.find((i) => i.id === id);
    if (!ini) return { ok: false, motivo: "Iniciativa não encontrada." };
    const aval = podeExcluir("iniciativas", ini, justificativa);
    if (!aval.ok) return aval;
    estado.iniciativas = estado.iniciativas.filter((i) => i.id !== id);
    registrarAuditoria({ colecao: "iniciativas", registro: ini, acao: "excluiu", antes: clone(ini), depois: null, campos: Object.keys(ini), justificativa: aval.texto });
    gravar();
    return { ok: true };
}

/* ---------- Fluxo da Iniciativa ---------- */

export function enviar(id) {
    const ini = estado.iniciativas.find((i) => i.id === id);
    if (!ini) return;
    const versao = ini.versao + (ini.status === "devolvida" ? 1 : 0);
    Object.assign(ini, { status: "enviada", enviadoEm: hoje(), atualizadoEm: hoje(), versao });
    registrarEvento(id, estado.orgaoAtual, `Iniciativa enviada para análise (versão ${versao})`);
    gravar();
}

/**
 * O órgão discorda do que recebeu — o Programa, o problema, uma causa — e diz
 * isso em vez de enviar. É status do setorial, ao lado de "em preenchimento" e
 * "enviada" (matriz de mapeamento), e vem com um motivo.
 */
export function reportarDivergencia(id) {
    const ini = estado.iniciativas.find((i) => i.id === id);
    if (!ini) return;
    Object.assign(ini, { status: "divergencia", atualizadoEm: hoje() });
    registrarEvento(id, estado.orgaoAtual, "Divergência reportada pelo órgão");
    gravar();
}

/** A divergência foi resolvida e a Iniciativa volta a ser preenchida. */
export function retomarPreenchimento(id) {
    const ini = estado.iniciativas.find((i) => i.id === id);
    if (!ini) return;
    Object.assign(ini, { status: "em_preenchimento", atualizadoEm: hoje() });
    registrarEvento(id, estado.orgaoAtual, "Divergência encerrada: a Iniciativa volta ao preenchimento");
    gravar();
}

export function iniciarAnalise(id) {
    const ini = estado.iniciativas.find((i) => i.id === id);
    if (!ini) return;
    Object.assign(ini, { status: "em_analise", analista: estado.analista, atualizadoEm: hoje() });
    registrarEvento(id, estado.analista, "Análise iniciada pela Área Central");
    gravar();
}

export function devolver(id) {
    const ini = estado.iniciativas.find((i) => i.id === id);
    if (!ini) return;
    const entregas = estado.entregas.filter((e) => e.iniciativaId === id).map((e) => e.id);
    const abertos = estado.comentarios.filter(
        (c) =>
            !c.resolvido &&
            ((c.alvoTipo === "iniciativa" && c.alvoId === id) ||
                (c.alvoTipo === "entrega" && entregas.includes(c.alvoId)))
    ).length;
    Object.assign(ini, { status: "devolvida", analista: estado.analista, atualizadoEm: hoje() });
    registrarEvento(id, estado.analista, `Iniciativa devolvida para ajuste com ${abertos} apontamento(s)`);
    gravar();
}

export function validar(id) {
    const ini = estado.iniciativas.find((i) => i.id === id);
    if (!ini) return;
    Object.assign(ini, { status: "validada", analista: estado.analista, atualizadoEm: hoje() });
    registrarEvento(id, estado.analista, "Iniciativa validada");
    gravar();
}

/* ---------- Entrega ---------- */

export function addEntrega(iniciativaId, nome) {
    const id = `ent-${uid()}`;
    estado.entregas.push({
        id,
        iniciativaId,
        nome,
        descricao: "",
        unidadeMedida: "",
        metodoComprovacao: "",
        comportamentoValidado: false,
        metas: { 2028: null, 2029: null, 2030: null, 2031: null },
        territorio: { tipo: null, regioes: [] },
        gomap: null,
    });
    tocar(iniciativaId);
    gravar();
    return id;
}

export function updEntrega(id, patch) {
    const entrega = estado.entregas.find((e) => e.id === id);
    if (!entrega) return;
    Object.assign(entrega, patch);
    tocar(entrega.iniciativaId);
    gravar();
}

export function removeEntrega(id, justificativa) {
    const entrega = estado.entregas.find((e) => e.id === id);
    if (!entrega) return { ok: false, motivo: "Entrega não encontrada." };
    const aval = podeExcluir("entregas", entrega, justificativa);
    if (!aval.ok) return aval;
    estado.entregas = estado.entregas.filter((e) => e.id !== id);
    registrarAuditoria({ colecao: "entregas", registro: entrega, acao: "excluiu", antes: clone(entrega), depois: null, campos: Object.keys(entrega), justificativa: aval.texto });
    gravar();
    return { ok: true };
}

/* ---------- Vínculos ---------- */

export function toggleProjeto(entregaId, projetoId) {
    const existe = estado.vinculos.find((v) => v.entregaId === entregaId && v.projetoId === projetoId);
    if (existe) estado.vinculos = estado.vinculos.filter((v) => v.id !== existe.id);
    else estado.vinculos.push({ id: `v-${uid()}`, entregaId, projetoId });
    gravar();
}

/**
 * Vincula ou desvincula uma Ação Orçamentária.
 * Uma Ação financia no máximo uma Entrega: se já financia outra, a vinculação é
 * recusada e a função devolve o id da Entrega que a consome.
 */
export function toggleAcao(entregaId, acaoId) {
    const existe = estado.vinculosAcao.find((v) => v.entregaId === entregaId && v.acaoId === acaoId);
    if (existe) {
        estado.vinculosAcao = estado.vinculosAcao.filter((v) => v.id !== existe.id);
        gravar();
        return { ok: true };
    }
    const ocupada = estado.vinculosAcao.find((v) => v.acaoId === acaoId);
    if (ocupada) return { ok: false, entregaId: ocupada.entregaId };
    estado.vinculosAcao.push({ id: `va-${uid()}`, entregaId, acaoId });
    gravar();
    return { ok: true };
}

/* ---------- Programa ---------- */

export function addPrograma(programa) {
    estado.programas.push(programa);
    registrarAuditoria({ colecao: "programas", registro: programa, acao: "criou", antes: null, depois: clone(programa), campos: Object.keys(programa) });
    gravar();
}

export function updPrograma(id, patch) {
    const programa = estado.programas.find((p) => p.id === id);
    if (!programa) return;
    editarComAuditoria("programas", programa, patch);
    gravar();
}

/* ---------- Participação do órgão ---------- */

export function marcarSemContribuicao(programaId, orgao) {
    const jaTem = estado.semContribuicao.some((x) => x.programaId === programaId && x.orgao === orgao);
    if (!jaTem) estado.semContribuicao.push({ programaId, orgao });
    gravar();
}

export function reconsiderarParticipacao(programaId, orgao) {
    estado.semContribuicao = estado.semContribuicao.filter(
        (x) => !(x.programaId === programaId && x.orgao === orgao)
    );
    gravar();
}

/* ---------- Apontamentos ---------- */

export function addComentario({ alvoTipo, alvoId, campo, texto, autor }) {
    estado.comentarios.push({
        id: `cm-${uid()}`,
        alvoTipo,
        alvoId,
        campo,
        texto,
        autor,
        criadoEm: hoje(),
        resolvido: false,
    });
    gravar();
}

export function resolverComentario(id) {
    const comentario = estado.comentarios.find((c) => c.id === id);
    if (!comentario) return;
    comentario.resolvido = true;
    gravar();
}
