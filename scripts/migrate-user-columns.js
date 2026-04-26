'use strict';
require('dotenv').config();
const db = require('../app/config/db');

const migrations = [
    {
        name: 'last_imc_update',
        sql: 'ALTER TABLE `user` ADD COLUMN `last_imc_update` DATETIME NULL DEFAULT NULL',
    },
    {
        name: 'last_avaliacao_update',
        sql: 'ALTER TABLE `user` ADD COLUMN `last_avaliacao_update` DATETIME NULL DEFAULT NULL',
    },
    {
        name: 'notification_interval_days',
        sql: 'ALTER TABLE `user` ADD COLUMN `notification_interval_days` INT NOT NULL DEFAULT 7',
    },
];

async function run() {
    for (const m of migrations) {
        try {
            await db.execute(m.sql);
            console.log(`[ok] Coluna "${m.name}" adicionada.`);
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log(`[skip] Coluna "${m.name}" já existe.`);
            } else {
                console.error(`[erro] ${m.name}:`, err.message);
            }
        }
    }
    await db.end();
    console.log('[done] Migração concluída.');
}

run();
