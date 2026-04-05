// router.js
const express    = require('express');
const router     = express.Router();
const path       = require('path');
const fs         = require('fs');
const multer     = require('multer');
const QRCode     = require('qrcode');
const { body, validationResult } = require('express-validator');
const { enviarBoleto }   = require('../services/email');
const { gerarBoletoPDF } = require('../services/pdf');

// ── Multer: upload de foto de perfil ──────────────────────────────────────────
const photoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads/profile_photos');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uid = (req.session.user?.cpf || 'unknown').replace(/\D/g, '');
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `avatar_${uid}${ext}`);
    },
});
const photoUpload = multer({
    storage: photoStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!['image/jpeg','image/png','image/webp'].includes(file.mimetype)) {
            return cb(new Error('Formato inválido. Use JPEG, PNG ou WebP.'));
        }
        cb(null, true);
    },
});

// Store central compartilhado com admin
const { usuarios, onlineUsers, transacoes, planos: planosData, nextId } = require('../data');
const { broadcast } = require('../events');

// ── Dados dos planos disponíveis ──────────────────────────────────────────
const PLANOS_PAGAMENTO = {
    starter: { id: 'pl001', nome: 'Starter', preco: 64.90, precoFmt: 'R$ 64,90', beneficios: ['2300+ academias e estúdios', 'Treinos online e presenciais', 'App GymBros', 'Suporte 24h'] },
    gymbro:  { id: 'pl002', nome: 'GymBro',  preco: 85.60, precoFmt: 'R$ 85,60', beneficios: ['3560+ academias e estúdios', 'Treinos online ao vivo', 'Leve 4 amigos por mês', 'Personal trainer online'] },
    black:   { id: 'pl003', nome: 'Black',   preco: 145.90, precoFmt: 'R$ 145,90', beneficios: ['5000+ academias e estúdios', 'Treinos online ao vivo', 'Leve amigos ilimitado', 'Personal trainer exclusivo', 'Área VIP e benefícios premium'] },
};

// ── Middleware: rastreia usuários online ──────────────────────────────────────
router.use((req, res, next) => {
    if (req.session && req.session.user) {
        const user = req.session.user;
        const uid  = user.id || user.cpf;
        const isNew = !onlineUsers.has(uid);
        onlineUsers.set(uid, { nome: user.nome, email: user.email, page: req.path, lastSeen: Date.now() });
        // Atualiza lastSeen no objeto do usuário para aparecer primeiro no admin
        const userObj = usuarios.find(u => u.id === uid || u.cpf === uid);
        if (userObj) userObj.lastSeen = Date.now();
        if (isNew) {
            broadcast('user_online', { id: uid, nome: user.nome, email: user.email, page: req.path, lastSeen: Date.now() });
        } else {
            broadcast('user_activity', { id: uid, nome: user.nome, page: req.path, lastSeen: Date.now() });
        }
    }
    next();
});

// ── Middlewares de autenticação ───────────────────────────────────────────────

/**
 * Só exige login. Qualquer usuário autenticado passa.
 */
function requireAuth(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

/**
 * Exige login + plano ativo.
 * Pending (PIX/boleto aguardando confirmação) → redireciona com aviso.
 * Sem plano → redireciona para /planos com banner.
 */
function requirePlano(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    const user = req.session.user;

    if (!user.plano) {
        return res.redirect('/planos?semPlano=1');
    }
    next();
}

// Função simples pra validar CPF (só pra demo)
function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf[10])) return false;
  return true;
}

// ====================
// ROTAS GET
// ====================

// Páginas públicas
router.get('/', (req, res) => res.render('pages/index', { seo: {
    title:         'GymBros — Academias Ilimitadas em Todo o Brasil',
    description:   'Acesse 3.560+ academias parceiras, treinos online ao vivo e personal trainer IA com o GymBros. Planos a partir de R$ 64,90/mês.',
    keywords:      'academia, treinos, fitness, personal trainer ia, gymbros, academias parceiras, treinos online',
    canonical:     '/',
    ogTitle:       'Treine em Qualquer Academia do Brasil — GymBros',
    ogDescription: '3.560+ academias, treinos online e IA personal trainer. Comece agora.',
}}));

