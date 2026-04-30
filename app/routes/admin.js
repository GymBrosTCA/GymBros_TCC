/**
 * admin.js — Rotas de página do painel administrativo GymBros
 */
'use strict';

const express   = require('express');
const router    = express.Router();
const bcrypt         = require('bcrypt');
const adminAuth      = require('../middleware/adminAuth');
const db             = require('../config/db');
const User           = require('../models/User');
const Plan           = require('../models/Plan');
const Gym            = require('../models/Gym');
const SupportTicket  = require('../models/SupportTicket');
const Notification   = require('../models/Notification');

// ── Helper: constrói adminConfig a partir de res.locals.config ───────────────
function buildAdminConfig(config = {}) {
    return {
        siteName:             config.siteName             || 'GymBros',
        maintenance:          config.maintenance === 'true' || config.maintenance === true,
        version:              config.version              || '1.0.0',
        notifThresholdHours:  parseInt(config.notifThresholdHours) || 24,
    };
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
    if (req.session.admin) return res.redirect('/admin/dashboard');
    res.render('pages/admin-login', { erro: null, next: req.query.next || '/admin/dashboard' });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await db.execute(
            'SELECT * FROM admin_user WHERE email = ? AND ativo = 1',
            [email]
        );
        const admin = rows[0];
        if (!admin || !(await bcrypt.compare(password, admin.senha_hash))) {
            return res.render('pages/admin-login', { erro: 'Credenciais inválidas.', next: req.body.next || '/admin/dashboard' });
        }
        req.session.admin = {
            id:    admin.id,
            nome:  admin.nome,
            email: admin.email,
            role:  admin.role,
        };
        await db.execute('UPDATE admin_user SET ultimo_login = NOW() WHERE id = ?', [admin.id]);
        const next = req.body.next || '/admin/dashboard';
        req.session.save(err => {
            if (err) {
                console.error('[admin/login] session save error:', err);
                return res.redirect('/admin/login?erro=1');
            }
            return res.redirect(next);
        });
    } catch (err) {
        console.error('[admin/login]', err);
        res.render('pages/admin-login', { erro: 'Erro interno. Tente novamente.', next: req.body.next || '/admin/dashboard' });
    }
});

router.get('/logout', (req, res) => {
    req.session.admin = null;
    res.redirect('/admin/login');
});

// ── Aplica adminAuth em tudo abaixo ──────────────────────────────────────────
router.use(adminAuth);

// ── DASHBOARD ────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const [[{ totalUsuarios }]] = await db.execute('SELECT COUNT(*) AS totalUsuarios FROM user');
        const [[{ ativosHoje }]]    = await db.execute("SELECT COUNT(*) AS ativosHoje FROM checkin WHERE DATE(data) = CURDATE()");
        const [[{ receitaMes }]]    = await db.execute(
            "SELECT COALESCE(SUM(valor_final),0) AS receitaMes FROM payment WHERE MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW()) AND status='pago'"
        );
        const [[{ ticketsAbertosN }]] = await db.execute(
            "SELECT COUNT(*) AS ticketsAbertosN FROM support_ticket WHERE status != 'resolvido'"
        );

        // Gráfico: cadastros por dia (30 dias)
        const [cadastrosRaw] = await db.execute(
            "SELECT DATE(created_at) AS dia, COUNT(*) AS total FROM user WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) GROUP BY DATE(created_at)"
        );
        const cadastrosMap = new Map(cadastrosRaw.map(r => [r.dia.toISOString().slice(0,10), Number(r.total)]));
        const labelsDias = [], cadastrosPorDia = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            labelsDias.push(`${d.getDate()}/${d.getMonth()+1}`);
            cadastrosPorDia.push(cadastrosMap.get(d.toISOString().slice(0,10)) || 0);
        }

        // Gráfico: checkins por dia da semana
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const [checkinsDia] = await db.execute(
            'SELECT (DAYOFWEEK(data)-1) AS dia, COUNT(*) AS total FROM checkin GROUP BY DAYOFWEEK(data)'
        );
        const checkinsPorDiaSemana = diasSemana.map((_, d) => {
            const r = checkinsDia.find(x => x.dia === d);
            return r ? Number(r.total) : 0;
        });

        const [ultimosCadastros] = await db.execute(
            'SELECT id, nome, email, cpf, status, created_at FROM user ORDER BY created_at DESC LIMIT 5'
        );
        const [ticketsUrgentes] = await db.execute(
            "SELECT * FROM support_ticket WHERE status = 'aberto' AND created_at < NOW() - INTERVAL 24 HOUR LIMIT 5"
        );

        const ticketCount  = Number(ticketsAbertosN);
        const adminConfig  = buildAdminConfig(res.locals.config);

        res.render('pages/admin-dashboard', {
            ticketCount, adminConfig,
            title: 'Dashboard', page: 'dashboard', admin: req.session.admin,
            totalUsuarios: Number(totalUsuarios), ativosHoje: Number(ativosHoje),
            receitaMes: Number(receitaMes).toFixed(2),
            ticketsAbertosN: ticketCount,
            labelsDias: JSON.stringify(labelsDias),
            cadastrosPorDia: JSON.stringify(cadastrosPorDia),
            diasSemana: JSON.stringify(diasSemana),
            checkinsPorDiaSemana: JSON.stringify(checkinsPorDiaSemana),
            ultimosCadastros,
            ticketsUrgentes,
        });
    } catch (err) {
        console.error('[admin/dashboard]', err);
        res.status(500).send('Erro ao carregar dashboard.');
    }
});

