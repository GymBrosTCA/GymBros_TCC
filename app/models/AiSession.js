'use strict';
const db = require('../config/db');

class AiSession {
    static async findActiveByUser(userId) {
        const [rows] = await db.execute(
            'SELECT * FROM ai_session WHERE user_id = ? AND ativa = 1 ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
        return rows[0] || null;
    }

    static async create(userId) {
        const [result] = await db.execute(
            'INSERT INTO ai_session (user_id, ativa) VALUES (?, 1)',
            [userId]
        );
        return result.insertId;
    }

    static async addMessage(sessionId, remetente, texto) {
        const [result] = await db.execute(
            'INSERT INTO ai_message (ai_session_id, remetente, texto) VALUES (?, ?, ?)',
            [sessionId, remetente, texto]
        );
        return result.insertId;
    }

    static async deactivate(sessionId) {
        await db.execute('UPDATE ai_session SET ativa = 0 WHERE id = ?', [sessionId]);
    }

    static async getMessages(sessionId) {
        const [rows] = await db.execute(
            'SELECT * FROM ai_message WHERE ai_session_id = ? ORDER BY created_at ASC',
            [sessionId]
        );
        return rows;
    }
}

module.exports = AiSession;
