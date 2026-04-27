'use strict';
/**
 * Seed de academias (gym) e check-ins fictícios para demo.
 * Uso: node scripts/seed-checkins.js
 */
require('dotenv/config');
const mysql = require('mysql2/promise');

const GYMS = [
    { nome: 'SmartFit - Paulista',      endereco: 'Av. Paulista',     numero: '1000', bairro: 'Bela Vista',    cidade: 'São Paulo',    estado: 'SP', cep: '01310100', telefone: '1130001000', email: 'paulista@smartfit.com',  whatsapp: '11930001000', latitude: -23.5614, longitude: -46.6559 },
    { nome: 'SmartFit - Consolação',    endereco: 'R. da Consolação', numero: '2300', bairro: 'Consolação',    cidade: 'São Paulo',    estado: 'SP', cep: '01301000', telefone: '1130002000', email: 'consolacao@smartfit.com', whatsapp: '11930002000', latitude: -23.5527, longitude: -46.6644 },
    { nome: 'Bio Ritmo - Moema',        endereco: 'Av. Ibirapuera',   numero: '3103', bairro: 'Moema',         cidade: 'São Paulo',    estado: 'SP', cep: '04029200', telefone: '1130003000', email: 'moema@bioritmo.com',      whatsapp: '11930003000', latitude: -23.6044, longitude: -46.6702 },
    { nome: 'Selfit - Lapa',            endereco: 'R. Guaicurus',     numero: '200',  bairro: 'Lapa',          cidade: 'São Paulo',    estado: 'SP', cep: '05033010', telefone: '1130004000', email: 'lapa@selfit.com',          whatsapp: '11930004000', latitude: -23.5176, longitude: -46.6997 },
    { nome: 'Total Fit - Santo André',  endereco: 'Av. Industrial',   numero: '600',  bairro: 'Centro',        cidade: 'Santo André',  estado: 'SP', cep: '09080000', telefone: '1130005000', email: 'sa@totalfit.com',          whatsapp: '11930005000', latitude: -23.6647, longitude: -46.5365 },
    { nome: 'Arena Fit - Campinas',     endereco: 'R. José Paulino',  numero: '1520', bairro: 'Cambuí',        cidade: 'Campinas',     estado: 'SP', cep: '13025040', telefone: '1930006000', email: 'campinas@arenafit.com',    whatsapp: '19930006000', latitude: -22.9064, longitude: -47.0592 },
    { nome: 'Corpus Fit - Vila Olímpia',endereco: 'R. Iguatemi',      numero: '354',  bairro: 'Vila Olímpia',  cidade: 'São Paulo',    estado: 'SP', cep: '04548010', telefone: '1130007000', email: 'olimpia@corpusfit.com',    whatsapp: '11930007000', latitude: -23.5959, longitude: -46.6851 },
    { nome: 'Fórmula Academia - Pinheiros', endereco: 'R. dos Pinheiros', numero: '900', bairro: 'Pinheiros', cidade: 'São Paulo',    estado: 'SP', cep: '05422001', telefone: '1130008000', email: 'pinheiros@formula.com',    whatsapp: '11930008000', latitude: -23.5643, longitude: -46.6805 },
    { nome: 'PowerFit - ABC',           endereco: 'Av. Portugal',     numero: '350',  bairro: 'Centro',        cidade: 'São Bernardo', estado: 'SP', cep: '09750700', telefone: '1130009000', email: 'abc@powerfit.com',         whatsapp: '11930009000', latitude: -23.6939, longitude: -46.5650 },
    { nome: 'GymStation - Osasco',      endereco: 'Av. dos Autonomistas', numero: '1200', bairro: 'Centro',   cidade: 'Osasco',       estado: 'SP', cep: '06020010', telefone: '1130010000', email: 'osasco@gymstation.com',    whatsapp: '11930010000', latitude: -23.5322, longitude: -46.7919 },
];

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - randomBetween(0, daysAgo));
    const h = randomBetween(6, 21);
    const m = randomBetween(0, 59);
    d.setHours(h, m, 0, 0);
    return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function main() {
    const conn = await mysql.createConnection({
        host    : process.env.DB_HOST,
        user    : process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port    : Number(process.env.DB_PORT) || 3306,
    });

    try {
        // 1. Inserir academias (ignora se já existirem pelo nome)
        console.log('Inserindo academias...');
        for (const g of GYMS) {
            const [exists] = await conn.execute('SELECT id FROM gym WHERE nome = ?', [g.nome]);
            if (exists.length === 0) {
                await conn.execute(
                    `INSERT INTO gym (nome, endereco, numero, bairro, cidade, estado, cep, telefone, email, whatsapp, latitude, longitude, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativa')`,
                    [g.nome, g.endereco, g.numero, g.bairro, g.cidade, g.estado, g.cep, g.telefone, g.email, g.whatsapp, g.latitude, g.longitude]
                );
                console.log(`  ✓ ${g.nome}`);
            } else {
                console.log(`  — ${g.nome} (já existe)`);
            }
        }

        // 2. Buscar usuários existentes
        const [users] = await conn.execute('SELECT id FROM user LIMIT 50');
        if (users.length === 0) {
            console.log('\nNenhum usuário encontrado. Cadastre usuários primeiro.');
            return;
        }

        // 3. Buscar academias inseridas
        const [gyms] = await conn.execute('SELECT id FROM gym WHERE status = "ativa"');

        // 4. Inserir check-ins fictícios (≈ 300 nos últimos 60 dias)
        console.log('\nInserindo check-ins fictícios...');
        let count = 0;
        const TARGET = 300;

        for (let i = 0; i < TARGET; i++) {
            const user = users[randomBetween(0, users.length - 1)];
            const gym  = gyms[randomBetween(0, gyms.length - 1)];
            const data = randomDate(60);
            await conn.execute('INSERT INTO checkin (user_id, gym_id, data) VALUES (?, ?, ?)', [user.id, gym.id, data]);
            count++;
        }

        console.log(`  ✓ ${count} check-ins inseridos`);
        console.log('\nSeed concluído.');
    } finally {
        await conn.end();
    }
}

main().catch(err => { console.error(err); process.exit(1); });
