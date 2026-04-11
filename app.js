require('dotenv').config();
const express = require("express");
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');
const app = express();
const port = 3000;

// Garante que o diretório de uploads existe
const uploadDir = path.join(__dirname, 'uploads', 'profile_photos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ===========================
// MIDDLEWARES
// ===========================
app.use(express.static("app/public"));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.set("view engine", "ejs");
app.set("views", "./app/views");

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Em produção (HTTPS atrás de proxy), o Express precisa confiar no X-Forwarded-* do proxy
app.set('trust proxy', 1);

const isProd = process.env.NODE_ENV === 'production';

app.use(session({
  secret: process.env.SESSION_SECRET || 'gymbrossecret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: isProd,       // HTTPS-only em produção
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000  // 24 horas
  }
}));

// Injeta baseUrl em todas as views (canonical + OG)
app.use((req, res, next) => {
    res.locals.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    next();
});

const rotas = require('./app/routes/router');
app.use('/', rotas);

const rotasAI = require('./app/routes/ai');
app.use('/ai', rotasAI);

const rotasAPI = require('./app/routes/api');
app.use('/api', rotasAPI);

const rotasAdmin = require('./app/routes/admin');
app.use('/admin', rotasAdmin);

const rotasAdminAPI = require('./app/routes/admin-api');
app.use('/api/admin', rotasAdminAPI);

const rotasSuporte = require('./app/routes/suporte');
app.use('/api/suporte', rotasSuporte);

app.listen(port, () => {
  console.log(`Servidor ouvindo na porta ${port}\nhttp://localhost:${port}`);
});
