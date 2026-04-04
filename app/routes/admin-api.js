/**
 * admin-api.js — API REST + SSE do painel administrativo GymBros
 */
'use strict';

const express   = require('express');
const router    = express.Router();
const { usuarios, academias, planos, checkins, transacoes, tickets, mensagens, notificacoes, adminConfig, onlineUsers, nextId } = require('../data');
const { addAdminClient, broadcast, broadcastTicket, broadcastToStudents } = require('../events');

// Protege toda a API admin
router.use((req, res, next) => {
    if (req.session && req.session.admin) return next();
    return res.status(401).json({ erro: 'Não autorizado.' });
});

// ── SSE Stream (tempo real) ───────────────────────────────────────────────────
router.get('/stream', (req, res) => {
    res.set({
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(':ok\n\n');
    addAdminClient(res);

    // Envia usuários online imediatamente
    const now = Date.now();
    const online = [...onlineUsers.entries()]
        .filter(([, u]) => now - u.lastSeen < 5 * 60 * 1000)
        .map(([id, u]) => ({ id, ...u }));
    res.write(`event: online_users\ndata: ${JSON.stringify(online)}\n\n`);

    // Ping a cada 20s para manter a conexão viva
    const ping = setInterval(() => {
        try { res.write(':ping\n\n'); } catch (_) { clearInterval(ping); }
    }, 20000);
    res.on('close', () => clearInterval(ping));
});

// ── KPIs ──────────────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const mes = new Date().getMonth();
    const ano = new Date().getFullYear();
    const now = Date.now();
    const onlineCount = [...onlineUsers.values()].filter(u => now - u.lastSeen < 5 * 60 * 1000).length;
    res.json({
        totalUsuarios:  usuarios.length,
        ativosHoje:     checkins.filter(c => c.data >= hoje).length,
        receitaMes:     transacoes.filter(t => t.status === 'pago' && t.data.getMonth() === mes && t.data.getFullYear() === ano).reduce((s, t) => s + t.valor, 0).toFixed(2),
        ticketsAbertos: tickets.filter(t => t.status !== 'resolvido').length,
        onlineNow:      onlineCount,
    });
});

// ── Usuários online ───────────────────────────────────────────────────────────
router.get('/online', (req, res) => {
    const now = Date.now();
    const online = [...onlineUsers.entries()]
        .filter(([, u]) => now - u.lastSeen < 5 * 60 * 1000)
        .map(([id, u]) => ({ id, ...u }))
        .sort((a, b) => b.lastSeen - a.lastSeen);
    res.json(online);
});

// ── USUÁRIOS ──────────────────────────────────────────────────────────────────
router.get('/usuarios', (req, res) => {
    const { busca = '', plano = '', status = '', page = 1, per = 15 } = req.query;
    let lista = [...usuarios];
    if (busca)  lista = lista.filter(u => u.nome.toLowerCase().includes(busca.toLowerCase()) || u.cpf.includes(busca));
    if (plano)  lista = lista.filter(u => u.plano === plano);
    if (status) lista = lista.filter(u => u.status === status);
    lista.sort((a, b) => b.createdAt - a.createdAt);
    const total  = lista.length;
    const offset = (parseInt(page) - 1) * parseInt(per);
    res.json({ total, items: lista.slice(offset, offset + parseInt(per)) });
});

router.get('/usuarios/:id', (req, res) => {
    const user = usuarios.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.json({ user, checkins: checkins.filter(c => c.userId === user.id).slice(0, 30), tickets: tickets.filter(t => t.userId === user.id), transacoes: transacoes.filter(t => t.userId === user.id) });
});

router.put('/usuarios/:id', (req, res) => {
    const idx = usuarios.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const { nome, email, plano, planoId } = req.body;
    if (nome)    usuarios[idx].nome    = nome;
    if (email)   usuarios[idx].email   = email;
    if (plano)   usuarios[idx].plano   = plano;
    if (planoId) usuarios[idx].planoId = planoId;
    res.json({ mensagem: 'Usuário atualizado.', user: usuarios[idx] });
});

