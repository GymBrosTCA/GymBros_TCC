'use strict';
const db = require('../config/db');

class User {
    static async findById(id) {
        const [rows] = await db.execute('SELECT * FROM user WHERE id = ?', [id]);
        return rows[0] || null;
    }

    static async findByCpf(cpf) {
        const [rows] = await db.execute('SELECT * FROM user WHERE cpf = ?', [cpf]);
        return rows[0] || null;
    }

    static async findByEmail(email) {
        const [rows] = await db.execute('SELECT * FROM user WHERE email = ?', [email]);
        return rows[0] || null;
    }

    static async findByNome(nome) {
        const [rows] = await db.execute('SELECT * FROM user WHERE nome = ?', [nome]);
        return rows[0] || null;
    }

    // Tenta CPF → email → nome, filtrando apenas usuários ativos
    static async findActiveByIdentifier(identifier) {
        const cpfNorm = identifier.replace(/\D/g, '');
        if (/^\d{11}$/.test(cpfNorm)) {
            const [r] = await db.execute("SELECT * FROM user WHERE cpf = ? AND status = 'ativo'", [cpfNorm]);
            if (r[0]) return r[0];
        }
        const [r2] = await db.execute("SELECT * FROM user WHERE email = ? AND status = 'ativo'", [identifier.toLowerCase()]);
        if (r2[0]) return r2[0];
        const [r3] = await db.execute("SELECT * FROM user WHERE nome = ? AND status = 'ativo'", [identifier]);
        return r3[0] || null;
    }

    static async findAll({ page = 1, limit = 15, status = null, busca = null, plano = null } = {}) {
        const offset = (page - 1) * limit;
        let where = 'WHERE 1=1';
        const params = [];
        if (busca)  { where += ' AND (u.nome LIKE ? OR u.cpf LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`); }
        if (plano)  { where += ' AND p.slug = ?'; params.push(plano); }
        if (status) { where += ' AND u.status = ?'; params.push(status); }
        const sql = `SELECT u.id, u.nome, u.email, u.cpf, u.status, u.created_at AS createdAt,
                            p.nome AS plano, p.id AS planoId, p.slug AS planoSlug
                     FROM user u
                     LEFT JOIN user_plan up ON up.user_id = u.id AND up.status = 'ativo'
                     LEFT JOIN plan p ON p.id = up.plan_id
                     ${where} ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        const [rows] = await db.execute(sql, params);
        return rows;
    }

    static async count({ status = null, busca = null, plano = null } = {}) {
        let where = 'WHERE 1=1';
        const params = [];
        if (busca)  { where += ' AND (u.nome LIKE ? OR u.cpf LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`); }
        if (plano)  { where += ' AND p.slug = ?'; params.push(plano); }
        if (status) { where += ' AND u.status = ?'; params.push(status); }
        const sql = `SELECT COUNT(*) AS total FROM user u
                     LEFT JOIN user_plan up ON up.user_id = u.id AND up.status = 'ativo'
                     LEFT JOIN plan p ON p.id = up.plan_id ${where}`;
        const [[{ total }]] = await db.execute(sql, params);
        return Number(total);
    }

    static async create({ nome, cpf, email, senha_hash, cep, logradouro, numero, complemento, bairro, cidade, estado }) {
        const [result] = await db.execute(
            `INSERT INTO user (nome, cpf, email, senha_hash, cep, logradouro, numero, complemento, bairro, cidade, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nome, cpf, email, senha_hash, cep || null, logradouro || null, numero || null,
             complemento || null, bairro || null, cidade || null, estado || null]
        );
        return result.insertId;
    }

    static async update(id, fields) {
        const allowed = ['nome', 'email', 'cep', 'telefone', 'profile_photo', 'status',
                         'last_seen', 'notification_interval_days', 'last_imc_update',
                         'last_avaliacao_update', 'senha_hash'];
        const entries = Object.entries(fields).filter(([k, v]) => allowed.includes(k) && v !== undefined);
        if (!entries.length) return;
        const sets   = entries.map(([k]) => `${k} = ?`);
        const values = entries.map(([, v]) => v);
        await db.execute(`UPDATE user SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
    }

    static async delete(id) {
        await db.execute('DELETE FROM user WHERE id = ?', [id]);
    }

    static async getActivePlan(userId) {
        const [rows] = await db.execute(
            `SELECT p.* FROM plan p
             JOIN user_plan up ON up.plan_id = p.id
             WHERE up.user_id = ? AND up.status = 'ativo'
             LIMIT 1`,
            [userId]
        );
        return rows[0] || null;
    }
}

module.exports = User;
