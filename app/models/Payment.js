'use strict';
const db = require('../config/db');

class Payment {
    static async findByUser(userId) {
        const [rows] = await db.execute(
            `SELECT py.*, p.nome AS planoNome
             FROM payment py
             LEFT JOIN plan p ON p.id = py.plan_id
             WHERE py.user_id = ?
             ORDER BY py.created_at DESC`,
            [userId]
        );
        return rows;
    }

    static async findAll({ status = null, page = 1, per = 20 } = {}) {
        const offset = (page - 1) * per;
        let where = 'WHERE 1=1';
        const params = [];
        if (status) { where += ' AND py.status = ?'; params.push(status); }
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM payment py ${where}`, params);
        const [items] = await db.execute(
            `SELECT py.*, u.nome AS userName, u.email AS userEmail, p.nome AS planoNome
             FROM payment py
             LEFT JOIN user u ON u.id = py.user_id
             LEFT JOIN plan p ON p.id = py.plan_id
             ${where} ORDER BY py.created_at DESC LIMIT ${per} OFFSET ${offset}`,
            params
        );
        return { total: Number(total), items };
    }

    static async create({ user_id, plan_id, valor_bruto, valor_final, metodo, parcelas = 1, cartao_final = null, cartao_bandeira = null, status = 'pago' }) {
        const [result] = await db.execute(
            `INSERT INTO payment (user_id, plan_id, valor_bruto, valor_final, metodo, parcelas, cartao_final, cartao_bandeira, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, plan_id, valor_bruto, valor_final, metodo, parcelas, cartao_final, cartao_bandeira, status]
        );
        return result.insertId;
    }

    static async updateStatus(id, status) {
        await db.execute('UPDATE payment SET status = ? WHERE id = ?', [status, id]);
    }
}

module.exports = Payment;