router.post('/usuarios/:id/desativar', (req, res) => {
    const user = usuarios.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    user.status = user.status === 'ativo' ? 'inativo' : 'ativo';
    res.json({ mensagem: `Conta ${user.status}.`, status: user.status });
});

// ── ACADEMIAS ─────────────────────────────────────────────────────────────────
router.get('/academias', (req, res) => res.json(academias));

router.post('/academias', (req, res) => {
    const { nome, cnpj, endereco, cidade, cep, responsavel, telefone } = req.body;
    if (!nome || !cnpj) return res.status(400).json({ erro: 'Nome e CNPJ são obrigatórios.' });
    const nova = { id: nextId('ac'), nome, cnpj, endereco, cidade, cep, responsavel, telefone, status: 'ativa', totalAlunos: 0, createdAt: new Date() };
    academias.push(nova);
    res.status(201).json({ mensagem: 'Academia criada.', academia: nova });
});

router.put('/academias/:id', (req, res) => {
    const ac = academias.find(a => a.id === req.params.id);
    if (!ac) return res.status(404).json({ erro: 'Academia não encontrada.' });
    Object.assign(ac, req.body);
    res.json({ mensagem: 'Academia atualizada.', academia: ac });
});

router.post('/academias/:id/toggle', (req, res) => {
    const ac = academias.find(a => a.id === req.params.id);
    if (!ac) return res.status(404).json({ erro: 'Academia não encontrada.' });
    ac.status = ac.status === 'ativa' ? 'inativa' : 'ativa';
    res.json({ mensagem: `Academia ${ac.status}.`, status: ac.status });
});

// ── PLANOS ────────────────────────────────────────────────────────────────────
router.get('/planos', (req, res) => res.json(planos.map(p => ({ ...p, totalAssinantes: usuarios.filter(u => u.planoId === p.id).length }))));

router.post('/planos', (req, res) => {
    const { nome, descricao, preco, duracao, beneficios } = req.body;
    if (!nome || !preco) return res.status(400).json({ erro: 'Nome e preço são obrigatórios.' });
    const novo = { id: nextId('pl'), nome, descricao, preco: parseFloat(preco), duracao: duracao || 'mensal', beneficios: Array.isArray(beneficios) ? beneficios : [], status: 'ativo', createdAt: new Date() };
    planos.push(novo);
    res.status(201).json({ mensagem: 'Plano criado.', plano: novo });
});

router.put('/planos/:id', (req, res) => {
    const plano = planos.find(p => p.id === req.params.id);
    if (!plano) return res.status(404).json({ erro: 'Plano não encontrado.' });
    Object.assign(plano, req.body);
    if (req.body.preco) plano.preco = parseFloat(req.body.preco);
    res.json({ mensagem: 'Plano atualizado.', plano });
});

// ── CHECK-INS ────────────────────────────────────────────────────────────────
router.get('/checkins', (req, res) => {
    const { academia = '', page = 1, per = 20 } = req.query;
    let lista = [...checkins];
    if (academia) lista = lista.filter(c => c.academiaId === academia);
    const total  = lista.length;
    const offset = (parseInt(page) - 1) * parseInt(per);
    res.json({ total, items: lista.slice(offset, offset + parseInt(per)) });
});

// ── FINANCEIRO ────────────────────────────────────────────────────────────────
router.get('/financeiro', (req, res) => {
    const mes = new Date().getMonth();
    const ano = new Date().getFullYear();
    res.json({
        receitaMes:      transacoes.filter(t => t.status === 'pago' && t.data.getMonth() === mes && t.data.getFullYear() === ano).reduce((s, t) => s + t.valor, 0),
        totalTransacoes: transacoes.length,
        inadimplentes:   transacoes.filter(t => t.status === 'pendente').length,
    });
});