router.get('/login', (req, res) => res.render('pages/login', { seo: {
    title:         'Login — GymBros',
    description:   'Acesse sua conta GymBros para ver seus treinos, acompanhar sua evolução e usar o personal trainer IA GymBot.',
    keywords:      'login gymbros, entrar gymbros, acesso aluno',
    canonical:     '/login',
    robots:        'noindex, follow',
    ogTitle:       'Entrar no GymBros',
    ogDescription: 'Acesse sua conta e continue seu treino.',
}}));

router.get('/register', (req, res) => {
    res.render('pages/register', { user: req.session.user || null, seo: {
        title:         'Cadastro — GymBros',
        description:   'Crie sua conta GymBros gratuitamente e acesse academias parceiras, treinos online e o personal trainer IA GymBot.',
        keywords:      'cadastro gymbros, criar conta, registrar gymbros',
        canonical:     '/register',
        ogTitle:       'Crie sua Conta GymBros Grátis',
        ogDescription: 'Junte-se a milhares de alunos e treine sem limites.',
    }});
});

router.get('/planos', (req, res) => res.render('pages/planos', { seo: {
    title:         'Planos GymBros: Starter, GymBro e Black',
    description:   'Compare os planos GymBros: Starter (R$64,90), GymBro (R$85,60) e Black (R$145,90). Academias ilimitadas, treinos online e personal trainer IA.',
    keywords:      'planos gymbros, preço academia, assinatura academia, plano fitness',
    canonical:     '/planos',
    ogTitle:       'Escolha seu Plano GymBros — A partir de R$64,90',
    ogDescription: 'Starter, GymBro ou Black. Academias ilimitadas + IA personal trainer.',
}}));

router.get('/academias', (req, res) => res.render('pages/academias', { seo: {
    title:         'Academias Parceiras GymBros — Encontre a Sua',
    description:   'Encontre academias e estúdios parceiros do GymBros perto de você no mapa interativo. Mais de 3.560 locais em todo o Brasil.',
    keywords:      'academias parceiras, academia perto de mim, gymbros academias, mapa academia',
    canonical:     '/academias',
    ogTitle:       'Academias GymBros Perto de Você — Mapa Interativo',
    ogDescription: 'Localize 3.560+ academias parceiras no mapa. Treine onde quiser.',
}}));

router.get('/compra', (req, res) => res.render('pages/compra', { seo: {
    title:         'Assinar GymBros — Dados de Pagamento',
    description:   'Finalize sua assinatura GymBros com segurança. Acesse academias parceiras e treinos online em minutos.',
    keywords:      'assinar gymbros, pagamento academia, contratar gymbros',
    canonical:     '/compra',
    robots:        'noindex, nofollow',
    ogTitle:       'Assinar GymBros',
    ogDescription: 'Finalize sua assinatura e comece a treinar agora.',
}}));

router.get('/compra2', (req, res) => res.render('pages/compra2', { seo: {
    title:         'Assinar GymBros — Confirmação de Plano',
    description:   'Revise e confirme os dados do seu plano GymBros antes de finalizar a assinatura.',
    keywords:      'confirmar plano gymbros, assinatura',
    canonical:     '/compra2',
    robots:        'noindex, nofollow',
    ogTitle:       'Confirmação de Plano — GymBros',
    ogDescription: 'Revise seu plano antes de finalizar.',
}}));

router.get('/compra3', (req, res) => res.render('pages/compra3', { seo: {
    title:         'Assinatura GymBros Confirmada!',
    description:   'Sua assinatura GymBros foi confirmada! Acesse agora academias parceiras, treinos online e o GymBot personal trainer IA.',
    keywords:      'assinatura confirmada gymbros, bem vindo gymbros',
    canonical:     '/compra3',
    robots:        'noindex, nofollow',
    ogTitle:       'Bem-vindo ao GymBros!',
    ogDescription: 'Assinatura confirmada. Comece a treinar agora mesmo!',
}}));