// ── USUÁRIOS ──────────────────────────────────────────────────────────────────
router.get('/usuarios', async (req, res) => {
    const { busca = '', plano = '', status = '' } = req.query;
    const perPage = 15;
    const pagina  = Math.floor(Number(req.query.page)) || 1;
    const filters = { status: status || null, busca: busca || null, plano: plano || null };
    try {
        const [items, total, planos, ticketCount] = await Promise.all([
            User.findAll({ page: pagina, limit: perPage, ...filters }),
            User.count(filters),
            Plan.findAll({ activeOnly: true }),
            SupportTicket.countOpen(),
        ]);
        const pages       = Math.ceil(total / perPage);
        const adminConfig = buildAdminConfig(res.locals.config);

        res.render('pages/admin-usuarios', {
            ticketCount, adminConfig,
            title: 'Usuários', page: 'usuarios', admin: req.session.admin,
            items, total, pages, currentPage: pagina,
            busca, plano, status, planos,
        });
    } catch (err) {
        console.error('[admin/usuarios]', err);
        res.status(500).send('Erro ao carregar usuários.');
    }
});

// ── PERFIL DO USUÁRIO ─────────────────────────────────────────────────────────
router.get('/usuarios/:id', async (req, res) => {
    try {
        const [[user]] = await db.execute('SELECT * FROM user WHERE id = ?', [req.params.id]);
        if (!user) return res.redirect('/admin/usuarios');

        const [userCheckins]  = await db.execute(
            'SELECT c.*, g.nome AS academiaNome FROM checkin c LEFT JOIN gym g ON g.id=c.gym_id WHERE c.user_id=? ORDER BY c.data DESC LIMIT 20',
            [user.id]
        );
        const [userTickets]   = await db.execute('SELECT * FROM support_ticket WHERE user_id=? ORDER BY created_at DESC', [user.id]);
        const [userTransacoes]= await db.execute(
            'SELECT py.*, p.nome AS planoNome FROM payment py LEFT JOIN plan p ON p.id=py.plan_id WHERE py.user_id=? ORDER BY py.created_at DESC',
            [user.id]
        );
        const [academias]     = await db.execute('SELECT id, nome FROM gym WHERE status="ativa"');

        const [tc]  = await db.execute("SELECT COUNT(*) AS cnt FROM support_ticket WHERE status != 'resolvido'");
        const adminConfig = buildAdminConfig(res.locals.config);

        res.render('pages/admin-usuario-perfil', {
            ticketCount: tc[0].cnt, adminConfig,
            title: `Perfil — ${user.nome}`, page: 'usuarios', admin: req.session.admin,
            user, userCheckins, userTickets, userTransacoes, academias,
        });
    } catch (err) {
        console.error('[admin/usuarios/:id]', err);
        res.status(500).send('Erro ao carregar perfil.');
    }
});

// ── ACADEMIAS ─────────────────────────────────────────────────────────────────
router.get('/academias', async (req, res) => {
    try {
        const [academias, ticketCount] = await Promise.all([
            Gym.findAll(),
            SupportTicket.countOpen(),
        ]);
        const adminConfig = buildAdminConfig(res.locals.config);
        res.render('pages/admin-academias', {
            ticketCount, adminConfig,
            title: 'Academias', page: 'academias', admin: req.session.admin,
            academias,
        });
    } catch (err) {
        console.error('[admin/academias]', err);
        res.status(500).send('Erro ao carregar academias.');
    }
});

