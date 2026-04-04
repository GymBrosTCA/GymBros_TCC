/**
 * admin.js — Rotas de página do painel administrativo GymBros
 */
'use strict';

const express   = require('express');
const router    = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { usuarios, academias, planos, checkins, transacoes, tickets, mensagens, notificacoes, adminConfig } = require('../data');

// ── Helper: count tickets abertos ────────────────────────────────────────────
function ticketsAbertos() {
    return tickets.filter(t => t.status !== 'resolvido').length;
}

// ── Helper: injeta variáveis comuns em todas as views admin ──────────────────
function adminLocals(extra = {}) {
    return {
        ticketCount: ticketsAbertos(),
        adminConfig,
        ...extra,
    };
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
    if (req.session.admin) return res.redirect('/admin/dashboard');
    res.render('pages/admin-login', { erro: null, next: req.query.next || '/admin/dashboard' });
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@gymbros.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (email === adminEmail && password === adminPassword) {
        req.session.admin = { email, loggedAt: new Date() };
        const next = req.body.next || '/admin/dashboard';
        return res.redirect(next);
    }
    res.render('pages/admin-login', { erro: 'Credenciais inválidas.', next: req.body.next || '/admin/dashboard' });
});

router.get('/logout', (req, res) => {
    req.session.admin = null;
    res.redirect('/admin/login');
});

// ── Aplica adminAuth em tudo abaixo ──────────────────────────────────────────
router.use(adminAuth);

// ── DASHBOARD ────────────────────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // KPIs
    const totalUsuarios    = usuarios.length;
    const ativosHoje       = checkins.filter(c => c.data >= hoje).length;
    const receitaMes       = transacoes
        .filter(t => t.status === 'pago' && t.data.getMonth() === new Date().getMonth())
        .reduce((s, t) => s + t.valor, 0);
    const ticketsAbertosN  = ticketsAbertos();

    // Gráfico: novos cadastros por dia (últimos 30 dias)
    const cadastrosPorDia = [];
    const labelsDias = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
        const prox = new Date(d); prox.setDate(prox.getDate() + 1);
        labelsDias.push(`${d.getDate()}/${d.getMonth()+1}`);
        cadastrosPorDia.push(usuarios.filter(u => u.createdAt >= d && u.createdAt < prox).length);
    }

    // Gráfico: checkins por dia da semana
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const checkinsPorDiaSemana = diasSemana.map((_, d) => checkins.filter(c => c.diaSemana === d).length);

    // Tabelas
    const ultimosCadastros = [...usuarios].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const ticketsUrgentes  = tickets.filter(t => t.status === 'aberto' && (Date.now() - t.createdAt) > 86_400_000).slice(0, 5);

    res.render('pages/admin-dashboard', adminLocals({
        title: 'Dashboard',
        page: 'dashboard',
        totalUsuarios, ativosHoje,
        receitaMes: receitaMes.toFixed(2),
        ticketsAbertosN,
        labelsDias: JSON.stringify(labelsDias),
        cadastrosPorDia: JSON.stringify(cadastrosPorDia),
        diasSemana: JSON.stringify(diasSemana),
        checkinsPorDiaSemana: JSON.stringify(checkinsPorDiaSemana),
        ultimosCadastros,
        ticketsUrgentes,
        admin: req.session.admin,
    }));
});

// ── USUÁRIOS ──────────────────────────────────────────────────────────────────
router.get('/usuarios', (req, res) => {
    const { busca = '', plano = '', status = '', page = 1 } = req.query;
    const perPage = 15;

    let lista = [...usuarios];
    if (busca)  lista = lista.filter(u => u.nome.toLowerCase().includes(busca.toLowerCase()) || u.cpf.includes(busca));
    if (plano)  lista = lista.filter(u => u.plano === plano);
    if (status) lista = lista.filter(u => u.status === status);
    lista.sort((a, b) => b.createdAt - a.createdAt);

    const total  = lista.length;
    const pages  = Math.ceil(total / perPage);
    const offset = (parseInt(page) - 1) * perPage;
    const items  = lista.slice(offset, offset + perPage);

    res.render('pages/admin-usuarios', adminLocals({
        title: 'Usuários', page: 'usuarios', admin: req.session.admin,
        items, total, pages, currentPage: parseInt(page),
        busca, plano, status, planos,
    }));
});

