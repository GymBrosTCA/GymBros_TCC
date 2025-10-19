const express = require('express');
const router = express.Router();
const path = require('path');
const { body, validationResult } = require('express-validator');

// "Banco" temporário
const usuarios = [];

// Função simples pra validar CPF (só pra demo, não é 100% completa)
function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf[10])) return false;
  return true;
}

// ===== ROTAS GET =====
router.get('/', (req, res) => res.render('pages/index'));
router.get('/login', (req, res) => res.render('pages/login'));
router.get('/register', (req, res) => res.render('pages/register'));
router.get('/planos', (req, res) => res.render('pages/planos'));
router.get('/academias', (req, res) => res.render('pages/academias'));
router.get('/compra', (req, res) => res.render('pages/compra'));
router.get('/compra2', (req, res) => res.render('pages/compra2'));
router.get('/compra3', (req, res) => res.render('pages/compra3'));
router.get('/about', (req, res) => res.render('pages/about'));

// ===== ROTAS POST =====

// Registro
router.post('/register',
  [
    body('nome')
      .trim()
      .notEmpty().withMessage('Nome obrigatório.')
      .isLength({ min: 3 }).withMessage('Nome muito curto.'),
    body('cpf')
      .custom(value => {
        if (!validarCPF(value)) throw new Error('CPF inválido.');
        return true;
      }),
    body('email')
      .isEmail().withMessage('E-mail inválido.')
      .normalizeEmail(),
    body('cep')
      .matches(/^\d{8}$/).withMessage('CEP deve ter 8 números.'),
    body('password')
      .isLength({ min: 6 }).withMessage('A senha deve ter pelo menos 6 caracteres.'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) throw new Error('As senhas não coincidem!');
        return true;
      }),
    body('terms')
      .equals('on').withMessage('Você precisa aceitar os termos de uso.')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ erros: errors.array() });
    }

    const { nome, cpf, email, cep, password } = req.body;
    const jaExiste = usuarios.find(u => u.cpf === cpf || u.email === email);
    if (jaExiste) {
      return res.status(400).json({ erros: [{ param: 'cpf', msg: 'CPF ou e-mail já cadastrado.' }] });
    }

    usuarios.push({ nome, cpf, email, cep, password });
    console.log("Usuário registrado:", nome);

    return res.status(200).json({ mensagem: 'Cadastro realizado com sucesso! Redirecionando para o login...' });
  }
);

// Login
router.post('/login',
  [
    body('username').trim().notEmpty().withMessage('Usuário obrigatório.'),
    body('password').notEmpty().withMessage('Senha obrigatória.')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ erros: errors.array() });
    }

    const { username, password } = req.body;
    const user = usuarios.find(u => (u.nome === username || u.email === username || u.cpf === username) && u.password === password);

    if (!user) {
      return res.status(401).json({ erros: [{ param: 'password', msg: 'Usuário ou senha incorretos.' }] });
    }

    console.log("Login bem-sucedido:", username);
    return res.status(200).json({ mensagem: 'Login realizado com sucesso! Redirecionando...', redirect: '/' });
  }
);

// ===== ARQUIVOS ESTÁTICOS =====
router.get('/js/carrossel.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/carrossel.js')));
router.get('/js/header.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/header.js')));

module.exports = router;