// ── PLANOS ───────────────────────────────────────────────────────────────────
router.get('/planos', async (req, res) => {
    try {
        const [planos, ticketCount] = await Promise.all([
            Plan.findAllWithSubscriberCount(),
            SupportTicket.countOpen(),
        ]);
        const adminConfig = buildAdminConfig(res.locals.config);
        res.render('pages/admin-planos', {
            ticketCount, adminConfig,
            title: 'Planos', page: 'planos', admin: req.session.admin,
            planos,
        });
    } catch (err) {
        console.error('[admin/planos]', err);
        res.status(500).send('Erro ao carregar planos.');
    }
});

// ── CHECK-INS ────────────────────────────────────────────────────────────────
router.get('/checkins', async (req, res) => {
    const { academia = '' } = req.query;
    const perPage = 20;
    const pagina  = Math.floor(Number(req.query.page)) || 1;
    const offset  = (pagina - 1) * perPage;
    try {
        const params = [];
        let where = 'WHERE 1=1';
        if (academia) { where += ' AND c.gym_id = ?'; params.push(academia); }

        const [[{ total }]]   = await db.execute(`SELECT COUNT(*) AS total FROM checkin c ${where}`, params);
        const [[{ checkinsHoje }]] = await db.execute("SELECT COUNT(*) AS checkinsHoje FROM checkin WHERE DATE(data) = CURDATE()");

        const [items] = await db.execute(
            `SELECT c.*, u.nome AS userName, g.nome AS academiaNome
             FROM checkin c
             LEFT JOIN user u ON u.id=c.user_id
             LEFT JOIN gym g ON g.id=c.gym_id
             ${where} ORDER BY c.data DESC LIMIT ${perPage} OFFSET ${offset}`,
            params
        );

        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const [heatmapRaw] = await db.execute(
            'SELECT (DAYOFWEEK(data)-1) AS dia, COUNT(*) AS total FROM checkin GROUP BY DAYOFWEEK(data)'
        );
        const heatmap = diasSemana.map((_, d) => {
            const r = heatmapRaw.find(x => x.dia === d);
            return r ? Number(r.total) : 0;
        });

        const [academias] = await db.execute('SELECT id, nome FROM gym WHERE status = "ativa"');
        const [tc]  = await db.execute("SELECT COUNT(*) AS cnt FROM support_ticket WHERE status != 'resolvido'");
        const adminConfig = buildAdminConfig(res.locals.config);

        res.render('pages/admin-checkins', {
            ticketCount: tc[0].cnt, adminConfig,
            title: 'Check-ins', page: 'checkins', admin: req.session.admin,
            items, total: Number(total), pages: Math.ceil(total / perPage), currentPage: pagina,
            academia, academias, checkinsHoje: Number(checkinsHoje),
            heatmap: JSON.stringify(heatmap),
            diasSemana: JSON.stringify(diasSemana),
        });
    } catch (err) {
        console.error('[admin/checkins]', err);
        res.status(500).send('Erro ao carregar check-ins.');
    }
});

// ── FINANCEIRO ───────────────────────────────────────────────────────────────
router.get('/financeiro', async (req, res) => {
    try {
        const [[{ receitaMes }]]      = await db.execute("SELECT COALESCE(SUM(valor_final),0) AS receitaMes FROM payment WHERE MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW()) AND status='pago'");
        const [[{ receitaAnterior }]] = await db.execute("SELECT COALESCE(SUM(valor_final),0) AS receitaAnterior FROM payment WHERE MONTH(created_at)=MONTH(NOW()-INTERVAL 1 MONTH) AND YEAR(created_at)=YEAR(NOW()-INTERVAL 1 MONTH) AND status='pago'");
        const [[{ inadimplentes }]]   = await db.execute("SELECT COUNT(*) AS inadimplentes FROM payment WHERE status='pendente'");

        const [receitaPlanoRaw] = await db.execute(
            `SELECT p.nome, COALESCE(SUM(py.valor_final),0) AS valor, COUNT(up.id) AS count
             FROM plan p
             LEFT JOIN payment py ON py.plan_id=p.id AND py.status='pago'
             LEFT JOIN user_plan up ON up.plan_id=p.id AND up.status='ativo'
             GROUP BY p.id ORDER BY p.preco ASC`
        );

        const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const [receitaMensalRaw] = await db.execute(
            "SELECT MONTH(created_at)-1 AS mes, COALESCE(SUM(valor_final),0) AS total FROM payment WHERE status='pago' AND YEAR(created_at)=YEAR(NOW()) GROUP BY MONTH(created_at)"
        );
        const receitaMensal = meses.map((_, m) => {
            const r = receitaMensalRaw.find(x => x.mes === m);
            return r ? Number(r.total).toFixed(2) : '0.00';
        });

        const rm = Number(receitaMes), ra = Number(receitaAnterior);
        const [tc] = await db.execute("SELECT COUNT(*) AS cnt FROM support_ticket WHERE status != 'resolvido'");
        const adminConfig = buildAdminConfig(res.locals.config);

        res.render('pages/admin-financeiro', {
            ticketCount: tc[0].cnt, adminConfig,
            title: 'Financeiro', page: 'financeiro', admin: req.session.admin,
            receitaMes: rm.toFixed(2),
            receitaAnterior: ra.toFixed(2),
            variacao: ra > 0 ? (((rm - ra) / ra) * 100).toFixed(1) : 0,
            receitaPorPlano: receitaPlanoRaw,
            inadimplentes: Number(inadimplentes),
            meses: JSON.stringify(meses),
            receitaMensal: JSON.stringify(receitaMensal),
        });
    } catch (err) {
        console.error('[admin/financeiro]', err);
        res.status(500).send('Erro ao carregar financeiro.');
    }
});

