require('dotenv').config();
const express = require("express");
const session = require('express-session');
const app = express();
const port = 3000;

// ===========================
// MIDDLEWARES
// ===========================
app.use(express.static("app/public"));

app.set("view engine", "ejs");
app.set("views", "./app/views");

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use(session({
  secret: 'gymbrossecret',
  resave: false,
  saveUninitialized: true
}));

const rotas = require('./app/routes/router');
app.use('/', rotas);

const rotasAI = require('./app/routes/ai');
app.use('/ai', rotasAI);

app.listen(port, () => {
  console.log(`Servidor ouvindo na porta ${port}\nhttp://localhost:${port}`);
});
