/**
 * admin-api.js — API REST + SSE do painel administrativo GymBros
 */
'use strict';

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const db      = require('../config/db');
const { addAdminClient, broadcast, broadcastTicket, broadcastToStudents, emitToUser, emitToUsers, emitToPlan, onlineUsers } = require('../events');

// ── Auditoria: registra ações sensíveis ───────────────────────────────────────
async function logAdmin(adminId, acao, entidade, entidadeId, detalhes, ip) {
    await db.execute(
        'INSERT INTO admin_log (admin_id, acao, entidade, entidade_id, detalhes, ip) VALUES (?, ?, ?, ?, ?, ?)',
        [adminId, acao, entidade, entidadeId, JSON.stringify(detalhes), ip]
    ).catch(() => {});
}

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
router.get('/stats', async (req, res) => {
    try {
        const [[{ totalUsuarios }]] = await db.execute('SELECT COUNT(*) AS totalUsuarios FROM user');
        const [[{ ativosHoje }]]    = await db.execute("SELECT COUNT(*) AS ativosHoje FROM checkin WHERE DATE(data) = CURDATE()");
        const [[{ receitaMes }]]    = await db.execute("SELECT COALESCE(SUM(valor_final),0) AS receitaMes FROM payment WHERE MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW()) AND status='pago'");
        const [[{ ticketsAbertos }]]= await db.execute("SELECT COUNT(*) AS ticketsAbertos FROM support_ticket WHERE status != 'resolvido'");
        const now = Date.now();
        const onlineNow = [...onlineUsers.values()].filter(u => now - u.lastSeen < 5 * 60 * 1000).length;
        res.json({
            totalUsuarios: Number(totalUsuarios),
            ativosHoje:    Number(ativosHoje),
            receitaMes:    Number(receitaMes).toFixed(2),
            ticketsAbertos:Number(ticketsAbertos),
            onlineNow,
        });
    } catch (err) {
        console.error('[admin-api/stats]', err);
        res.status(500).json({ erro: 'Erro ao buscar KPIs.' });
    }
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
router.get('/usuarios', async (req, res) => {
    const { busca = '', plano = '', status = '', page = 1, per = 15 } = req.query;
    const perN = parseInt(per), offset = (parseInt(page) - 1) * perN;
    const params = [];
    let where = 'WHERE 1=1';
    if (busca)  { where += ' AND (u.nome LIKE ? OR u.cpf LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`); }
    if (plano)  { where += ' AND p.slug = ?'; params.push(plano); }
    if (status) { where += ' AND u.status = ?'; params.push(status); }
    try {
        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM user u LEFT JOIN user_plan up ON up.user_id=u.id AND up.status='ativo' LEFT JOIN plan p ON p.id=up.plan_id ${where}`,
            params
        );
        const [items] = await db.execute(
            `SELECT u.id, u.nome, u.email, u.cpf, u.status, u.created_at AS createdAt, p.nome AS plano, p.slug AS planoSlug
             FROM user u
             LEFT JOIN user_plan up ON up.user_id=u.id AND up.status='ativo'
             LEFT JOIN plan p ON p.id=up.plan_id
             ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
            [...params, perN, offset]
        );
        res.json({ total: Number(total), items });
    } catch (err) {
        console.error('[admin-api/usuarios]', err);
        res.status(500).json({ erro: 'Erro ao buscar usuários.' });
    }
});

router.get('/usuarios/:id', async (req, res) => {
    try {
        const [[user]] = await db.execute('SELECT * FROM user WHERE id = ?', [req.params.id]);
        if (!user) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        const [userCheckins]   = await db.execute('SELECT c.*, g.nome AS academiaNome FROM checkin c LEFT JOIN gym g ON g.id=c.gym_id WHERE c.user_id=? ORDER BY c.data DESC LIMIT 30', [user.id]);
        const [userTickets]    = await db.execute('SELECT * FROM support_ticket WHERE user_id=?', [user.id]);
        const [userTransacoes] = await db.execute('SELECT py.*, p.nome AS planoNome FROM payment py LEFT JOIN plan p ON p.id=py.plan_id WHERE py.user_id=? ORDER BY py.created_at DESC', [user.id]);
        res.json({ user, checkins: userCheckins, tickets: userTickets, transacoes: userTransacoes });
    } catch (err) {
        console.error('[admin-api/usuarios/:id]', err);
        res.status(500).json({ erro: 'Erro ao buscar usuário.' });
    }
});

router.put('/usuarios/:id', async (req, res) => {
    const { nome, email, status } = req.body;
    try {
        const [[user]] = await db.execute('SELECT id FROM user WHERE id = ?', [req.params.id]);
        if (!user) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        const sets = [], vals = [];
        if (nome)   { sets.push('nome=?');   vals.push(nome); }
        if (email)  { sets.push('email=?');  vals.push(email); }
        if (status) { sets.push('status=?'); vals.push(status); }
        if (sets.length > 0) await db.execute(`UPDATE user SET ${sets.join(',')} WHERE id=?`, [...vals, req.params.id]);
        const [[updated]] = await db.execute('SELECT * FROM user WHERE id=?', [req.params.id]);
        await logAdmin(req.session.admin.id, 'editar_usuario', 'user', req.params.id, req.body, req.ip);
        res.json({ mensagem: 'Usuário atualizado.', user: updated });
    } catch (err) {
        console.error('[admin-api/usuarios/:id PUT]', err);
        res.status(500).json({ erro: 'Erro ao atualizar usuário.' });
    }
});

router.post('/usuarios/:id/desativar', async (req, res) => {
    try {
        const [[user]] = await db.execute('SELECT id, status FROM user WHERE id = ?', [req.params.id]);
        if (!user) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        const novoStatus = user.status === 'ativo' ? 'inativo' : 'ativo';
        await db.execute('UPDATE user SET status=? WHERE id=?', [novoStatus, req.params.id]);
        await logAdmin(req.session.admin.id, 'alterar_status', 'user', req.params.id, { status: novoStatus }, req.ip);
        res.json({ mensagem: `Conta ${novoStatus}.`, status: novoStatus });
    } catch (err) {
        console.error('[admin-api/usuarios/:id/desativar]', err);
        res.status(500).json({ erro: 'Erro ao alterar status.' });
    }
});

// ── ACADEMIAS ─────────────────────────────────────────────────────────────────
router.get('/academias', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM gym ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar academias.' });
    }
});

