'use strict';
const db = require('../config/db');

class ImcProfile {
    static async findLatestByUser(userId) {
        const [rows] = await db.execute(
            'SELECT * FROM imc_profile WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [userId]
        );
        return rows[0] || null;
    }

    static async create({ userId, peso, altura, imc_valor, idade, sexo, objetivo, experiencia,
                          dias_semana, tempo_por_sessao, local_treino, lesoes, restricoes_alimentares,
                          suplementacao, hidratacao, seletividade, alimentos_seletividade }) {
        const [result] = await db.execute(
            `INSERT INTO imc_profile
             (user_id, peso, altura, imc_valor, idade, sexo, objetivo, experiencia,
              dias_semana, tempo_por_sessao, local_treino, lesoes, restricoes_alimentares,
              suplementacao, hidratacao, seletividade, alimentos_seletividade)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, peso, altura, imc_valor, idade, sexo, objetivo, experiencia,
             dias_semana, tempo_por_sessao, local_treino,
             JSON.stringify(lesoes || []),
             JSON.stringify(restricoes_alimentares || []),
             JSON.stringify(suplementacao || []),
             hidratacao, seletividade, alimentos_seletividade || null]
        );
        return result.insertId;
    }
}

module.exports = ImcProfile;
