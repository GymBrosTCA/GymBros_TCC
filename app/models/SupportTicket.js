'use strict';
const db = require('../config/db');

class SupportTicket {
    static async findAll({ status = null } = {}) {
        let where = 'WHERE 1=1';
        const params = [];
        if (status) { where += ' AND st.status = ?'; params.push(status); }
        const [rows] = await db.execute(
            `SELECT st.*, u.nome AS userName, u.email AS userEmail, u.cpf AS userCpf
             FROM support_ticket st
             LEFT JOIN user u ON u.id = st.user_id
             ${where} ORDER BY st.updated_at DESC`,
            params
        );
        return rows;
    }

    static async findByUser(userId) {
        const [rows] = await db.execute(
            `SELECT st.*,
               (SELECT COUNT(*) FROM support_message sm
                WHERE sm.ticket_id = st.id AND sm.lida = 0 AND sm.remetente = 'admin') AS nao_lidas
             FROM support_ticket st
             WHERE st.user_id = ?
             ORDER BY st.updated_at DESC`,
            [userId]
        );
        return rows;
    }

    static async findById(id) {
        const [[ticket]] = await db.execute('SELECT * FROM support_ticket WHERE id = ?', [id]);
        return ticket || null;
    }

    static async create({ userId, assunto, tipo = 'Outro', descricao }) {
        const [result] = await db.execute(
            'INSERT INTO support_ticket (user_id, assunto, tipo, prioridade) VALUES (?, ?, ?, "normal")',
            [userId, assunto, tipo]
        );
        const ticketId = result.insertId;
        await db.execute(
            'INSERT INTO support_message (ticket_id, remetente, texto) VALUES (?, "usuario", ?)',
            [ticketId, descricao.trim()]
        );
        return ticketId;
    }

    static async updateStatus(id, status, adminId = null) {
        await db.execute(
            'UPDATE support_ticket SET status = ?, admin_id = ?, updated_at = NOW() WHERE id = ?',
            [status, adminId, id]
        );
    }

    static async countOpen() {
        const [[{ cnt }]] = await db.execute(
            "SELECT COUNT(*) AS cnt FROM support_ticket WHERE status != 'resolvido'"
        );
        return Number(cnt);
    }

    static async counts() {
        const [[{ total }]]          = await db.execute('SELECT COUNT(*) AS total FROM support_ticket');
        const [[{ aberto }]]         = await db.execute("SELECT COUNT(*) AS aberto FROM support_ticket WHERE status = 'aberto'");
        const [[{ em_atendimento }]] = await db.execute("SELECT COUNT(*) AS em_atendimento FROM support_ticket WHERE status = 'em_atendimento'");
        const [[{ resolvido }]]      = await db.execute("SELECT COUNT(*) AS resolvido FROM support_ticket WHERE status = 'resolvido'");
        return {
            todos:           Number(total),
            aberto:          Number(aberto),
            em_atendimento:  Number(em_atendimento),
            resolvido:       Number(resolvido),
        };
    }
}

module.exports = SupportTicket;