router.get('/financeiro/receitas', async (req, res) => {
    const { status = '', page = 1 } = req.query;
    const perPage = 20;
    const offset  = (parseInt(page) - 1) * perPage;
    try {
        const params = [];
        let where = 'WHERE 1=1';
        if (status) { where += ' AND py.status = ?'; params.push(status); }

        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM payment py ${where}`, params);
        const [items] = await db.execute(
            `SELECT py.*, u.nome AS userName, u.email AS userEmail, p.nome AS planoNome
             FROM payment py
             LEFT JOIN user u ON u.id=py.user_id
             LEFT JOIN plan p ON p.id=py.plan_id
             ${where} ORDER BY py.created_at DESC LIMIT ${perPage} OFFSET ${offset}`,
            params
        );

        const [tc] = await db.execute("SELECT COUNT(*) AS cnt FROM support_ticket WHERE status != 'resolvido'");
        const adminConfig = buildAdminConfig(res.locals.config);
        res.render('pages/admin-financeiro-receitas', {
            ticketCount: tc[0].cnt, adminConfig,
            title: 'Receitas', page: 'financeiro', admin: req.session.admin,
            items, total: Number(total), pages: Math.ceil(total / perPage), currentPage: parseInt(page), status,
        });
    } catch (err) {
        console.error('[admin/financeiro/receitas]', err);
        res.status(500).send('Erro ao carregar receitas.');
    }
});

router.get('/financeiro/inadimplentes', async (req, res) => {
    try {
        const [lista] = await db.execute('SELECT * FROM vw_inadimplentes');
        const [tc] = await db.execute("SELECT COUNT(*) AS cnt FROM support_ticket WHERE status != 'resolvido'");
        const adminConfig = buildAdminConfig(res.locals.config);
        res.render('pages/admin-financeiro-inadimplentes', {
            ticketCount: tc[0].cnt, adminConfig,
            title: 'Inadimplentes', page: 'financeiro', admin: req.session.admin,
            lista,
        });
    } catch (err) {
        console.error('[admin/financeiro/inadimplentes]', err);
        res.status(500).send('Erro ao carregar inadimplentes.');
    }
});

// ── SUPORTE ───────────────────────────────────────────────────────────────────
router.get('/suporte', async (req, res) => {
    const { status = '' } = req.query;
    try {
        const [lista, counts] = await Promise.all([
            SupportTicket.findAll({ status: status || null }),
            SupportTicket.counts(),
        ]);
        const adminConfig = buildAdminConfig(res.locals.config);

        res.render('pages/admin-suporte', {
            ticketCount: counts.aberto + counts.em_atendimento, adminConfig,
            title: 'Suporte', page: 'suporte', admin: req.session.admin,
            lista, status, counts,
        });
    } catch (err) {
        console.error('[admin/suporte]', err);
        res.status(500).send('Erro ao carregar suporte.');
    }
});

router.get('/suporte/:ticketId', async (req, res) => {
    try {
        const [[ticket]] = await db.execute('SELECT * FROM support_ticket WHERE id = ?', [req.params.ticketId]);
        if (!ticket) return res.redirect('/admin/suporte');

        const [msgs] = await db.execute(
            'SELECT * FROM support_message WHERE ticket_id = ? ORDER BY created_at ASC',
            [ticket.id]
        );
        const [[user]] = await db.execute('SELECT id, nome, email, cpf FROM user WHERE id = ?', [ticket.user_id]);

        const [tc] = await db.execute("SELECT COUNT(*) AS cnt FROM support_ticket WHERE status != 'resolvido'");
        const adminConfig = buildAdminConfig(res.locals.config);
        res.render('pages/admin-suporte-chat', {
            ticketCount: tc[0].cnt, adminConfig,
            title: `Ticket #${ticket.id}`, page: 'suporte', admin: req.session.admin,
            ticket, msgs, user,
        });
    } catch (err) {
        console.error('[admin/suporte/:ticketId]', err);
        res.status(500).send('Erro ao carregar ticket.');
    }
});