router.post('/academias', async (req, res) => {
    const { nome, endereco, numero, bairro, cidade, estado, cep, telefone, email, whatsapp, latitude, longitude } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
    try {
        const [result] = await db.execute(
            `INSERT INTO gym (nome, endereco, numero, bairro, cidade, estado, cep, telefone, email, whatsapp, latitude, longitude)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nome, endereco||null, numero||null, bairro||null, cidade||null, estado||null, cep||null, telefone||null, email||null, whatsapp||null, latitude||null, longitude||null]
        );
        const [[nova]] = await db.execute('SELECT * FROM gym WHERE id=?', [result.insertId]);
        await logAdmin(req.session.admin.id, 'criar_academia', 'gym', result.insertId, { nome }, req.ip);
        res.status(201).json({ mensagem: 'Academia criada.', academia: nova });
    } catch (err) {
        console.error('[admin-api/academias POST]', err);
        res.status(500).json({ erro: 'Erro ao criar academia.' });
    }
});

router.put('/academias/:id', async (req, res) => {
    try {
        const [[ac]] = await db.execute('SELECT id FROM gym WHERE id=?', [req.params.id]);
        if (!ac) return res.status(404).json({ erro: 'Academia não encontrada.' });
        const allowed = ['nome','endereco','numero','bairro','cidade','estado','cep','telefone','email','whatsapp','latitude','longitude','status'];
        const sets = [], vals = [];
        for (const key of allowed) {
            if (req.body[key] !== undefined) { sets.push(`${key}=?`); vals.push(req.body[key]); }
        }
        if (sets.length > 0) await db.execute(`UPDATE gym SET ${sets.join(',')} WHERE id=?`, [...vals, req.params.id]);
        const [[updated]] = await db.execute('SELECT * FROM gym WHERE id=?', [req.params.id]);
        res.json({ mensagem: 'Academia atualizada.', academia: updated });
    } catch (err) {
        console.error('[admin-api/academias/:id PUT]', err);
        res.status(500).json({ erro: 'Erro ao atualizar academia.' });
    }
});

router.post('/academias/:id/toggle', async (req, res) => {
    try {
        const [[ac]] = await db.execute('SELECT id, status FROM gym WHERE id=?', [req.params.id]);
        if (!ac) return res.status(404).json({ erro: 'Academia não encontrada.' });
        const novoStatus = ac.status === 'ativa' ? 'inativa' : 'ativa';
        await db.execute('UPDATE gym SET status=? WHERE id=?', [novoStatus, req.params.id]);
        res.json({ mensagem: `Academia ${novoStatus}.`, status: novoStatus });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao alterar status da academia.' });
    }
});

// ── PLANOS ────────────────────────────────────────────────────────────────────
router.get('/planos', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT p.*, COUNT(up.id) AS totalAssinantes
             FROM plan p
             LEFT JOIN user_plan up ON up.plan_id=p.id AND up.status='ativo'
             GROUP BY p.id ORDER BY p.preco ASC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar planos.' });
    }
});

router.post('/planos', async (req, res) => {
    const { slug, nome, descricao, preco, duracao_dias, beneficios, permite_ia, permite_avaliacao_corporal, ordem } = req.body;
    if (!nome || !preco) return res.status(400).json({ erro: 'Nome e preço são obrigatórios.' });
    try {
        const [result] = await db.execute(
            `INSERT INTO plan (slug, nome, descricao, preco, duracao_dias, beneficios, permite_ia, permite_avaliacao_corporal, ordem)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [slug || nome.toLowerCase().replace(/\s+/g,'-'), nome, descricao||null, parseFloat(preco),
             duracao_dias||30, JSON.stringify(Array.isArray(beneficios) ? beneficios : []),
             permite_ia ? 1 : 0, permite_avaliacao_corporal ? 1 : 0, ordem||0]
        );
        const [[novo]] = await db.execute('SELECT * FROM plan WHERE id=?', [result.insertId]);
        await logAdmin(req.session.admin.id, 'criar_plano', 'plan', result.insertId, { nome }, req.ip);
        res.status(201).json({ mensagem: 'Plano criado.', plano: novo });
    } catch (err) {
        console.error('[admin-api/planos POST]', err);
        res.status(500).json({ erro: 'Erro ao criar plano.' });
    }
});

