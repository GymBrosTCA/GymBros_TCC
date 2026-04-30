'use strict';
const db = require('../config/db');

class Notification {
    static async findAll() {
        const [rows] = await db.execute('SELECT * FROM notification ORDER BY created_at DESC');
        return rows;
    }

    static async findForUser(userId, planoId) {
        const [rows] = await db.execute(
            `SELECT n.*,
               EXISTS(SELECT 1 FROM notification_read nr WHERE nr.notification_id = n.id AND nr.user_id = ?) AS lida
             FROM notification n
             WHERE n.destinatarios = 'todos' OR n.destinatarios = ?
             ORDER BY n.created_at DESC LIMIT 20`,
            [userId, String(planoId)]
        );
        return rows;
    }

    static async create({ titulo, corpo, destinatarios = 'todos', tipo = 'info' }) {
        const [result] = await db.execute(
            'INSERT INTO notification (titulo, corpo, destinatarios, tipo) VALUES (?, ?, ?, ?)',
            [titulo, corpo, destinatarios, tipo]
        );
        return result.insertId;
    }
}

module.exports = Notification;