// Pagamento
router.get('/pagamento', (req, res) => {
    if (!req.session.user) {
        const plano = req.query.plano ? `?plano=${encodeURIComponent(req.query.plano)}` : '';
        return res.redirect(`/login?redirect=/pagamento${encodeURIComponent(plano)}`);
    }
    const slug = (req.query.plano || 'gymbro').toLowerCase();
    const plano = PLANOS_PAGAMENTO[slug] || PLANOS_PAGAMENTO.gymbro;
    res.render('pages/pagamento', {
        user: req.session.user,
        plano,
        hideThemeToggle: true,
        seo: {
            title:       'Pagamento — GymBros',
            canonical:   '/pagamento',
            robots:      'noindex, nofollow',
            description: 'Finalize sua assinatura GymBros com segurança.',
        }
    });
});

router.post('/api/pagamento', (req, res) => {
    if (!req.session.user) return res.status(401).json({ erro: 'Não autorizado.' });

    const { planoId, planoNome, valor, metodo, parcelas } = req.body;
    const user = req.session.user;

    // Cartão = ativo imediatamente; PIX e boleto = pendente até confirmação
    const status = metodo === 'cartao' ? 'pago' : 'pendente';

    const transacao = {
        id:         nextId('tr'),
        userId:     user.id || user.cpf,
        userName:   user.nome,
        userEmail:  user.email,
        planoId:    planoId,
        planoNome:  planoNome,
        valor:      Number(valor),
        metodo,
        parcelas:   Number(parcelas) || 1,
        data:       new Date(),
        status,
        diasAtraso: 0,
    };

    transacoes.push(transacao);

    const stored = usuarios.find(u => u.id === user.id || u.cpf === user.cpf);
    if (stored) {
        stored.plano   = planoNome;
        stored.planoId = planoId;
        stored.status  = 'ativo';
    }
    req.session.user = { ...user, plano: planoNome, planoId, status: 'ativo' };

    // Notifica admin via SSE
    const { notificacoes } = require('../data');
    const notif = {
        id:           nextId('no'),
        titulo:       `Nova compra — ${planoNome}`,
        mensagem:     `${user.nome} assinou o plano ${planoNome} via ${metodo} — R$ ${Number(valor).toFixed(2).replace('.', ',')}`,
        tipo:         'compra',
        destinatarios:'admin',
        criadaEm:    new Date(),
        lidas:        [],
    };
    notificacoes.push(notif);
    broadcast('nova_compra', {
        transacaoId: transacao.id,
        userName:    user.nome,
        userEmail:   user.email,
        planoNome,
        valor:       Number(valor),
        metodo,
        status,
        data:        transacao.data,
    });

    return res.json({ ok: true, status, transacaoId: transacao.id });
});

// ── GET /api/pix/qr — gera QR Code PIX ───────────────────────────────────────
router.get('/api/pix/qr', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ erro: 'Não autorizado.' });

    const { planoId, valor } = req.query;
    const valorNum = Number(valor) || 0;
    const valorStr = valorNum.toFixed(2);

    // EMV PIX payload simplificado (demo)
    function pixField(id, value) {
        const len = String(value.length).padStart(2, '0');
        return `${id}${len}${value}`;
    }
    const merchantInfo = pixField('00', 'br.gov.bcb.pix') +
                         pixField('01', 'gymbros@pix.com.br');
    const payload =
        pixField('00', '01') +
        pixField('26', merchantInfo) +
        pixField('52', '0000') +
        pixField('53', '986') +
        pixField('54', valorStr) +
        pixField('58', 'BR') +
        pixField('59', 'GYMBROS TCC') +
        pixField('60', 'Sao Paulo') +
        pixField('62', pixField('05', planoId || 'pl002'));

    // CRC16 simplificado (apenas para demo — não é CRC real)
    const crc = '0000';
    const fullPayload = payload + pixField('63', crc);

    try {
        const dataUrl = await QRCode.toDataURL(fullPayload, { width: 220, margin: 1 });
        const expiraEm = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
        res.json({ ok: true, dataUrl, pixPayload: fullPayload, expiraEm });
    } catch (err) {
        console.error('[pix/qr]', err);
        res.status(500).json({ ok: false, erro: 'Erro ao gerar QR Code.' });
    }
});

