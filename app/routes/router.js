// router.js
const express    = require('express');
const router     = express.Router();
const path       = require('path');
const multer     = require('multer');
const QRCode     = require('qrcode');
const bcrypt     = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { enviarBoleto }   = require('../services/email');
const { gerarBoletoPDF } = require('../services/pdf');
const db         = require('../config/db');
const i18n       = require('../config/i18n');
const { broadcast, onlineUsers } = require('../events');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

function safeJson(str, fallback) {
    try { return JSON.parse(str || 'null') ?? fallback; }
    catch { return fallback; }
}

// ── Multer: upload de foto de perfil ──────────────────────────────────────────
const photoStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder:            'gymbros/profile_photos',
        allowed_formats:   ['jpg', 'jpeg', 'png', 'webp'],
        transformation:    [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
        public_id:         (req) => `avatar_${req.session.user?.cpf?.replace(/\D/g, '') || Date.now()}`,
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

// ── Middleware: rastreia usuários online ──────────────────────────────────────
router.use((req, res, next) => {
    if (req.session && req.session.user) {
        const user = req.session.user;
        const uid  = String(user.id);
        const isNew = !onlineUsers.has(uid);
        onlineUsers.set(uid, { nome: user.nome, email: user.email, page: req.path, lastSeen: Date.now() });
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
router.get('/pagamento', async (req, res) => {
    if (!req.session.user) {
        const plano = req.query.plano ? `?plano=${encodeURIComponent(req.query.plano)}` : '';
        return res.redirect(`/login?redirect=/pagamento${encodeURIComponent(plano)}`);
    }
    const slug = (req.query.plano || 'gymbro').toLowerCase();
    try {
        const [rows] = await db.execute(
            'SELECT * FROM plan WHERE slug = ? AND status = "ativo" LIMIT 1', [slug]
        );
        const plano = rows[0];
        if (!plano) return res.redirect('/planos');
        res.render('pages/pagamento', {
            user: req.session.user,
            plano,
            seo: {
                title:       'Pagamento — GymBros',
                canonical:   '/pagamento',
                robots:      'noindex, nofollow',
                description: 'Finalize sua assinatura GymBros com segurança.',
            }
        });
    } catch (err) {
        console.error('[pagamento]', err);
        res.redirect('/planos');
    }
});

router.post('/api/pagamento', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ erro: 'Não autorizado.' });

    const { planoId, planoNome, valor, metodo, parcelas, cartaoFinal, bandeira } = req.body;
    const user   = req.session.user;
    const status = 'pago';
    const valorN = Number(valor);

    try {
        // 1. Buscar id numérico do plano no banco
        const [planRows] = await db.execute('SELECT id, nome, slug FROM plan WHERE slug = ? OR nome = ? LIMIT 1', [planoId, planoNome]);
        const plan = planRows[0];
        if (!plan) return res.status(400).json({ erro: 'Plano não encontrado.' });

        // 2. Inserir pagamento
        const [payResult] = await db.execute(
            `INSERT INTO payment
             (user_id, plan_id, valor_bruto, valor_final, metodo, parcelas,
              cartao_final, cartao_bandeira, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user.id, plan.id, valorN, valorN, metodo, Number(parcelas) || 1,
             cartaoFinal || null, bandeira || null, status]
        );
        const paymentId = payResult.insertId;

        // 3. Ativar plano via procedure
        if (status === 'pago') {
            try {
                await db.execute('CALL sp_ativar_plano(?, ?, ?)', [user.id, plan.id, paymentId]);
            } catch (spErr) {
                console.error('[pagamento] sp_ativar_plano ERRO:', spErr.message);
            }
        }

        // 4. Atualizar sessão
        req.session.user = { ...user, plano: plan.nome, planoId: plan.id, planoSlug: plan.slug, status: 'ativo' };

        // 5. Notificar admin via SSE
        broadcast('nova_compra', {
            paymentId,
            userName:  user.nome,
            userEmail: user.email,
            planoNome: plan.nome,
            valor:     valorN,
            metodo,
            status,
        });

        req.session.save(err => {
            if (err) console.error('[pagamento] session save error:', err);
            return res.json({ ok: true, status, transacaoId: paymentId });
        });
    } catch (err) {
        console.error('[api/pagamento]', err);
        return res.status(500).json({ ok: false, erro: 'Erro ao processar pagamento.' });
    }
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
router.get('/area-aluno', requirePlano, async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT last_imc_update, last_avaliacao_update, notification_interval_days FROM user WHERE id = ?',
            [req.session.user.id]
        );
        const extra = rows[0] || {};
        res.render('pages/area-aluno', {
            user: { ...req.session.user, ...extra },
            seo: {
                title: 'Painel do Aluno — GymBros', canonical: '/area-aluno',
                robots: 'noindex, nofollow', description: 'Painel do aluno GymBros.',
            }
        });
    } catch (err) {
        console.error('[area-aluno]', err);
        res.render('pages/area-aluno', { user: req.session.user, seo: {
            title: 'Painel do Aluno — GymBros', canonical: '/area-aluno',
            robots: 'noindex, nofollow', description: 'Painel do aluno GymBros.',
        }});
    }
});

router.post('/config/notificacao-intervalo', requireAuth, async (req, res) => {
    const dias = Math.max(1, parseInt(req.body.dias) || 7);
    try {
        await db.execute('UPDATE user SET notification_interval_days = ? WHERE id = ?',
            [dias, req.session.user.id]);
        req.session.user.notification_interval_days = dias;
        res.json({ ok: true });
    } catch (err) {
        console.error('[notificacao-intervalo]', err);
        res.status(500).json({ ok: false });
    }
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
router.get('/meu-plano', requirePlano, async (req, res) => {
    const user = req.session.user;
    try {
        const [planoRows] = await db.execute(
            `SELECT p.* FROM plan p
             JOIN user_plan up ON up.plan_id = p.id
             WHERE up.user_id = ? AND up.status = 'ativo'
             LIMIT 1`,
            [user.id]
        );
        const [todosPlanos] = await db.execute(
            `SELECT * FROM plan WHERE status = 'ativo' ORDER BY preco ASC`
        );

        const planoBase = planoRows[0] || todosPlanos[1] || todosPlanos[0];
        const beneficios = (() => { try { return JSON.parse(planoBase.beneficios || '[]'); } catch { return []; } })();

        const renovacao = new Date();
        renovacao.setDate(renovacao.getDate() + 30);
        const renovacaoStr = renovacao.toLocaleDateString('pt-BR');
        const tempoRestanteDias = 30;
        const progresso = 5;

        const planoAtual = {
            nome:              planoBase.nome.toUpperCase(),
            descricao:         planoBase.descricao,
            beneficios,
            preco:             `R$ ${Number(planoBase.preco).toFixed(2).replace('.', ',')}`,
            periodo:           'mês',
            renovacao:         renovacaoStr,
            tempoRestanteDias,
            progresso,
        };

        const outrosPlanos = todosPlanos
            .filter(p => p.id !== planoBase.id)
            .map((p, _, arr) => {
                const ben = (() => { try { return JSON.parse(p.beneficios || '[]'); } catch { return []; } })();
                return {
                    nome:       p.nome.toUpperCase(),
                    descricao:  p.descricao,
                    beneficios: ben,
                    preco:      `R$ ${Number(p.preco).toFixed(2).replace('.', ',')}`,
                    periodo:    'mês',
                    destaque:   Number(p.preco) === Math.max(...arr.map(x => Number(x.preco))),
                };
            });

        res.render('pages/meu-plano', { user, planoAtual, outrosPlanos,
            seo: { title: 'Meu Plano — GymBros', canonical: '/meu-plano', robots: 'noindex, nofollow', description: 'Gerencie seu plano GymBros.' },
        });
    } catch (err) {
        console.error('[meu-plano]', err);
        res.status(500).send('Erro ao carregar plano.');
    }
});

//Configurações (só requer login, não exige plano ativo)
router.get('/config', requireAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT notification_interval_days FROM user WHERE id = ?',
            [req.session.user.id]
        );
        req.session.user.notification_interval_days = rows[0]?.notification_interval_days ?? 7;
    } catch (_) { /* mantém valor da sessão se houver */ }

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
router.post('/config/atualizar-dados', requireAuth, async (req, res) => {
    const { nome, email, cep } = req.body;
    const user = req.session.user;
    try {
        const [dup] = await db.execute(
            'SELECT id FROM user WHERE email = ? AND id != ?',
            [email, user.id]
        );
        if (dup.length > 0) return res.status(400).json({ erro: 'E-mail já cadastrado.' });

        await db.execute(
            'UPDATE user SET nome = ?, email = ?, cep = ? WHERE id = ?',
            [nome, email, cep || user.cep, user.id]
        );
        req.session.user = { ...user, nome, email };
        return res.json({ mensagem: 'Dados atualizados com sucesso!' });
    } catch (err) {
        console.error('[config/atualizar-dados]', err);
        return res.status(500).json({ erro: 'Erro ao atualizar dados.' });
    }
});

// Alterar senha
router.post('/config/alterar-senha', requireAuth, async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    const user = req.session.user;
    try {
        const [rows] = await db.execute('SELECT senha_hash FROM user WHERE id = ?', [user.id]);
        if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        const ok = await bcrypt.compare(senhaAtual, rows[0].senha_hash);
        if (!ok) return res.status(400).json({ erro: 'Senha atual incorreta.' });
        const novaHash = await bcrypt.hash(novaSenha, 10);
        await db.execute('UPDATE user SET senha_hash = ? WHERE id = ?', [novaHash, user.id]);
        return res.json({ mensagem: 'Senha alterada com sucesso!' });
    } catch (err) {
        console.error('[config/alterar-senha]', err);
        return res.status(500).json({ erro: 'Erro ao alterar senha.' });
    }
});

// Alterar plano (redirecionamento para pagamento — não muda diretamente)
router.post('/config/alterar-plano', requireAuth, (req, res) => {
    return res.json({ mensagem: 'Redirecionando para pagamento...' });
});

// Upload de foto de perfil
router.post('/api/student/profile-photo', (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ erro: 'Não autorizado.' });
    next();
}, photoUpload.single('photo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });

    const photoUrl = req.file.path; // URL do Cloudinary
    const user = req.session.user;
    try {
        await db.execute('UPDATE user SET profile_photo = ? WHERE id = ?', [photoUrl, user.id]);
        req.session.user = { ...user, profile_photo: photoUrl };
        return res.json({ mensagem: 'Foto atualizada com sucesso!', photoUrl });
    } catch (err) {
        console.error('[profile-photo]', err);
        return res.status(500).json({ erro: 'Erro ao salvar foto.' });
    }
}, (err, _req, res, _next) => {
    return res.status(400).json({ erro: err.message });
});



router.post('/imc-save', requireAuth, async (req, res) => {
    const {
        lesoes, restricoesAlimentares, gruposAlimentares, suplementacao,
        peso, altura, idade, sexo, objetivo, experiencia,
        diasSemana, tempoPorSessao, localTreino, hidratacao,
        seletividade, alimentosSeletividade,
    } = req.body;

    const toArr = v => Array.isArray(v) ? v : (v ? [v] : []);

    const lesoesArr   = toArr(lesoes);
    const restricArr  = toArr(restricoesAlimentares);
    const gruposArr   = toArr(gruposAlimentares);
    const suplArr     = toArr(suplementacao);

    const alturaM   = Number(altura) > 3 ? Number(altura) / 100 : Number(altura);
    const pesoN     = Number(peso);
    const imc       = alturaM > 0 ? (pesoN / (alturaM * alturaM)).toFixed(1) : null;

    try {
        await db.execute(
            `INSERT INTO imc_profile
             (user_id, peso, altura, imc_valor, idade, sexo, objetivo,
              experiencia, dias_semana, tempo_por_sessao, local_treino,
              lesoes, restricoes_alimentares, suplementacao, hidratacao)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.session.user.id,
                pesoN, alturaM, imc, Number(idade), sexo, objetivo,
                experiencia, Number(diasSemana), tempoPorSessao, localTreino,
                JSON.stringify(lesoesArr), JSON.stringify(restricArr),
                JSON.stringify(suplArr), hidratacao,
            ]
        );

        await db.execute(
            'UPDATE user SET peso = ?, altura = ?, imc = ?, objetivo = ?, last_imc_update = NOW() WHERE id = ?',
            [pesoN, alturaM, imc, objetivo, req.session.user.id]
        );

        req.session.user.imc = {
            peso: pesoN, altura, imcValor: imc, idade, sexo, objetivo,
            experiencia, diasSemana, tempoPorSessao, localTreino,
            lesoes: lesoesArr, restricoesAlimentares: restricArr,
            gruposAlimentares: gruposArr, suplementacao: suplArr,
            hidratacao, seletividade, alimentosSeletividade,
        };

        return res.json({ mensagem: 'Perfil salvo com sucesso! Redirecionando...' });
    } catch (err) {
        console.error('[imc-save]', err);
        return res.status(500).json({ erro: 'Erro ao salvar perfil.' });
    }
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
    body('nome').trim().notEmpty().withMessage('Nome obrigatório.').isLength({ min: 3 }).withMessage('Nome muito curto.'),
    body('cpf').custom(value => { if (!validarCPF(value)) throw new Error('CPF inválido.'); return true; }),
    body('email').isEmail().withMessage('E-mail inválido.'),
    body('cep').matches(/^\d{8}$/).withMessage('CEP deve ter 8 números.'),
    body('password').isLength({ min: 6 }).withMessage('A senha deve ter pelo menos 6 caracteres.'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.password) throw new Error('As senhas não coincidem!');
        return true;
    }),
    body('terms').equals('on').withMessage('Você precisa aceitar os termos de uso.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ erros: errors.array() });

    const { nome, email, cep, password, logradouro, numero, complemento, bairro, cidade, estado } = req.body;
    const cpf = req.body.cpf.replace(/\D/g, '');

    try {
        const [cpfRows]   = await db.execute('SELECT id FROM user WHERE cpf = ?', [cpf]);
        const [emailRows] = await db.execute('SELECT id FROM user WHERE email = ?', [email]);

        if (cpfRows.length > 0)   return res.status(400).json({ erros: [{ param: 'cpf',   msg: 'CPF já cadastrado.' }] });
        if (emailRows.length > 0) return res.status(400).json({ erros: [{ param: 'email', msg: 'E-mail já cadastrado.' }] });

        const senha_hash = await bcrypt.hash(password, 10);
        await db.execute(
            'INSERT INTO user (nome, cpf, email, senha_hash, cep, logradouro, numero, complemento, bairro, cidade, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nome, cpf, email, senha_hash, cep, logradouro || null, numero || null, complemento || null, bairro || null, cidade || null, estado || null]
        );
        return res.status(200).json({ mensagem: 'Cadastro realizado com sucesso! Redirecionando para o login...' });
    } catch (err) {
        console.error('[register]', err);
        return res.status(500).json({ erros: [{ msg: 'Erro interno ao cadastrar.' }] });
    }
  }
);