router.put('/planos/:id', async (req, res) => {
    try {
        const [[plan]] = await db.execute('SELECT id FROM plan WHERE id=?', [req.params.id]);
        if (!plan) return res.status(404).json({ erro: 'Plano não encontrado.' });
        const { nome, descricao, preco, beneficios, status } = req.body;
        const sets = [], vals = [];
        if (nome)      { sets.push('nome=?');      vals.push(nome); }
        if (descricao !== undefined) { sets.push('descricao=?'); vals.push(descricao); }
        if (preco)     { sets.push('preco=?');     vals.push(parseFloat(preco)); }
        if (beneficios){ sets.push('beneficios=?');vals.push(JSON.stringify(Array.isArray(beneficios) ? beneficios : [])); }
        if (status)    { sets.push('status=?');    vals.push(status); }
        if (sets.length > 0) await db.execute(`UPDATE plan SET ${sets.join(',')} WHERE id=?`, [...vals, req.params.id]);
        const [[updated]] = await db.execute('SELECT * FROM plan WHERE id=?', [req.params.id]);
        await logAdmin(req.session.admin.id, 'editar_plano', 'plan', req.params.id, req.body, req.ip);
        res.json({ mensagem: 'Plano atualizado.', plano: updated });
    } catch (err) {
        console.error('[admin-api/planos/:id PUT]', err);
        res.status(500).json({ erro: 'Erro ao atualizar plano.' });
    }
});

