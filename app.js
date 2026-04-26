require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path       = require('path');
const fs         = require('fs');
const db         = require('./app/config/db');

const app  = express();
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

const sessionStore = new MySQLStore({
    createDatabaseTable: false,
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires:    'expires',
            data:       'data',
        },
    },
}, db);

app.use(session({
    secret: process.env.SESSION_SECRET || 'gymbrossecret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        // sem maxAge — sessão dura até fechar o browser
    },
}));

// Injeta baseUrl em todas as views (canonical + OG)
app.use((req, res, next) => {
    res.locals.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    next();
});

// Injeta app_config em todas as views (cache de 60s)
let configCache = null;
let configCacheTime = 0;
app.use(async (req, res, next) => {
    try {
        const now = Date.now();
        if (!configCache || now - configCacheTime > 60000) {
            const [rows] = await db.execute('SELECT chave, valor FROM app_config');
            configCache = Object.fromEntries(rows.map(r => [r.chave, r.valor]));
            configCacheTime = now;
        }
        res.locals.config = configCache;
    } catch {
        res.locals.config = {};
    }
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
