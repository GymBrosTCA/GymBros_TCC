/**
 * suporte.js — API de suporte do lado do cliente (aluno)
 */
'use strict';

const express  = require('express');
const router   = express.Router();
const db       = require('../config/db');
const { broadcast, broadcastTicket, addTicketClient, addStudentClient, registerUserSSE, unregisterUserSSE } = require('../events');

// Middleware: exige sessão de aluno
router.use((req, res, next) => {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ erro: 'Não autorizado.' });
});

// ── Abrir chamado ─────────────────────────────────────────────────────────────
router.post('/tickets', async (req, res) => {
    const { assunto, tipo, descricao } = req.body;
    const user = req.session.user;
    if (!assunto || !descricao?.trim()) return res.status(400).json({ erro: 'Assunto e descrição são obrigatórios.' });

    try {
        const [result] = await db.execute(
            'INSERT INTO support_ticket (user_id, assunto, tipo, prioridade) VALUES (?, ?, ?, "normal")',
            [user.id, assunto, tipo || 'Outro']
        );
        const ticketId = result.insertId;

        await db.execute(
            'INSERT INTO support_message (ticket_id, remetente, texto) VALUES (?, "usuario", ?)',
            [ticketId, descricao.trim()]
        );

        broadcast('new_ticket', {
            ticketId,
            userName: user.nome,
            assunto,
            tipo: tipo || 'Outro',
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
    const userId = req.session.user.id;
    try {
        const [lista] = await db.execute(
            `SELECT st.*,
               (SELECT COUNT(*) FROM support_message sm
                WHERE sm.ticket_id=st.id AND sm.lida=0 AND sm.remetente='admin') AS nao_lidas
             FROM support_ticket st
             WHERE st.user_id = ?
             ORDER BY st.updated_at DESC`,
            [userId]
        );
        res.json(lista);
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
    const userId  = req.session.user.id;
    const planoId = req.session.user.planoId;
    try {
        const [lista] = await db.execute(
            `SELECT n.*,
               EXISTS(SELECT 1 FROM notification_read nr WHERE nr.notification_id=n.id AND nr.user_id=?) AS lida
             FROM notification n
             WHERE n.destinatarios = 'todos'
                OR n.destinatarios = ?
             ORDER BY n.created_at DESC
             LIMIT 20`,
            [userId, String(planoId)]
        );
        res.json(lista);
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