// ── CHECK-INS ────────────────────────────────────────────────────────────────
router.get('/checkins', async (req, res) => {
    const { academia = '', page = 1, per = 20 } = req.query;
    const perN = parseInt(per), offset = (parseInt(page) - 1) * perN;
    const params = [];
    let where = 'WHERE 1=1';
    if (academia) { where += ' AND c.gym_id = ?'; params.push(academia); }
    try {
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM checkin c ${where}`, params);
        const [items] = await db.execute(
            `SELECT c.*, u.nome AS userName, g.nome AS academiaNome
             FROM checkin c
             LEFT JOIN user u ON u.id=c.user_id
             LEFT JOIN gym g ON g.id=c.gym_id
             ${where} ORDER BY c.data DESC LIMIT ? OFFSET ?`,
            [...params, perN, offset]
        );
        res.json({ total: Number(total), items });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar check-ins.' });
    }
});

// ── FINANCEIRO ────────────────────────────────────────────────────────────────
router.get('/financeiro', async (req, res) => {
    try {
        const [[{ receitaMes }]]     = await db.execute("SELECT COALESCE(SUM(valor_final),0) AS receitaMes FROM payment WHERE MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW()) AND status='pago'");
        const [[{ totalTransacoes }]]= await db.execute('SELECT COUNT(*) AS totalTransacoes FROM payment');
        const [[{ inadimplentes }]]  = await db.execute("SELECT COUNT(*) AS inadimplentes FROM payment WHERE status='pendente'");
        res.json({
            receitaMes:      Number(receitaMes),
            totalTransacoes: Number(totalTransacoes),
            inadimplentes:   Number(inadimplentes),
        });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar financeiro.' });
    }
});

router.get('/financeiro/transacoes', async (req, res) => {
    const { status = '', page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * 20;
    const params = [];
    let where = 'WHERE 1=1';
    if (status) { where += ' AND py.status = ?'; params.push(status); }
    try {
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM payment py ${where}`, params);
        const [items] = await db.execute(
            `SELECT py.*, u.nome AS userName, u.email AS userEmail, p.nome AS planoNome
             FROM payment py
             LEFT JOIN user u ON u.id=py.user_id
             LEFT JOIN plan p ON p.id=py.plan_id
             ${where} ORDER BY py.created_at DESC LIMIT 20 OFFSET ?`,
            [...params, offset]
        );
        res.json({ total: Number(total), items });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar transações.' });
    }
});

// ── SUPORTE (admin) ───────────────────────────────────────────────────────────
router.get('/suporte/tickets', async (req, res) => {
    const { status = '' } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (status) { where += ' AND st.status = ?'; params.push(status); }
    try {
        const [lista] = await db.execute(
            `SELECT st.*, u.nome AS userName, u.email AS userEmail
             FROM support_ticket st
             LEFT JOIN user u ON u.id=st.user_id
             ${where} ORDER BY st.updated_at DESC`,
            params
        );
        res.json(lista);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar tickets.' });
    }
});

router.get('/suporte/tickets/:id', async (req, res) => {
    try {
        const [[ticket]] = await db.execute('SELECT * FROM support_ticket WHERE id = ?', [req.params.id]);
        if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado.' });
        const [mensagens] = await db.execute(
            'SELECT * FROM support_message WHERE ticket_id = ? ORDER BY created_at ASC',
            [ticket.id]
        );
        res.json({ ticket, mensagens });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar ticket.' });
    }
});

router.post('/suporte/tickets/:id/mensagem', async (req, res) => {
    const { texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ erro: 'Mensagem vazia.' });
    try {
        const [[ticket]] = await db.execute('SELECT * FROM support_ticket WHERE id = ?', [req.params.id]);
        if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado.' });

        const [result] = await db.execute(
            'INSERT INTO support_message (ticket_id, remetente, admin_id, texto) VALUES (?, "admin", ?, ?)',
            [ticket.id, req.session.admin.id, texto.trim()]
        );
        const novoStatus = ticket.status === 'aberto' ? 'em_atendimento' : ticket.status;
        await db.execute(
            'UPDATE support_ticket SET status=?, admin_id=?, updated_at=NOW() WHERE id=?',
            [novoStatus, req.session.admin.id, ticket.id]
        );

        const [[msg]] = await db.execute('SELECT * FROM support_message WHERE id=?', [result.insertId]);
        broadcastTicket(ticket.id, 'new_message', msg);
        emitToUser(ticket.user_id, 'new_message', { ticketId: ticket.id, texto: texto.trim() });
        res.status(201).json(msg);
    } catch (err) {
        console.error('[admin-api/suporte/tickets/:id/mensagem]', err);
        res.status(500).json({ erro: 'Erro ao enviar mensagem.' });
    }
});