// ── POST /api/boleto — gera boleto PDF e envia e-mail ─────────────────────────
router.post('/api/boleto', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ erro: 'Não autorizado.' });

    const { planoNome, valor } = req.body;
    const user = req.session.user;

    const linhaDigitavel = '23790.00009 01020.269702 03010.247409 8 94350000006490';
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + 3);
    const vencimentoStr = vencimento.toLocaleDateString('pt-BR');

    try {
        const pdfBuffer = await gerarBoletoPDF({
            nome:          user.nome,
            email:         user.email,
            planoNome,
            valor:         Number(valor),
            linhaDigitavel,
            vencimento:    vencimentoStr,
        });

        await enviarBoleto({
            to:            user.email,
            nome:          user.nome,
            planoNome,
            valor:         Number(valor),
            linhaDigitavel,
            pdfBuffer,
        });

        res.json({ ok: true, linhaDigitavel, vencimento: vencimentoStr, emailEnviado: true });
    } catch (err) {
        console.error('[boleto]', err);
        res.status(500).json({ ok: false, erro: 'Erro ao gerar boleto.' });
    }
});

router.get('/about', (req, res) => res.render('pages/about', { seo: {
    title:         'Sobre o GymBros — Nossa Missão e Equipe',
    description:   'Conheça a história do GymBros, nossa missão de democratizar o acesso à saúde e fitness no Brasil e o time apaixonado por esporte.',
    keywords:      'sobre gymbros, história gymbros, missão gymbros, equipe gymbros',
    canonical:     '/about',
    ogTitle:       'Sobre o GymBros — Saúde para Todos',
    ogDescription: 'Nossa missão: democratizar o acesso à saúde e ao fitness no Brasil.',
}}));

// Área do Aluno (protegida — requer plano ativo)
router.get('/area-aluno', requirePlano, (req, res) => {
    res.render('pages/area-aluno', { user: req.session.user, seo: {
        title: 'Painel do Aluno — GymBros', canonical: '/area-aluno',
        robots: 'noindex, nofollow', description: 'Painel do aluno GymBros.',
    }});
});

//Treinos
router.get('/treinos', requirePlano, (req, res) => {
    res.render('pages/treinos', {
        user: req.session.user,
        seo: { title: 'Meus Treinos — GymBros', canonical: '/treinos', robots: 'noindex, nofollow', description: 'Gerencie seus treinos no GymBros.' },
        sugestoes: [
            { id: 1, nome: 'Treino de Peito',      duracao: 50, tipo: 'Força',       icone: 'fa-dumbbell',   exercicios: ['Supino reto', 'Crucifixo', 'Peck deck', 'Flexão'] },
            { id: 2, nome: 'Treino de Pernas',      duracao: 60, tipo: 'Força',       icone: 'fa-dumbbell',   exercicios: ['Agachamento', 'Leg press', 'Cadeira extensora', 'Panturrilha'] },
            { id: 3, nome: 'Yoga Relaxamento',      duracao: 40, tipo: 'Alongamento', icone: 'fa-leaf',       exercicios: ['Saudação ao sol', 'Postura da criança', 'Torção espinhal'] },
            { id: 4, nome: 'Treino de Costas',      duracao: 55, tipo: 'Força',       icone: 'fa-dumbbell',   exercicios: ['Remada curvada', 'Puxada frontal', 'Remada unilateral'] },
            { id: 5, nome: 'Treino de Ombros',      duracao: 45, tipo: 'Força',       icone: 'fa-dumbbell',   exercicios: ['Desenvolvimento', 'Elevação lateral', 'Elevação frontal'] },
            { id: 6, nome: 'Cardio Intenso',        duracao: 35, tipo: 'Cardio',      icone: 'fa-running',    exercicios: ['Esteira 20min', 'Bicicleta 15min'] },
            { id: 7, nome: 'Pilates',               duracao: 50, tipo: 'Alongamento', icone: 'fa-leaf',       exercicios: ['Controle respiratório', 'Fortalecimento core'] },
            { id: 8, nome: 'Treino Abdominal',      duracao: 30, tipo: 'Força',       icone: 'fa-dumbbell',   exercicios: ['Crunch', 'Prancha', 'Abdominal oblíquo'] },
            { id: 9, nome: 'HIIT',                  duracao: 25, tipo: 'Cardio',      icone: 'fa-fire',       exercicios: ['Burpee', 'Mountain climber', 'Jumping jack', 'Sprint'] }
        ]
    });
});