// ── PERFIL DO USUÁRIO ─────────────────────────────────────────────────────────
router.get('/usuarios/:id', (req, res) => {
    const user = usuarios.find(u => u.id === req.params.id);
    if (!user) return res.redirect('/admin/usuarios');

    const userCheckins  = checkins.filter(c => c.userId === user.id).slice(0, 20);
    const userTickets   = tickets.filter(t => t.userId === user.id);
    const userTransacoes = transacoes.filter(t => t.userId === user.id);

    res.render('pages/admin-usuario-perfil', adminLocals({
        title: `Perfil — ${user.nome}`, page: 'usuarios', admin: req.session.admin,
        user, userCheckins, userTickets, userTransacoes, academias,
    }));
});

// ── ACADEMIAS ─────────────────────────────────────────────────────────────────
router.get('/academias', (req, res) => {
    res.render('pages/admin-academias', adminLocals({
        title: 'Academias', page: 'academias', admin: req.session.admin,
        academias,
    }));
});

// ── PLANOS ───────────────────────────────────────────────────────────────────
router.get('/planos', (req, res) => {
    const planosComCount = planos.map(p => ({
        ...p,
        totalAssinantes: usuarios.filter(u => u.planoId === p.id).length,
    }));
    res.render('pages/admin-planos', adminLocals({
        title: 'Planos', page: 'planos', admin: req.session.admin,
        planos: planosComCount,
    }));
});

// ── CHECK-INS ────────────────────────────────────────────────────────────────
router.get('/checkins', (req, res) => {
    const { academia = '', page = 1 } = req.query;
    const perPage = 20;
    let lista = [...checkins];
    if (academia) lista = lista.filter(c => c.academiaId === academia);

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const checkinsHoje = checkins.filter(c => c.data >= hoje).length;

    const total  = lista.length;
    const pages  = Math.ceil(total / perPage);
    const offset = (parseInt(page) - 1) * perPage;
    const items  = lista.slice(offset, offset + perPage);

    // Heatmap: checkins por hora × dia da semana
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const heatmap = diasSemana.map((_, d) => checkins.filter(c => c.diaSemana === d).length);

    res.render('pages/admin-checkins', adminLocals({
        title: 'Check-ins', page: 'checkins', admin: req.session.admin,
        items, total, pages, currentPage: parseInt(page),
        academia, academias, checkinsHoje,
        heatmap: JSON.stringify(heatmap),
        diasSemana: JSON.stringify(diasSemana),
    }));
});

// ── FINANCEIRO ───────────────────────────────────────────────────────────────
router.get('/financeiro', (req, res) => {
    const now = new Date();
    const mesAtual = now.getMonth();
    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;

    const receitaMes = transacoes.filter(t => t.status === 'pago' && t.data.getMonth() === mesAtual).reduce((s, t) => s + t.valor, 0);
    const receitaAnterior = transacoes.filter(t => t.status === 'pago' && t.data.getMonth() === mesAnterior).reduce((s, t) => s + t.valor, 0);

    // Receita por plano
    const receitaPorPlano = planos.map(p => ({
        nome: p.nome,
        valor: transacoes.filter(t => t.planoId === p.id && t.status === 'pago').reduce((s, t) => s + t.valor, 0),
        count: usuarios.filter(u => u.planoId === p.id).length,
    }));

    // Gráfico: receita mensal 12 meses
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const receitaMensal = meses.map((_, m) => transacoes.filter(t => t.status === 'pago' && t.data.getMonth() === m).reduce((s, t) => s + t.valor, 0).toFixed(2));

    const inadimplentes = transacoes.filter(t => t.status === 'pendente').length;

    res.render('pages/admin-financeiro', adminLocals({
        title: 'Financeiro', page: 'financeiro', admin: req.session.admin,
        receitaMes: receitaMes.toFixed(2),
        receitaAnterior: receitaAnterior.toFixed(2),
        variacao: receitaAnterior > 0 ? (((receitaMes - receitaAnterior) / receitaAnterior) * 100).toFixed(1) : 0,
        receitaPorPlano,
        inadimplentes,
        meses: JSON.stringify(meses),
        receitaMensal: JSON.stringify(receitaMensal),
    }));
});

