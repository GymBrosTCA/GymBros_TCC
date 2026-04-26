'use strict';

const db = require('./config/db');

// ── SSE clients: admin panel ──────────────────────────────────────────────────
const adminClients = new Set();

function addAdminClient(res) {
    adminClients.add(res);
    res.on('close', () => adminClients.delete(res));
}

function broadcast(type, data) {
    if (adminClients.size === 0) return;
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of adminClients) {
        try { client.write(payload); }
        catch (_) { adminClients.delete(client); }
    }
}

// ── SSE clients: per-ticket (user & admin chat) ───────────────────────────────
const ticketClients = new Map(); // ticketId → Set<res>

function addTicketClient(ticketId, res) {
    if (!ticketClients.has(ticketId)) ticketClients.set(ticketId, new Set());
    ticketClients.get(ticketId).add(res);
    res.on('close', () => {
        const s = ticketClients.get(ticketId);
        if (s) { s.delete(res); if (!s.size) ticketClients.delete(ticketId); }
    });
}

function broadcastTicket(ticketId, type, data) {
    const clients = ticketClients.get(String(ticketId));
    if (!clients || !clients.size) return;
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
        try { client.write(payload); }
        catch (_) { clients.delete(client); }
    }
}

// ── SSE clients: student notifications ───────────────────────────────────────
const studentClients = new Set();

function addStudentClient(res) {
    studentClients.add(res);
    res.on('close', () => studentClients.delete(res));
}

function broadcastToStudents(type, data) {
    if (studentClients.size === 0) return;
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of studentClients) {
        try { client.write(payload); }
        catch (_) { studentClients.delete(client); }
    }
}

// ── SSE clients: per-user (notificações diretas) ──────────────────────────────
const userConnections = new Map(); // userId (string) → res

function registerUserSSE(userId, res) {
    userConnections.set(String(userId), res);
}

function unregisterUserSSE(userId) {
    userConnections.delete(String(userId));
}

function emitToUser(userId, event, data) {
    const res = userConnections.get(String(userId));
    if (res) res.write(`data: ${JSON.stringify({ event, ...data })}\n\n`);
}

function emitToUsers(userIds, event, data) {
    userIds.forEach(id => emitToUser(id, event, data));
}

async function emitToPlan(planId, event, data) {
    try {
        const [rows] = await db.execute(
            `SELECT u.id FROM user u
             JOIN user_plan up ON up.user_id = u.id AND up.status = 'ativo'
             WHERE up.plan_id = ?`,
            [planId]
        );
        rows.forEach(r => emitToUser(r.id, event, data));
    } catch (err) {
        console.error('[events] emitToPlan error:', err.message);
    }
}

// ── Online users tracking (userId → { nome, email, page, lastSeen }) ─────────
const onlineUsers = new Map();

module.exports = {
    addAdminClient, broadcast,
    addTicketClient, broadcastTicket,
    addStudentClient, broadcastToStudents,
    registerUserSSE, unregisterUserSSE,
    emitToUser, emitToUsers, emitToPlan,
    onlineUsers,
};