//Evolução
router.get('/evolucao', requirePlano, (req, res) => {

    const evolucao = {
        treinosConcluidos: 7,
        treinosTotais: 9,
        consistencia: 78,
        labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
        data: [1, 1, 2, 1, 1, 1, 0],
        detalhes: [
            { nome: 'Treino de Peito', peso: 50, repeticoes: 12 },
            { nome: 'Treino de Pernas', peso: 60, repeticoes: 10 },
            { nome: 'Yoga leve', peso: 0, repeticoes: 0 },
            { nome: 'Treino de Costas', peso: 55, repeticoes: 12 },
            { nome: 'Treino de Ombros', peso: 45, repeticoes: 12 },
            { nome: 'Treino Cardio', peso: 0, repeticoes: 0 },
            { nome: 'Treino Abdominal', peso: 0, repeticoes: 20 }
        ]
    };

    res.render('pages/evolucao', {
        user: req.session.user,
        evolucao,
        seo: { title: 'Minha Evolução — GymBros', canonical: '/evolucao', robots: 'noindex, nofollow', description: 'Acompanhe sua evolução física no GymBros.' },
    });
});

// Meu Plano
router.get('/meu-plano', requirePlano, (req, res) => {
    const user = req.session.user;

    // Busca o plano real do usuário no store de dados
    const planoBase = planosData.find(p => p.id === user.planoId)
                   || planosData.find(p => p.nome.toLowerCase() === (user.plano || '').toLowerCase())
                   || planosData[1]; // fallback: GymBro

    const precoFmt = `R$ ${planoBase.preco.toFixed(2).replace('.', ',')}`;

    // Renovação: 30 dias a partir de hoje (simulado)
    const renovacao = new Date();
    renovacao.setDate(renovacao.getDate() + 30);
    const renovacaoStr = renovacao.toLocaleDateString('pt-BR');
    const tempoRestanteDias = 30;
    const progresso = Math.round((30 - tempoRestanteDias) / 30 * 100) || 5;

    const planoAtual = {
        nome:              planoBase.nome.toUpperCase(),
        descricao:         planoBase.descricao,
        beneficios:        planoBase.beneficios || [],
        preco:             precoFmt,
        periodo:           'mês',
        renovacao:         renovacaoStr,
        tempoRestanteDias,
        progresso,
    };

    // Outros planos = todos exceto o atual
    const outrosPlanos = planosData
        .filter(p => p.id !== planoBase.id)
        .map((p, _, arr) => ({
            nome:      p.nome.toUpperCase(),
            descricao: p.descricao,
            beneficios: p.beneficios || [],
            preco:     `R$ ${p.preco.toFixed(2).replace('.', ',')}`,
            periodo:   'mês',
            destaque:  p.preco === Math.max(...arr.map(x => x.preco)), // o mais caro = destaque
        }));

    res.render('pages/meu-plano', { user, planoAtual, outrosPlanos,
        seo: { title: 'Meu Plano — GymBros', canonical: '/meu-plano', robots: 'noindex, nofollow', description: 'Gerencie seu plano GymBros.' },
    });
});

//Configurações (só requer login, não exige plano ativo)
router.get('/config', requireAuth, (req, res) => {

    res.render('pages/config', { user: req.session.user,
        seo: { title: 'Configurações — GymBros', canonical: '/config', robots: 'noindex, nofollow', description: 'Configurações da conta GymBros.' },
    });
});

//Perfil IMC
router.get('/imc-form', requirePlano, (req, res) => {

    res.render('pages/imc-form', { user: req.session.user,
        seo: { title: 'Meu Perfil IMC — GymBros', canonical: '/imc-form', robots: 'noindex, nofollow', description: 'Perfil IMC personalizado GymBros.' },
    });
});

//Avaliação Corporal
router.get('/ai/avaliacao', requirePlano, (req, res) => {

    res.render('pages/ai-avaliacao', { user: req.session.user });
});