router.get('/financeiro/transacoes', (req, res) => {
    const { status = '', page = 1 } = req.query;
    let lista = [...transacoes].sort((a, b) => b.data - a.data);
    if (status) lista = lista.filter(t => t.status === status);
    const total  = lista.length;
    const offset = (parseInt(page) - 1) * 20;
    res.json({ total, items: lista.slice(offset, offset + 20) });
});

// ── SUPORTE (admin) ───────────────────────────────────────────────────────────
router.get('/suporte/tickets', (req, res) => {
    const { status = '' } = req.query;
    let lista = [...tickets].sort((a, b) => b.createdAt - a.createdAt);
    if (status) lista = lista.filter(t => t.status === status);
    res.json(lista);
});

router.get('/suporte/tickets/:id', (req, res) => {
    const ticket = tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado.' });
    res.json({ ticket, mensagens: mensagens.filter(m => m.ticketId === ticket.id).sort((a, b) => a.criadaEm - b.criadaEm) });
});

router.post('/suporte/tickets/:id/mensagem', (req, res) => {
    const ticket = tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado.' });
    const { texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ erro: 'Mensagem vazia.' });
    const msg = { id: nextId('ms'), ticketId: ticket.id, remetente: 'admin', texto: texto.trim(), criadaEm: new Date(), lida: false };
    mensagens.push(msg);
    ticket.updatedAt = new Date();
    if (ticket.status === 'aberto') ticket.status = 'em_atendimento';
    // Notifica o aluno via SSE do ticket
    broadcastTicket(ticket.id, 'new_message', { ...msg, criadaEm: msg.criadaEm.toISOString() });
    res.status(201).json({ ...msg, criadaEm: msg.criadaEm.toISOString() });
});

router.put('/suporte/tickets/:id/status', (req, res) => {
    const ticket = tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado.' });
    const { status } = req.body;
    if (!['aberto','em_atendimento','resolvido'].includes(status)) return res.status(400).json({ erro: 'Status inválido.' });
    ticket.status = status;
    ticket.updatedAt = new Date();
    broadcastTicket(ticket.id, 'status_change', { ticketId: ticket.id, status });
    broadcast('ticket_update', { ticketId: ticket.id, status, assunto: ticket.assunto });
    res.json({ mensagem: 'Status atualizado.', ticket });
});

// ── NOTIFICAÇÕES ─────────────────────────────────────────────────────────────
router.post('/notificacoes', (req, res) => {
    const { titulo, mensagem: msg, tipo, destinatarios } = req.body;
    if (!titulo || !msg) return res.status(400).json({ erro: 'Título e mensagem são obrigatórios.' });
    const nova = { id: nextId('no'), titulo, mensagem: msg, tipo: tipo || 'informativo', destinatarios: destinatarios || 'todos', criadaEm: new Date(), lidas: [] };
    notificacoes.push(nova);
    broadcast('admin_notification', { titulo, mensagem: msg, tipo: nova.tipo });
    broadcastToStudents('admin_notification', { titulo, mensagem: msg, tipo: nova.tipo });
    res.status(201).json({ mensagem: 'Notificação enviada.', notificacao: nova });
});

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
router.put('/configuracoes', (req, res) => {
    const { siteName, maintenance, notifThresholdHours } = req.body;
    if (siteName !== undefined)            adminConfig.siteName = siteName;
    if (maintenance !== undefined)         adminConfig.maintenance = !!maintenance;
    if (notifThresholdHours !== undefined) adminConfig.notifThresholdHours = parseInt(notifThresholdHours);
    res.json({ mensagem: 'Configurações salvas.', adminConfig });
});

router.post('/configuracoes/senha', (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (senhaAtual !== adminPassword) return res.status(400).json({ erro: 'Senha atual incorreta.' });
    res.json({ mensagem: 'Senha alterada com sucesso.' });
});

module.exports = router;
