'use strict';
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    timezone: '-03:00',
    connectTimeout: 30000,
    idleTimeout:    300000,
    maxIdle:        2,
});

pool.getConnection()
    .then(conn => {
        console.log('[db] Conectado ao MySQL — Clever Cloud');
        conn.release();
    })
    .catch(err => console.error('[db] Erro de conexão:', err.message));

module.exports = pool;