// Atualizar dados pessoais (nome e e-mail)
router.post('/config/atualizar-dados', requireAuth, (req, res) => {

    const { nome, email } = req.body;
    const user = req.session.user;

    // Verifica se o email já existe
    const emailExistente = usuarios.find(u => u.email === email && u !== user);
    if (emailExistente) {
        return res.status(400).json({ erro: 'E-mail já cadastrado.' });
    }

    // Atualiza no "banco" e na sessão
    user.nome = nome;
    user.email = email;

    const index = usuarios.findIndex(u => u === user);
    usuarios[index] = user;
    req.session.user = user;

    return res.json({ mensagem: 'Dados atualizados com sucesso!' });
});

// Alterar senha
router.post('/config/alterar-senha', requireAuth, (req, res) => {

    const { senhaAtual, novaSenha } = req.body;
    const user = req.session.user;

    if (user.password !== senhaAtual) {
        return res.status(400).json({ erro: 'Senha atual incorreta.' });
    }

    user.password = novaSenha;

    const index = usuarios.findIndex(u => u === user);
    usuarios[index] = user;
    req.session.user = user;

    return res.json({ mensagem: 'Senha alterada com sucesso!' });
});

// Alterar plano
router.post('/config/alterar-plano', requireAuth, (req, res) => {

    const { plano } = req.body;
    const user = req.session.user;

    user.plano = plano;
    // opcional: atualizar tempo de renovação ou benefícios
    user.renovacao = '20/11/2025';

    const index = usuarios.findIndex(u => u === user);
    usuarios[index] = user;
    req.session.user = user;

    return res.json({ mensagem: 'Plano atualizado com sucesso!' });
});

// Upload de foto de perfil
router.post('/api/student/profile-photo', (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ erro: 'Não autorizado.' });
    next();
}, photoUpload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });

    const photoUrl = `/uploads/profile_photos/${req.file.filename}`;
    const user = req.session.user;
    user.profile_photo = photoUrl;

    const stored = usuarios.find(u => u.cpf === user.cpf || u.id === user.id);
    if (stored) stored.profile_photo = photoUrl;
    req.session.user = user;

    return res.json({ mensagem: 'Foto atualizada com sucesso!', photoUrl });
}, (err, _req, res, _next) => {
    // multer error handler
    return res.status(400).json({ erro: err.message });
});



router.post('/imc-save', requireAuth, (req, res) => {

    const { lesoes, restricoesAlimentares, gruposAlimentares, suplementacao, ...rest } = req.body;

    req.session.user.imc = {
        ...rest,
        lesoes:                Array.isArray(lesoes)                ? lesoes                : (lesoes                ? [lesoes]                : []),
        restricoesAlimentares: Array.isArray(restricoesAlimentares) ? restricoesAlimentares : (restricoesAlimentares ? [restricoesAlimentares] : []),
        gruposAlimentares:     Array.isArray(gruposAlimentares)     ? gruposAlimentares     : (gruposAlimentares     ? [gruposAlimentares]     : []),
        suplementacao:         Array.isArray(suplementacao)         ? suplementacao         : (suplementacao         ? [suplementacao]         : []),
    };

    return res.json({ mensagem: 'Perfil salvo com sucesso! Redirecionando...' });
});

// Suporte (área do aluno)
router.get('/suporte', requirePlano, (req, res) => {
    res.render('pages/suporte', { user: req.session.user, seo: {
        title: 'Suporte — GymBros', canonical: '/suporte',
        robots: 'noindex, nofollow', description: 'Central de suporte GymBros.',
    }});
});

//Administração
router.get('/admin-dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-dashboard', { user: req.session.user });
});

//Checkin
router.get('/admin-checkins', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-checkins', { user: req.session.user });
});

//Admin Configurações
router.get('/admin-configuracoes', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-configuracoes', { user: req.session.user });
});

//Administração Login
router.get('/admin-login', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-login', { user: req.session.user });
});

//Administração Academias
router.get('/admin-academias', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-academias', { user: req.session.user });
});

//Administração Inadimplentes
router.get('/admin-financeiro-inadimplentes', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-financeiro-inadimplentes', { user: req.session.user });
});

//Administração Receitas
router.get('/admin-financeiro-receitas', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-financeiro-receitas', { user: req.session.user });
});

//Administração Financeiro
router.get('/admin-financeiro', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-financeiro', { user: req.session.user });
});

//Administração Notificações
router.get('/admin-notificacoes', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-notificacoes', { user: req.session.user });
});

