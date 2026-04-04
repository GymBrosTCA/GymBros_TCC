/**
 * data.js — Store central em memória do GymBros
 */
'use strict';

let _seq = 1;
const nextId = (prefix = '') => `${prefix}${String(_seq++).padStart(4, '0')}`;

function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function hoursAgo(n) { return new Date(Date.now() - n * 3_600_000); }
function monthsAgo(n) { const d = new Date(); d.setMonth(d.getMonth() - n); return d; }
function randomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const usuarios     = [];
const academias    = [];
const planos       = [];
const checkins     = [];
const transacoes   = [];
const tickets      = [];
const mensagens    = [];
const notificacoes = [];

// ── Online users tracking (userId → { nome, email, page, lastSeen }) ─────────
const onlineUsers = new Map();

const adminConfig = {
    siteName: 'GymBros',
    maintenance: false,
    version: '1.0.0',
    notifThresholdHours: 24,
};

// ── SEED Academias ────────────────────────────────────────────────────────────
function seedAcademias() {
    const data = [
        { nome: 'Smart Fit Centro',        cnpj: '12.345.678/0001-01', endereco: 'Rua das Flores, 123',    cidade: 'São Paulo',      cep: '01310100', responsavel: 'Carlos Silva',   telefone: '(11) 3456-7890' },
        { nome: 'Bodytech Paulista',        cnpj: '23.456.789/0001-02', endereco: 'Av. Paulista, 1578',     cidade: 'São Paulo',      cep: '01310200', responsavel: 'Ana Lima',       telefone: '(11) 3456-7891' },
        { nome: 'BlueFit Copacabana',       cnpj: '34.567.890/0001-03', endereco: 'Rua Figueiredo, 88',     cidade: 'Rio de Janeiro', cep: '22020050', responsavel: 'Pedro Costa',    telefone: '(21) 3456-7892' },
        { nome: 'Altinha CrossFit',         cnpj: '45.678.901/0001-04', endereco: 'Av. Brasil, 500',        cidade: 'Belo Horizonte', cep: '30140000', responsavel: 'Mariana Souza',  telefone: '(31) 3456-7893' },
        { nome: 'Espaço Fit Moema',         cnpj: '56.789.012/0001-05', endereco: 'Rua Iraí, 211',          cidade: 'São Paulo',      cep: '04082000', responsavel: 'Lucas Rocha',    telefone: '(11) 3456-7894' },
        { nome: 'Academia Prime Curitiba',  cnpj: '67.890.123/0001-06', endereco: 'Av. República, 900',     cidade: 'Curitiba',       cep: '80230000', responsavel: 'Fernanda Nunes', telefone: '(41) 3456-7895' },
    ];
    data.forEach((a, i) => {
        academias.push({ ...a, id: `ac${String(i+1).padStart(3,'0')}`, status: 'ativa', totalAlunos: randomBetween(120, 580), createdAt: daysAgo(randomBetween(60, 300)) });
    });
}

// ── SEED Planos ───────────────────────────────────────────────────────────────
function seedPlanos() {
    planos.push(
        { id: 'pl001', nome: 'Starter', descricao: 'Para quem está começando na vida fitness.',  preco: 64.90,  duracao: 'mensal', beneficios: ['2300+ academias e estúdios', 'Treinos online e presenciais', 'App GymBros', 'Suporte 24h'],                                                               status: 'ativo', createdAt: daysAgo(365) },
        { id: 'pl002', nome: 'GymBro',  descricao: 'O plano mais popular do GymBros.',           preco: 85.60,  duracao: 'mensal', beneficios: ['3560+ academias e estúdios', 'Treinos online ao vivo', 'Leve 4 amigos por mês', 'Personal trainer online', 'Acesso a estúdios premium'],                status: 'ativo', createdAt: daysAgo(365) },
        { id: 'pl003', nome: 'Black',   descricao: 'Acesso total, sem limites.',                  preco: 145.90, duracao: 'mensal', beneficios: ['5000+ academias e estúdios', 'Treinos online ao vivo', 'Leve amigos ilimitado', 'Personal trainer exclusivo', 'Área VIP', 'Benefícios premium'], status: 'ativo', createdAt: daysAgo(365) }
    );
}

