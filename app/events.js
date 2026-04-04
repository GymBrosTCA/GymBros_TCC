'use strict';

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

module.exports = { addAdminClient, broadcast, addTicketClient, broadcastTicket, addStudentClient, broadcastToStudents };
