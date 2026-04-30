/**
 * suporte.js — API de suporte do lado do cliente (aluno)
 */
'use strict';

const express  = require('express');
const router   = express.Router();
const db       = require('../config/db');
const { body, validationResult } = require('express-validator');
const SupportTicket = require('../models/SupportTicket');
const Notification  = require('../models/Notification');
const { broadcast, broadcastTicket, addTicketClient, addStudentClient, registerUserSSE, unregisterUserSSE } = require('../events');

// Middleware: exige sessão de aluno
router.use((req, res, next) => {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ erro: 'Não autorizado.' });
});

// ── Abrir chamado ─────────────────────────────────────────────────────────────
router.post('/tickets',
  [
    body('assunto').trim().notEmpty().withMessage('Assunto obrigatório.').isLength({ max: 200 }).withMessage('Assunto muito longo.'),
    body('tipo').notEmpty().withMessage('Tipo obrigatório.'),
    body('descricao').trim().notEmpty().withMessage('Descrição obrigatória.').isLength({ min: 10 }).withMessage('Descrição muito curta (mín. 10 caracteres).'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ erros: errors.array() });

    const { assunto, tipo, descricao } = req.body;
    const user = req.session.user;

    try {
        const ticketId = await SupportTicket.create({ userId: user.id, assunto, tipo, descricao });

        broadcast('new_ticket', {
            ticketId,
            userName: user.nome,
            assunto,
            tipo,
            status: 'aberto',
            createdAt: new Date().toISOString(),
        });

        res.status(201).json({ mensagem: 'Chamado aberto com sucesso!', ticketId });
    } catch (err) {
        console.error('[suporte/tickets POST]', err);
        res.status(500).json({ erro: 'Erro ao abrir chamado.' });
    }
});

// ── Listar tickets do usuário ─────────────────────────────────────────────────
router.get('/tickets', async (req, res) => {
    try {
        res.json(await SupportTicket.findByUser(req.session.user.id));
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar tickets.' });
    }
});

// ── Mensagens de um ticket ────────────────────────────────────────────────────
router.get('/tickets/:id', async (req, res) => {
    const userId = req.session.user.id;
    try {
        const [[ticket]] = await db.execute(
            'SELECT * FROM support_ticket WHERE id = ? AND user_id = ?',
            [req.params.id, userId]
        );
        if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado.' });

        const [msgs] = await db.execute(
            'SELECT * FROM support_message WHERE ticket_id = ? ORDER BY created_at ASC',
            [ticket.id]
        );
        res.json({ ticket, mensagens: msgs });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar ticket.' });
    }
});

// ── Usuário responde ──────────────────────────────────────────────────────────
router.post('/tickets/:id/mensagem', async (req, res) => {
    const userId = req.session.user.id;
    const { texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ erro: 'Mensagem vazia.' });

    try {
        const [[ticket]] = await db.execute(
            'SELECT * FROM support_ticket WHERE id = ? AND user_id = ?',
            [req.params.id, userId]
        );
        if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado.' });
        if (ticket.status === 'resolvido') return res.status(400).json({ erro: 'Ticket já resolvido.' });

        const [result] = await db.execute(
            'INSERT INTO support_message (ticket_id, remetente, texto) VALUES (?, "usuario", ?)',
            [ticket.id, texto.trim()]
        );
        await db.execute('UPDATE support_ticket SET updated_at=NOW() WHERE id=?', [ticket.id]);

        const [[msg]] = await db.execute('SELECT * FROM support_message WHERE id=?', [result.insertId]);
        broadcastTicket(ticket.id, 'new_message', msg);
        broadcast('ticket_message', { ticketId: ticket.id, userName: req.session.user.nome, assunto: ticket.assunto, texto: texto.trim() });

        res.status(201).json(msg);
    } catch (err) {
        console.error('[suporte/tickets/:id/mensagem]', err);
        res.status(500).json({ erro: 'Erro ao enviar mensagem.' });
    }
});

// ── SSE: atualizações em tempo real de um ticket ──────────────────────────────
router.get('/tickets/:id/stream', async (req, res) => {
    const userId = req.session.user.id;
    try {
        const [[ticket]] = await db.execute(
            'SELECT id FROM support_ticket WHERE id = ? AND user_id = ?',
            [req.params.id, userId]
        );
        if (!ticket) return res.status(404).end();

        res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        res.write(':ok\n\n');
        addTicketClient(ticket.id, res);
        const ping = setInterval(() => { try { res.write(':ping\n\n'); } catch (_) { clearInterval(ping); } }, 20000);
        res.on('close', () => clearInterval(ping));
    } catch {
        res.status(500).end();
    }
});

// ── SSE: notificações push do admin ──────────────────────────────────────────
router.get('/notificacoes/stream', (req, res) => {
    const userId = req.session.user.id;
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    res.write(':ok\n\n');
    addStudentClient(res);
    registerUserSSE(userId, res);
    const ping = setInterval(() => { try { res.write(':ping\n\n'); } catch (_) { clearInterval(ping); } }, 20000);
    res.on('close', () => { clearInterval(ping); unregisterUserSSE(userId); });
});

// ── Notificações do usuário ───────────────────────────────────────────────────
router.get('/notificacoes', async (req, res) => {
    const { id: userId, planoId } = req.session.user;
    try {
        res.json(await Notification.findForUser(userId, planoId));
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar notificações.' });
    }
});

router.put('/notificacoes/:id/lida', async (req, res) => {
    const userId = req.session.user.id;
    try {
        await db.execute(
            'INSERT IGNORE INTO notification_read (notification_id, user_id) VALUES (?, ?)',
            [req.params.id, userId]
        );
        res.json({ mensagem: 'Marcada como lida.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao marcar notificação.' });
    }
});

module.exports = router;