router.put('/suporte/tickets/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!['aberto','em_atendimento','resolvido'].includes(status)) return res.status(400).json({ erro: 'Status inválido.' });
    try {
        const [[ticket]] = await db.execute('SELECT * FROM support_ticket WHERE id = ?', [req.params.id]);
        if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado.' });

        const resolvido_em = status === 'resolvido' ? new Date() : null;
        await db.execute(
            'UPDATE support_ticket SET status=?, resolvido_em=?, updated_at=NOW() WHERE id=?',
            [status, resolvido_em, ticket.id]
        );
        broadcastTicket(ticket.id, 'status_change', { ticketId: ticket.id, status });
        broadcast('ticket_update', { ticketId: ticket.id, status, assunto: ticket.assunto });
        emitToUser(ticket.user_id, 'status_change', { ticketId: ticket.id, status });
        res.json({ mensagem: 'Status atualizado.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar status.' });
    }
});

// ── NOTIFICAÇÕES ─────────────────────────────────────────────────────────────
router.post('/notificacoes', async (req, res) => {
    const { titulo, mensagem: msg, tipo, destinatarios, user_ids } = req.body;
    if (!titulo || !msg) return res.status(400).json({ erro: 'Título e mensagem são obrigatórios.' });
    try {
        const [result] = await db.execute(
            'INSERT INTO notification (titulo, mensagem, tipo, destinatarios, enviada_por) VALUES (?, ?, ?, ?, ?)',
            [titulo, msg, tipo || 'informativo', destinatarios || 'todos', req.session.admin.id]
        );

        // Emissão SSE conforme destinatários
        if (!destinatarios || destinatarios === 'todos') {
            broadcastToStudents('admin_notification', { titulo, mensagem: msg, tipo: tipo || 'informativo' });
        } else if (destinatarios === 'selecionados' && Array.isArray(user_ids) && user_ids.length) {
            emitToUsers(user_ids, 'admin_notification', { titulo, mensagem: msg, tipo: tipo || 'informativo' });
        } else {
            // destinatarios = plan_id numérico
            await emitToPlan(destinatarios, 'admin_notification', { titulo, mensagem: msg, tipo: tipo || 'informativo' });
        }
        broadcast('admin_notification', { titulo, mensagem: msg, tipo: tipo || 'informativo' });

        res.status(201).json({ mensagem: 'Notificação enviada.', id: result.insertId });
    } catch (err) {
        console.error('[admin-api/notificacoes]', err);
        res.status(500).json({ erro: 'Erro ao enviar notificação.' });
    }
});

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
router.put('/configuracoes', async (req, res) => {
    try {
        for (const [chave, valor] of Object.entries(req.body)) {
            await db.execute(
                'INSERT INTO app_config (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor=?',
                [chave, String(valor), String(valor)]
            );
        }
        res.json({ mensagem: 'Configurações salvas.' });
    } catch (err) {
        console.error('[admin-api/configuracoes PUT]', err);
        res.status(500).json({ erro: 'Erro ao salvar configurações.' });
    }
});

router.post('/configuracoes/senha', async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    try {
        const [[admin]] = await db.execute('SELECT senha_hash FROM admin_user WHERE id = ?', [req.session.admin.id]);
        if (!admin) return res.status(404).json({ erro: 'Admin não encontrado.' });
        const ok = await bcrypt.compare(senhaAtual, admin.senha_hash);
        if (!ok) return res.status(400).json({ erro: 'Senha atual incorreta.' });
        const nova_hash = await bcrypt.hash(novaSenha, 10);
        await db.execute('UPDATE admin_user SET senha_hash=? WHERE id=?', [nova_hash, req.session.admin.id]);
        res.json({ mensagem: 'Senha alterada com sucesso.' });
    } catch (err) {
        console.error('[admin-api/configuracoes/senha]', err);
        res.status(500).json({ erro: 'Erro ao alterar senha.' });
    }
});

module.exports = router;
