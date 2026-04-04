/**
 * suporte.js — API de suporte do lado do cliente (aluno)
 */
'use strict';

const express  = require('express');
const router   = express.Router();
const { tickets, mensagens, notificacoes, nextId } = require('../data');
const { broadcast, broadcastTicket, addTicketClient, addStudentClient } = require('../events');

// Middleware: exige sessão de aluno
router.use((req, res, next) => {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ erro: 'Não autorizado.' });
});

// ── Abrir chamado ─────────────────────────────────────────────────────────────
router.post('/tickets', (req, res) => {
    const { assunto, tipo, descricao } = req.body;
    const user = req.session.user;
    if (!assunto || !descricao?.trim()) return res.status(400).json({ erro: 'Assunto e descrição são obrigatórios.' });

    const tid = nextId('tk');
    const ticket = {
        id: tid,
        userId: user.id || user.cpf,
        userName: user.nome,
        userEmail: user.email,
        userPlano: user.plano || 'Starter',
        assunto,
        tipo: tipo || 'Outro',
        status: 'aberto',
        prioridade: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    tickets.push(ticket);
    mensagens.push({ id: nextId('ms'), ticketId: tid, remetente: 'usuario', texto: descricao.trim(), criadaEm: new Date() });

    // Notifica o admin em tempo real
    broadcast('new_ticket', { ticketId: tid, userName: user.nome, assunto, tipo: ticket.tipo, status: 'aberto', createdAt: ticket.createdAt.toISOString() });

    res.status(201).json({ mensagem: 'Chamado aberto com sucesso!', ticket });
});

// ── Listar tickets do usuário ─────────────────────────────────────────────────
router.get('/tickets', (req, res) => {
    const userId = req.session.user.id || req.session.user.cpf;
    const lista  = tickets.filter(t => t.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
    res.json(lista);
});

// ── Mensagens de um ticket ────────────────────────────────────────────────────
router.get('/tickets/:id', (req, res) => {
    const userId = req.session.user.id || req.session.user.cpf;
    const ticket = tickets.find(t => t.id === req.params.id && t.userId === userId);
    if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado.' });
    const msgs = mensagens.filter(m => m.ticketId === ticket.id).sort((a, b) => a.criadaEm - b.criadaEm);
    res.json({ ticket, mensagens: msgs });
});

// ── Usuário responde ──────────────────────────────────────────────────────────
router.post('/tickets/:id/mensagem', (req, res) => {
    const userId = req.session.user.id || req.session.user.cpf;
    const ticket = tickets.find(t => t.id === req.params.id && t.userId === userId);
    if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado.' });
    if (ticket.status === 'resolvido') return res.status(400).json({ erro: 'Ticket já resolvido.' });
    const { texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ erro: 'Mensagem vazia.' });
    const msg = { id: nextId('ms'), ticketId: ticket.id, remetente: 'usuario', texto: texto.trim(), criadaEm: new Date(), lida: false };
    mensagens.push(msg);
    ticket.updatedAt = new Date();
    const msgPayload = { ...msg, criadaEm: msg.criadaEm.toISOString() };
    // Notifica admin e outros clientes do ticket em tempo real
    broadcastTicket(ticket.id, 'new_message', msgPayload);
    broadcast('ticket_message', { ticketId: ticket.id, userName: ticket.userName, assunto: ticket.assunto, texto: texto.trim() });
    res.status(201).json(msgPayload);
});

// ── SSE: atualizações em tempo real de um ticket ──────────────────────────────
router.get('/tickets/:id/stream', (req, res) => {
    const userId = req.session.user.id || req.session.user.cpf;
    const ticket = tickets.find(t => t.id === req.params.id && t.userId === userId);
    if (!ticket) return res.status(404).end();
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    res.write(':ok\n\n');
    addTicketClient(ticket.id, res);
    const ping = setInterval(() => { try { res.write(':ping\n\n'); } catch (_) { clearInterval(ping); } }, 20000);
    res.on('close', () => clearInterval(ping));
});

// ── SSE: notificações push do admin ──────────────────────────────────────────
router.get('/notificacoes/stream', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    res.write(':ok\n\n');
    addStudentClient(res);
    const ping = setInterval(() => { try { res.write(':ping\n\n'); } catch (_) { clearInterval(ping); } }, 20000);
    res.on('close', () => clearInterval(ping));
});

// ── Notificações do usuário ───────────────────────────────────────────────────
router.get('/notificacoes', (req, res) => {
    const userId = req.session.user.id || req.session.user.cpf;
    const planoId = req.session.user.planoId;
    const lista = notificacoes.filter(n =>
        n.destinatarios === 'todos' || n.destinatarios === planoId
    ).sort((a, b) => b.criadaEm - a.criadaEm).slice(0, 20);
    res.json(lista.map(n => ({ ...n, lida: (n.lidas || []).includes(userId) })));
});

router.put('/notificacoes/:id/lida', (req, res) => {
    const userId = req.session.user.id || req.session.user.cpf;
    const notif  = notificacoes.find(n => n.id === req.params.id);
    if (!notif) return res.status(404).json({ erro: 'Notificação não encontrada.' });
    if (!notif.lidas.includes(userId)) notif.lidas.push(userId);
    res.json({ mensagem: 'Marcada como lida.' });
});

module.exports = router;
