'use strict';
const db = require('../config/db');

class Plan {
    static async findAll({ activeOnly = false } = {}) {
        let sql = 'SELECT * FROM plan';
        if (activeOnly) sql += ' WHERE status = "ativo"';
        sql += ' ORDER BY preco ASC';
        const [rows] = await db.execute(sql);
        return rows;
    }

    static async findAllWithSubscriberCount() {
        const [rows] = await db.execute(
            `SELECT p.*, COUNT(up.id) AS totalAssinantes
             FROM plan p
             LEFT JOIN user_plan up ON up.plan_id = p.id AND up.status = 'ativo'
             GROUP BY p.id ORDER BY p.preco ASC`
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await db.execute('SELECT * FROM plan WHERE id = ?', [id]);
        return rows[0] || null;
    }

    static async findBySlug(slug) {
        const [rows] = await db.execute('SELECT * FROM plan WHERE slug = ? LIMIT 1', [slug]);
        return rows[0] || null;
    }

    static async findBySlugOrName(slug, nome) {
        const [rows] = await db.execute(
            'SELECT id, nome, slug FROM plan WHERE slug = ? OR nome = ? LIMIT 1',
            [slug, nome]
        );
        return rows[0] || null;
    }

    static async create({ slug, nome, descricao, preco, duracao_dias = 30, beneficios = [], permite_ia = 0, permite_avaliacao_corporal = 0, ordem = 0 }) {
        const [result] = await db.execute(
            `INSERT INTO plan (slug, nome, descricao, preco, duracao_dias, beneficios, permite_ia, permite_avaliacao_corporal, ordem)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [slug || nome.toLowerCase().replace(/\s+/g, '-'), nome, descricao || null,
             parseFloat(preco), duracao_dias, JSON.stringify(Array.isArray(beneficios) ? beneficios : []),
             permite_ia ? 1 : 0, permite_avaliacao_corporal ? 1 : 0, ordem]
        );
        return result.insertId;
    }

    static async update(id, fields) {
        const allowed = ['nome', 'descricao', 'preco', 'beneficios', 'status', 'permite_ia', 'permite_avaliacao_corporal', 'ordem'];
        const entries = Object.entries(fields)
            .filter(([k, v]) => allowed.includes(k) && v !== undefined)
            .map(([k, v]) => [k, k === 'beneficios' ? JSON.stringify(Array.isArray(v) ? v : []) : v]);
        if (!entries.length) return;
        const sets   = entries.map(([k]) => `${k} = ?`);
        const values = entries.map(([, v]) => v);
        await db.execute(`UPDATE plan SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
    }

    static async delete(id) {
        await db.execute('DELETE FROM plan WHERE id = ?', [id]);
    }
}

module.exports = Plan;