// Login
router.post('/login',
  [
    body('username').trim().notEmpty().withMessage('Usuário obrigatório.'),
    body('password').notEmpty().withMessage('Senha obrigatória.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ erros: errors.array() });

    const { username, password, redirect: redirectTo } = req.body;
    const identifier = username.trim();
    const cpfNorm    = identifier.replace(/\D/g, '');

    try {
        // Busca por CPF (digits only) ou por e-mail
        let userRows;
        if (/^\d{11}$/.test(cpfNorm)) {
            [userRows] = await db.execute(
                "SELECT * FROM user WHERE cpf = ? AND status = 'ativo'",
                [cpfNorm]
            );
        }
        if (!userRows || userRows.length === 0) {
            [userRows] = await db.execute(
                "SELECT * FROM user WHERE email = ? AND status = 'ativo'",
                [identifier.toLowerCase()]
            );
        }
        if (!userRows || userRows.length === 0) {
            [userRows] = await db.execute(
                "SELECT * FROM user WHERE nome = ? AND status = 'ativo'",
                [identifier]
            );
        }

        const user = userRows[0];
        if (!user || !(await bcrypt.compare(password, user.senha_hash))) {
            await db.execute(
                'INSERT INTO login_attempt (identificador, ip, sucesso) VALUES (?, ?, 0)',
                [identifier, req.ip]
            ).catch(() => {});
            return res.status(401).json({ erros: [{ param: 'password', msg: 'Usuário ou senha incorretos.' }] });
        }

        // Busca plano ativo
        const [planoRows] = await db.execute(
            `SELECT p.* FROM plan p
             JOIN user_plan up ON up.plan_id = p.id
             WHERE up.user_id = ? AND up.status = 'ativo'
             LIMIT 1`,
            [user.id]
        );
        const plano = planoRows[0] || null;

        // Busca último perfil IMC
        const [imcRows] = await db.execute(
            `SELECT * FROM imc_profile WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
            [user.id]
        );

        // Busca última avaliação corporal
        const [avalRows] = await db.execute(
            `SELECT * FROM body_photo WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
            [user.id]
        );

        // Busca dados extras do user
        const [userExtra] = await db.execute(
            `SELECT last_imc_update, last_avaliacao_update, notification_interval_days FROM user WHERE id = ?`,
            [user.id]
        );
        const extra = userExtra[0] || {};

        const imcData = imcRows[0] ? {
            peso:                  imcRows[0].peso,
            altura:                imcRows[0].altura,
            imcValor:              imcRows[0].imc_valor,
            idade:                 imcRows[0].idade,
            sexo:                  imcRows[0].sexo,
            objetivo:              imcRows[0].objetivo,
            experiencia:           imcRows[0].experiencia,
            diasSemana:            imcRows[0].dias_semana,
            tempoPorSessao:        imcRows[0].tempo_por_sessao,
            localTreino:           imcRows[0].local_treino,
            lesoes:                safeJson(imcRows[0].lesoes, []),
            restricoesAlimentares: safeJson(imcRows[0].restricoes_alimentares, []),
            suplementacao:         safeJson(imcRows[0].suplementacao, []),
            hidratacao:            imcRows[0].hidratacao,
            seletividade:          imcRows[0].seletividade,
            alimentosSeletividade: imcRows[0].alimentos_seletividade,
        } : null;

        const avalRaw = avalRows[0] ? safeJson(avalRows[0].analise_raw, null) : null;
        const avalData = avalRaw ? {
            ...avalRaw,
            data: new Date(avalRows[0].created_at).toLocaleDateString('pt-BR'),
        } : null;

        req.session.user = {
            id:                         user.id,
            nome:                       user.nome,
            email:                      user.email,
            cpf:                        user.cpf,
            plano:                      plano?.nome  || null,
            planoId:                    plano?.id    || null,
            planoSlug:                  plano?.slug  || null,
            profile_photo:              user.profile_photo || null,
            status:                     user.status,
            last_imc_update:            extra.last_imc_update || null,
            last_avaliacao_update:      extra.last_avaliacao_update || null,
            notification_interval_days: extra.notification_interval_days || 7,
            imc:                        imcData,
            avaliacaoCorporal:          avalData,
        };

        await db.execute(
            'INSERT INTO login_attempt (identificador, ip, sucesso) VALUES (?, ?, 1)',
            [identifier, req.ip]
        ).catch(() => {});

        broadcast('user_online', { id: user.id, nome: user.nome, email: user.email });

        const safeRedirect = (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) ? redirectTo : '/area-aluno';
        req.session.save(err => {
            if (err) {
                console.error('[login] session save error:', err);
                return res.status(500).json({ erros: [{ msg: 'Erro ao salvar sessão.' }] });
            }
            return res.status(200).json({ mensagem: 'Login realizado com sucesso! Redirecionando...', redirect: safeRedirect });
        });
    } catch (err) {
        console.error('[login]', err);
        return res.status(500).json({ erros: [{ msg: 'Erro interno ao autenticar.' }] });
    }
  }
);

// ====================
// ARQUIVOS ESTÁTICOS
// ====================
router.get('/js/carrossel.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/carrossel.js')));
router.get('/js/header.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/header.js')));
router.get('/js/forms.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/forms.js')));
router.get('/js/area-aluno.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/area-aluno.js')));

// ====================
// TROCA DE IDIOMA
// ====================
router.get('/lang/:locale', (req, res) => {
    const locale = req.params.locale;
    if (['pt', 'en', 'es'].includes(locale)) {
        res.cookie('gymbros_lang', locale, { maxAge: 365 * 24 * 60 * 60 * 1000, path: '/', sameSite: 'Lax' });
        i18n.setLocale(req, locale);
    }
    const back = req.headers.referer || '/';
    res.redirect(back);
});

module.exports = router;