// ── SEED Usuários ─────────────────────────────────────────────────────────────
function seedUsuarios() {
    const nomes = [
        ['João Pedro','Alves'],       ['Maria Fernanda','Costa'],   ['Lucas','Oliveira'],
        ['Ana Clara','Silva'],        ['Rafael','Santos'],           ['Juliana','Lima'],
        ['Gabriel','Ferreira'],       ['Camila','Rodrigues'],        ['Mateus','Pereira'],
        ['Beatriz','Gonçalves'],      ['Thiago','Martins'],          ['Larissa','Araújo'],
        ['Felipe','Nascimento'],      ['Isabela','Carvalho'],        ['Bruno','Melo'],
        ['Amanda','Ribeiro'],         ['Vinícius','Lopes'],          ['Natalia','Barbosa'],
        ['Diego','Moreira'],          ['Carolina','Mendes'],         ['Pedro','Teixeira'],
        ['Fernanda','Nunes'],         ['Rodrigo','Castro'],          ['Priscila','Gomes'],
        ['André','Freitas'],          ['Tatiane','Pinto'],           ['Marcelo','Dias'],
        ['Bianca','Cunha'],           ['Gustavo','Ramos'],           ['Vanessa','Monteiro'],
        ['Leonardo','Cardoso'],       ['Patrícia','Souza'],          ['Henrique','Almeida'],
        ['Renata','Farias'],          ['Caio','Braga'],              ['Monique','Correia'],
        ['Fábio','Queiroz'],          ['Letícia','Pires'],           ['Danilo','Medeiros'],
        ['Aline','Cavalcante'],       ['Sérgio','Rezende'],          ['Cristina','Nogueira'],
        ['Eduardo','Bastos'],         ['Sabrina','Matos'],           ['Alexandre','Vieira'],
        ['Nathalia','Teixeira'],      ['Ricardo','Andrade'],         ['Giovanna','Macedo'],
        ['Marcos','Duarte'],          ['Érika','Campos'],            ['Wellington','Rocha'],
        ['Luana','Figueiredo'],       ['Leandro','Carmo'],           ['Simone','Borges'],
        ['Otávio','Cunha'],           ['Débora','Monteiro'],         ['Cláudio','Silveira'],
        ['Bruna','Paiva'],            ['Fábio','Guimarães'],         ['Rebeca','Moura'],
        ['Nathan','Dias'],            ['Larissa','Coutinho'],        ['Vitor','Bezerra'],
        ['Mariana','Tavares'],        ['Arthur','Leal'],             ['Isabelle','Menezes'],
        ['Thales','Barros'],          ['Camile','Pinheiro'],         ['Adriano','Saraiva'],
        ['Érica','Neves'],            ['Murilo','Lacerda'],          ['Tamiris','Drummond'],
        ['Celso','Fonseca'],          ['Jéssica','Xavier'],          ['Patrick','Lemos'],
        ['Raquel','Azevedo'],         ['Caique','Siqueira'],         ['Ingrid','Brito'],
        ['Diogo','Vasconcelos'],      ['Thaís','Coelho'],            ['Evandro','Pedroso'],
    ];
    const planosIds   = ['pl001', 'pl002', 'pl003'];
    const planosNomes = ['Starter', 'GymBro', 'Black'];
    const precos      = [64.90, 85.60, 145.90];
    // Distribuição: 25% Starter, 45% GymBro, 30% Black (mais receita)
    const planoDistrib = (i) => i % 20 < 5 ? 0 : i % 20 < 14 ? 1 : 2;
    const acadIds     = academias.map(a => a.id);

    nomes.forEach(([nome, sobrenome], i) => {
        const planoIdx = planoDistrib(i);
        const diasCadastrado = randomBetween(30, 365);
        const user = {
            id: `u${String(i+1).padStart(3,'0')}`,
            nome: `${nome} ${sobrenome}`,
            cpf: String(10000000000 + i * 111111111).slice(0, 11),
            email: `${nome.toLowerCase().replace(' ','.')}.${sobrenome.toLowerCase()}@email.com`,
            cep: '01310100',
            password: 'senha123',
            plano: planosNomes[planoIdx],
            planoId: planosIds[planoIdx],
            academiaId: acadIds[i % acadIds.length],
            status: i < 75 ? 'ativo' : 'inativo',
            createdAt: daysAgo(diasCadastrado),
            imc: i < 40 ? {
                peso: randomBetween(55, 100),
                altura: (1.58 + Math.random() * 0.32).toFixed(2),
                objetivo: ['Perder peso','Ganhar massa','Manter forma','Saúde geral'][i % 4],
                lesoes: i % 5 === 0 ? ['Joelho'] : [],
            } : null,
        };
        usuarios.push(user);

        // Até 12 meses de transações recorrentes
        const mesesAtras = Math.min(12, Math.ceil(diasCadastrado / 30));
        for (let m = 0; m < mesesAtras; m++) {
            const statusTr = (i < 72 && m === 0) ? 'pago'
                           : (i >= 72 && m === 0) ? 'pendente'
                           : 'pago';
            const dataTransacao = monthsAgo(m);
            dataTransacao.setDate(randomBetween(1, 28));
            transacoes.push({
                id: nextId('tr'),
                userId: user.id,
                userName: user.nome,
                userEmail: user.email,
                planoId: user.planoId,
                planoNome: user.plano,
                valor: precos[planoIdx],
                data: dataTransacao,
                status: statusTr,
                diasAtraso: statusTr === 'pendente' ? randomBetween(1, 20) : 0,
            });
        }
    });
}

