'use strict';
const db = require('../config/db');

class Checkin {
    static async findByUser(userId, limit = 20) {
        const [rows] = await db.execute(
            `SELECT c.*, g.nome AS academiaNome
             FROM checkin c
             LEFT JOIN gym g ON g.id = c.gym_id
             WHERE c.user_id = ?
             ORDER BY c.data DESC LIMIT ${limit}`,
            [userId]
        );
        return rows;
    }

    static async findByGym(gymId) {
        const [rows] = await db.execute(
            'SELECT * FROM checkin WHERE gym_id = ? ORDER BY data DESC',
            [gymId]
        );
        return rows;
    }

    static async findAll({ gymId = null, page = 1, per = 20 } = {}) {
        const offset = (page - 1) * per;
        let where = 'WHERE 1=1';
        const params = [];
        if (gymId) { where += ' AND c.gym_id = ?'; params.push(gymId); }
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM checkin c ${where}`, params);
        const [items] = await db.execute(
            `SELECT c.*, u.nome AS userName, g.nome AS academiaNome
             FROM checkin c
             LEFT JOIN user u ON u.id = c.user_id
             LEFT JOIN gym g ON g.id = c.gym_id
             ${where} ORDER BY c.data DESC LIMIT ${per} OFFSET ${offset}`,
            params
        );
        return { total: Number(total), items };
    }

    static async create(userId, gymId) {
        const [result] = await db.execute(
            'INSERT INTO checkin (user_id, gym_id, data) VALUES (?, ?, CURDATE())',
            [userId, gymId]
        );
        return result.insertId;
    }

    static async countByUser(userId) {
        const [[{ total }]] = await db.execute(
            'SELECT COUNT(*) AS total FROM checkin WHERE user_id = ?',
            [userId]
        );
        return Number(total);
    }

    static async countToday() {
        const [[{ total }]] = await db.execute(
            "SELECT COUNT(*) AS total FROM checkin WHERE DATE(data) = CURDATE()"
        );
        return Number(total);
    }
}

module.exports = Checkin;
