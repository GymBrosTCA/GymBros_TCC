'use strict';
const db = require('../config/db');

class BodyPhoto {
    static async findByUser(userId, limit = 5) {
        const [rows] = await db.execute(
            `SELECT * FROM body_photo WHERE user_id = ? ORDER BY created_at DESC LIMIT ${limit}`,
            [userId]
        );
        return rows;
    }

    static async findLatestByUser(userId) {
        const [rows] = await db.execute(
            'SELECT * FROM body_photo WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [userId]
        );
        return rows[0] || null;
    }

    static async create({ user_id, foto_path, gordura_total, gordura_tronco, gordura_braco,
                          gordura_perna, margem_erro, analise_raw, modelo_ia }) {
        const [result] = await db.execute(
            `INSERT INTO body_photo
             (user_id, foto_path, consent_given, consent_at,
              gordura_total, gordura_tronco, gordura_braco, gordura_perna,
              margem_erro, analise_raw, modelo_ia)
             VALUES (?, ?, 1, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, foto_path || null, gordura_total || null, gordura_tronco || null,
             gordura_braco || null, gordura_perna || null, margem_erro || null,
             analise_raw || null, modelo_ia || null]
        );
        return result.insertId;
    }
}

module.exports = BodyPhoto;