// ── SEED Check-ins ────────────────────────────────────────────────────────────
function seedCheckins() {
    const acadIds  = academias.map(a => a.id);
    const acadNomes = academias.map(a => a.nome);
    for (let i = 0; i < 120; i++) {
        const userIdx = randomBetween(0, usuarios.length - 1);
        const acadIdx = randomBetween(0, acadIds.length - 1);
        const diasAtras = randomBetween(0, 60);
        const hora = `${String(randomBetween(6, 21)).padStart(2,'0')}:${['00','15','30','45'][randomBetween(0,3)]}`;
        const data = daysAgo(diasAtras);
        checkins.push({
            id: nextId('ci'),
            userId: usuarios[userIdx].id,
            userName: usuarios[userIdx].nome,
            academiaId: acadIds[acadIdx],
            academiaNome: acadNomes[acadIdx],
            data,
            dataStr: data.toLocaleDateString('pt-BR'),
            hora,
            diaSemana: data.getDay(),
        });
    }
    checkins.sort((a, b) => b.data - a.data);
}

// ── SEED Tickets ──────────────────────────────────────────────────────────────
function seedTickets() {
    const assuntos = [
        { assunto: 'Problema ao fazer check-in',             tipo: 'Problema no app' },
        { assunto: 'Dúvida sobre cobrança do plano',         tipo: 'Dúvida sobre plano' },
        { assunto: 'Academia parceira fechada',               tipo: 'Problema na academia' },
        { assunto: 'Erro no Personal Trainer IA',            tipo: 'Problema no app' },
        { assunto: 'Como cancelar meu plano?',               tipo: 'Dúvida sobre plano' },
        { assunto: 'App travando na avaliação corporal',     tipo: 'Problema no app' },
        { assunto: 'Solicitar troca de academia base',       tipo: 'Outro' },
        { assunto: 'Não consigo alterar minha senha',        tipo: 'Problema no app' },
        { assunto: 'Cobrança duplicada no cartão',           tipo: 'Dúvida sobre plano' },
        { assunto: 'Academia sem equipamentos funcionando',  tipo: 'Problema na academia' },
    ];
    const statusOpts = ['aberto','aberto','em_atendimento','em_atendimento','resolvido','aberto','em_atendimento','resolvido','aberto','em_atendimento'];

    assuntos.forEach((item, i) => {
        const user = usuarios[i];
        const status = statusOpts[i];
        const criadoHa = randomBetween(1, 120);
        const tid = nextId('tk');
        tickets.push({
            id: tid,
            userId: user.id,
            userName: user.nome,
            userEmail: user.email,
            userPlano: user.plano,
            assunto: item.assunto,
            tipo: item.tipo,
            status,
            prioridade: i < 3 ? 'alta' : 'normal',
            createdAt: hoursAgo(criadoHa),
            updatedAt: hoursAgo(randomBetween(0, Math.min(criadoHa, 24))),
        });
        mensagens.push({ id: nextId('ms'), ticketId: tid, remetente: 'usuario', texto: `Olá! ${item.assunto}. Podem me ajudar?`, criadaEm: hoursAgo(criadoHa) });
        if (status === 'em_atendimento' || status === 'resolvido') {
            mensagens.push({ id: nextId('ms'), ticketId: tid, remetente: 'admin', texto: 'Olá! Recebemos seu chamado e já estamos verificando o problema.', criadaEm: hoursAgo(criadoHa - 1) });
        }
        if (status === 'resolvido') {
            mensagens.push({ id: nextId('ms'), ticketId: tid, remetente: 'admin', texto: 'Problema resolvido! Por favor, avalie nosso atendimento.', criadaEm: hoursAgo(randomBetween(0, 12)) });
        }
    });
}

// ── SEED Notificações ─────────────────────────────────────────────────────────
function seedNotificacoes() {
    notificacoes.push(
        { id: nextId('no'), titulo: 'Bem-vindo ao GymBros!',      mensagem: 'Sua conta foi criada com sucesso. Explore todas as funcionalidades.', tipo: 'informativo', destinatarios: 'todos', criadaEm: daysAgo(30), lidas: [] },
        { id: nextId('no'), titulo: 'Promoção de Aniversário 🎉',  mensagem: 'Upgrade para o plano Black com 30% de desconto neste mês!',            tipo: 'promocao',    destinatarios: 'pl001', criadaEm: daysAgo(5),  lidas: [] },
        { id: nextId('no'), titulo: 'Manutenção programada',       mensagem: 'O sistema ficará em manutenção no dia 20/12 entre 02h e 04h.',          tipo: 'alerta',      destinatarios: 'todos', criadaEm: daysAgo(2),  lidas: [] }
    );
}

seedAcademias();
seedPlanos();
seedUsuarios();
seedCheckins();
seedTickets();
seedNotificacoes();

console.log(`[data] Seed: ${usuarios.length} usuários | ${academias.length} academias | ${transacoes.length} transações | ${checkins.length} checkins | ${tickets.length} tickets`);

module.exports = { usuarios, academias, planos, checkins, transacoes, tickets, mensagens, notificacoes, adminConfig, onlineUsers, nextId };