router.get('/financeiro/receitas', (req, res) => {
    const { status = '', page = 1 } = req.query;
    const perPage = 20;
    let lista = [...transacoes].sort((a, b) => b.data - a.data);
    if (status) lista = lista.filter(t => t.status === status);

    const total  = lista.length;
    const pages  = Math.ceil(total / perPage);
    const offset = (parseInt(page) - 1) * perPage;
    const items  = lista.slice(offset, offset + perPage);

    res.render('pages/admin-financeiro-receitas', adminLocals({
        title: 'Receitas', page: 'financeiro', admin: req.session.admin,
        items, total, pages, currentPage: parseInt(page), status,
    }));
});

router.get('/financeiro/inadimplentes', (req, res) => {
    const lista = transacoes
        .filter(t => t.status === 'pendente')
        .map(t => ({ ...t, user: usuarios.find(u => u.id === t.userId) }))
        .sort((a, b) => b.diasAtraso - a.diasAtraso);

    res.render('pages/admin-financeiro-inadimplentes', adminLocals({
        title: 'Inadimplentes', page: 'financeiro', admin: req.session.admin,
        lista,
    }));
});

// ── SUPORTE ───────────────────────────────────────────────────────────────────
router.get('/suporte', (req, res) => {
    const { status = '' } = req.query;
    let lista = [...tickets].sort((a, b) => a.createdAt - b.createdAt);
    if (status) lista = lista.filter(t => t.status === status);

    res.render('pages/admin-suporte', adminLocals({
        title: 'Suporte', page: 'suporte', admin: req.session.admin,
        lista, status,
    }));
});

router.get('/suporte/:ticketId', (req, res) => {
    const ticket = tickets.find(t => t.id === req.params.ticketId);
    if (!ticket) return res.redirect('/admin/suporte');

    const msgs  = mensagens.filter(m => m.ticketId === ticket.id).sort((a, b) => a.criadaEm - b.criadaEm);
    const user  = usuarios.find(u => u.id === ticket.userId);

    res.render('pages/admin-suporte-chat', adminLocals({
        title: `Ticket #${ticket.id}`, page: 'suporte', admin: req.session.admin,
        ticket, msgs, user,
    }));
});

// ── NOTIFICAÇÕES ─────────────────────────────────────────────────────────────
router.get('/notificacoes', (req, res) => {
    const lista = [...notificacoes].sort((a, b) => b.criadaEm - a.criadaEm);
    res.render('pages/admin-notificacoes', adminLocals({
        title: 'Notificações', page: 'notificacoes', admin: req.session.admin,
        lista, planos,
    }));
});

// ── RELATÓRIOS ────────────────────────────────────────────────────────────────
router.get('/relatorios', (req, res) => {
    // Crescimento: usuários novos por mês (últimos 6 meses)
    const meses = [];
    const crescimento = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        meses.push(d.toLocaleString('pt-BR', { month: 'short' }));
        crescimento.push(usuarios.filter(u => u.createdAt.getMonth() === d.getMonth() && u.createdAt.getFullYear() === d.getFullYear()).length);
    }

    // Distribuição por plano
    const distPlano = planos.map(p => ({
        nome: p.nome,
        count: usuarios.filter(u => u.planoId === p.id).length,
    }));

    // Academias mais ativas (por checkins)
    const acadAtivas = academias.map(a => ({
        nome: a.nome,
        count: checkins.filter(c => c.academiaId === a.id).length,
    })).sort((a, b) => b.count - a.count).slice(0, 6);

    res.render('pages/admin-relatorios', adminLocals({
        title: 'Relatórios', page: 'relatorios', admin: req.session.admin,
        meses: JSON.stringify(meses),
        crescimento: JSON.stringify(crescimento),
        distPlano: JSON.stringify(distPlano),
        acadAtivas: JSON.stringify(acadAtivas),
    }));
});

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
router.get('/configuracoes', (req, res) => {
    res.render('pages/admin-configuracoes', adminLocals({
        title: 'Configurações', page: 'configuracoes', admin: req.session.admin,
        adminConfig,
    }));
});

module.exports = router;