// ── NOTIFICAÇÕES ─────────────────────────────────────────────────────────────
router.get('/notificacoes', async (req, res) => {
    try {
        const [lista, planos, ticketCount] = await Promise.all([
            Notification.findAll(),
            Plan.findAll({ activeOnly: true }),
            SupportTicket.countOpen(),
        ]);
        const adminConfig = buildAdminConfig(res.locals.config);
        res.render('pages/admin-notificacoes', {
            ticketCount, adminConfig,
            title: 'Notificações', page: 'notificacoes', admin: req.session.admin,
            lista, planos,
        });
    } catch (err) {
        console.error('[admin/notificacoes]', err);
        res.status(500).send('Erro ao carregar notificações.');
    }
});

// ── RELATÓRIOS ────────────────────────────────────────────────────────────────
router.get('/relatorios', async (req, res) => {
    try {
        // Crescimento: novos usuários por mês (6 meses)
        const [crescRaw] = await db.execute(
            `SELECT DATE_FORMAT(created_at, '%b') AS mes,
                    MONTH(created_at) AS mesNum,
                    YEAR(created_at)  AS ano,
                    COUNT(*) AS total
             FROM user
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
             GROUP BY YEAR(created_at), MONTH(created_at)
             ORDER BY ano ASC, mesNum ASC`
        );

        // Preenche meses sem cadastro com 0
        const mesesLabels = [], crescimento = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            const label = d.toLocaleString('pt-BR', { month: 'short' });
            mesesLabels.push(label);
            const r = crescRaw.find(x => x.mesNum === d.getMonth()+1 && x.ano === d.getFullYear());
            crescimento.push(r ? Number(r.total) : 0);
        }

        const [distPlanoRaw] = await db.execute(
            `SELECT p.nome, COUNT(up.id) AS count
             FROM plan p
             LEFT JOIN user_plan up ON up.plan_id=p.id AND up.status='ativo'
             GROUP BY p.id ORDER BY p.preco ASC`
        );

        const [acadAtivasRaw] = await db.execute(
            `SELECT g.nome, COUNT(c.id) AS count
             FROM gym g
             LEFT JOIN checkin c ON c.gym_id=g.id
             GROUP BY g.id ORDER BY count DESC LIMIT 6`
        );

        const [tc] = await db.execute("SELECT COUNT(*) AS cnt FROM support_ticket WHERE status != 'resolvido'");
        const adminConfig = buildAdminConfig(res.locals.config);

        res.render('pages/admin-relatorios', {
            ticketCount: tc[0].cnt, adminConfig,
            title: 'Relatórios', page: 'relatorios', admin: req.session.admin,
            meses: JSON.stringify(mesesLabels),
            crescimento: JSON.stringify(crescimento),
            distPlano: JSON.stringify(distPlanoRaw),
            acadAtivas: JSON.stringify(acadAtivasRaw),
        });
    } catch (err) {
        console.error('[admin/relatorios]', err);
        res.status(500).send('Erro ao carregar relatórios.');
    }
});

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
router.get('/configuracoes', async (req, res) => {
    try {
        const [tc] = await db.execute("SELECT COUNT(*) AS cnt FROM support_ticket WHERE status != 'resolvido'");
        const adminConfig = buildAdminConfig(res.locals.config);
        res.render('pages/admin-configuracoes', {
            ticketCount: tc[0].cnt, adminConfig,
            title: 'Configurações', page: 'configuracoes', admin: req.session.admin,
        });
    } catch (err) {
        console.error('[admin/configuracoes]', err);
        res.status(500).send('Erro ao carregar configurações.');
    }
});

module.exports = router;
