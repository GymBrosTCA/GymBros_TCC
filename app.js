require('dotenv').config();
const express = require("express");
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');
const i18n    = require('./app/config/i18n');
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

app.use(session({
  secret: 'gymbrossecret',
  resave: false,
  saveUninitialized: true
}));

// i18n: detecta locale pelo cookie gymbros_lang, expõe __() em todas as views
app.use(i18n.init);

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
