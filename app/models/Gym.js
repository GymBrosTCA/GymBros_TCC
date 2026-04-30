'use strict';
const db = require('../config/db');

class Gym {
    static async findAll() {
        const [rows] = await db.execute('SELECT * FROM gym ORDER BY nome ASC');
        return rows;
    }

    static async findActive() {
        const [rows] = await db.execute('SELECT * FROM gym WHERE status = "ativa" ORDER BY nome ASC');
        return rows;
    }

    static async findById(id) {
        const [rows] = await db.execute('SELECT * FROM gym WHERE id = ?', [id]);
        return rows[0] || null;
    }

    // Academias próximas usando fórmula de Haversine (raio em km)
    static async findNearby(lat, lng, radius = 10) {
        const [rows] = await db.execute(
            `SELECT *, (6371 * ACOS(
                COS(RADIANS(?)) * COS(RADIANS(latitude)) *
                COS(RADIANS(longitude) - RADIANS(?)) +
                SIN(RADIANS(?)) * SIN(RADIANS(latitude))
             )) AS distancia
             FROM gym
             WHERE status = 'ativa' AND latitude IS NOT NULL AND longitude IS NOT NULL
             HAVING distancia <= ?
             ORDER BY distancia ASC`,
            [lat, lng, lat, radius]
        );
        return rows;
    }

    static async create({ nome, endereco, numero, bairro, cidade, estado, cep, telefone, email, whatsapp, latitude, longitude }) {
        const [result] = await db.execute(
            `INSERT INTO gym (nome, endereco, numero, bairro, cidade, estado, cep, telefone, email, whatsapp, latitude, longitude)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nome, endereco || null, numero || null, bairro || null, cidade || null, estado || null,
             cep || null, telefone || null, email || null, whatsapp || null, latitude || null, longitude || null]
        );
        return result.insertId;
    }

    static async update(id, fields) {
        const allowed = ['nome', 'endereco', 'numero', 'bairro', 'cidade', 'estado', 'cep',
                         'telefone', 'email', 'whatsapp', 'latitude', 'longitude', 'status'];
        const entries = Object.entries(fields).filter(([k, v]) => allowed.includes(k) && v !== undefined);
        if (!entries.length) return;
        const sets   = entries.map(([k]) => `${k} = ?`);
        const values = entries.map(([, v]) => v);
        await db.execute(`UPDATE gym SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
    }

    static async delete(id) {
        await db.execute('DELETE FROM gym WHERE id = ?', [id]);
    }
}

module.exports = Gym;
