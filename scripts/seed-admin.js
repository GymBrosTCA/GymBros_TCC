'use strict';
/**
 * Seed inicial do admin_user.
 * Uso: node scripts/seed-admin.js
 * Pare o servidor antes de rodar para não exceder max_user_connections.
 */
require('dotenv/config');
const mysql  = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function main() {
    const conn = await mysql.createConnection({
        host    : process.env.DB_HOST,
        user    : process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port    : Number(process.env.DB_PORT) || 3306,
    });

    const email = process.env.ADMIN_EMAIL    || 'admin@gymbros.app.br';
    const senha = process.env.ADMIN_PASSWORD || 'admin123';
    const nome  = 'Admin';
    const role  = 'owner';

    const hash = await bcrypt.hash(senha, 10);

    const [rows] = await conn.execute(
        'SELECT id FROM admin_user WHERE email = ?', [email]
    );

    if (rows.length > 0) {
        await conn.execute(
            'UPDATE admin_user SET senha_hash = ?, ativo = 1, role = ? WHERE email = ?',
            [hash, role, email]
        );
        console.log(`[seed] Admin atualizado: ${email}`);
    } else {
        await conn.execute(
            `INSERT INTO admin_user (nome, email, senha_hash, role, ativo)
             VALUES (?, ?, ?, ?, 1)`,
            [nome, email, hash, role]
        );
        console.log(`[seed] Admin criado: ${email}`);
    }

    await conn.end();
    console.log('[seed] Concluído. Reinicie o servidor.');
}

main().catch(err => { console.error('[seed] Erro:', err.message); process.exit(1); });