//Administração Planos
router.get('/admin-planos', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-planos', { user: req.session.user });
});

//Administração Relatórios
router.get('/admin-relatorios', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-relatorios', { user: req.session.user });
});


//Administração Suporte Chat
router.get('/admin-suporte-chat', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-suporte-chat', { user: req.session.user });
});

//Administração Suporte
router.get('/admin-suporte', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-suporte', { user: req.session.user });
});

//Administração Usuário Perfil
router.get('/admin-usuario-perfil', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-usuario-perfil', { user: req.session.user });
});

//Administração Usuários
router.get('/admin-usuarios', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/admin-usuarios', { user: req.session.user });
});

// Logout
router.get('/logout', (req, res) => {
    const uid = (req.session.user?.cpf || '').replace(/\D/g, '');
    req.session.destroy(err => {
        if (err) console.error(err);
        // Serve a tiny HTML page that clears user-namespaced localStorage keys then redirects
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><script>
try {
    ['gymbros_treinos_${uid}','gymbros_evolucao_${uid}','gymbros_imc_profile_${uid}'].forEach(k => localStorage.removeItem(k));
} catch(e){}
location.href='/login';
</script></body></html>`);
    });
});

// ====================
// ROTAS POST
// ====================

// Registro
router.post('/register',
  [
    body('nome')
      .trim()
      .notEmpty().withMessage('Nome obrigatório.')
      .isLength({ min: 3 }).withMessage('Nome muito curto.'),
    body('cpf')
      .custom(value => {
        if (!validarCPF(value)) throw new Error('CPF inválido.');
        return true;
      }),
    body('email')
      .isEmail().withMessage('E-mail inválido.')
      .normalizeEmail(),
    body('cep')
      .matches(/^\d{8}$/).withMessage('CEP deve ter 8 números.'),
    body('password')
      .isLength({ min: 6 }).withMessage('A senha deve ter pelo menos 6 caracteres.'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) throw new Error('As senhas não coincidem!');
        return true;
      }),
    body('terms')
      .equals('on').withMessage('Você precisa aceitar os termos de uso.')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ erros: errors.array() });
    }

    const { nome, email, cep, password } = req.body;
    const cpf = req.body.cpf.replace(/\D/g, ''); // normaliza antes de comparar/guardar

    const cpfExiste   = usuarios.find(u => u.cpf === cpf);
    const emailExiste = usuarios.find(u => u.email === email);
    if (cpfExiste) {
      return res.status(400).json({ erros: [{ param: 'cpf', msg: 'CPF já cadastrado.' }] });
    }
    if (emailExiste) {
      return res.status(400).json({ erros: [{ param: 'email', msg: 'E-mail já cadastrado.' }] });
    }

    usuarios.push({ nome, cpf, email, cep, password, createdAt: new Date(), status: 'ativo', plano: null, planoId: null });
    console.log("Usuário registrado:", nome);

    return res.status(200).json({ mensagem: 'Cadastro realizado com sucesso! Redirecionando para o login...' });
  }
);

// Login
router.post('/login',
  [
    body('username').trim().notEmpty().withMessage('Usuário obrigatório.'),
    body('password').notEmpty().withMessage('Senha obrigatória.')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ erros: errors.array() });
    }

    const { username, password, redirect: redirectTo } = req.body;
    const user = usuarios.find(u => (u.nome === username || u.email === username || u.cpf === username) && u.password === password);

    if (!user) {
      return res.status(401).json({ erros: [{ param: 'password', msg: 'Usuário ou senha incorretos.' }] });
    }

    // salva usuário na sessão
    req.session.user = user;

    // Redireciona para redirect apenas se for path interno válido (evita open redirect)
    const safeRedirect = (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) ? redirectTo : '/area-aluno';

    console.log("Login bem-sucedido:", username);
    return res.status(200).json({ mensagem: 'Login realizado com sucesso! Redirecionando...', redirect: safeRedirect });
  }
);

// ====================
// ARQUIVOS ESTÁTICOS
// ====================
router.get('/js/carrossel.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/carrossel.js')));
router.get('/js/header.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/header.js')));
router.get('/js/forms.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/forms.js')));
router.get('/js/area-aluno.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/area-aluno.js')));

module.exports = router;
