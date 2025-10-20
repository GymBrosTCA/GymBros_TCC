// router.js
const express = require('express');
const router = express.Router();
const path = require('path');
const { body, validationResult } = require('express-validator');

// "Banco" temporário
const usuarios = [];

// Função simples pra validar CPF (só pra demo)
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

// ====================
// ROTAS GET
// ====================

// Páginas públicas
router.get('/', (req, res) => res.render('pages/index'));
router.get('/login', (req, res) => res.render('pages/login'));
router.get('/register', (req, res) => res.render('pages/register'));
router.get('/planos', (req, res) => res.render('pages/planos'));
router.get('/academias', (req, res) => res.render('pages/academias'));
router.get('/compra', (req, res) => res.render('pages/compra'));
router.get('/compra2', (req, res) => res.render('pages/compra2'));
router.get('/compra3', (req, res) => res.render('pages/compra3'));
router.get('/about', (req, res) => res.render('pages/about'));

// Área do Aluno (protegida)
router.get('/area-aluno', (req, res) => {
    if (!req.session.user) return res.redirect('/login'); // se não logado, volta pro login
    res.render('pages/area-aluno', { user: req.session.user });
});

//Treinos
router.get('/treinos', (req, res) => {
    if (!req.session.user) return res.redirect('/login'); // Protege a rota
    res.render('pages/treinos', {
        user: req.session.user,
        treinos: [
            { id: 1, nome: 'Treino de Peito', duracao: 50, tipo: 'Força', data: '20/10/2025' },
            { id: 2, nome: 'Treino de Pernas', duracao: 60, tipo: 'Força', data: '21/10/2025' },
            { id: 3, nome: 'Yoga leve', duracao: 40, tipo: 'Alongamento', data: '22/10/2025' },
            { id: 4, nome: 'Treino de Costas', duracao: 55, tipo: 'Força', data: '23/10/2025' },
            { id: 5, nome: 'Treino de Ombros', duracao: 45, tipo: 'Força', data: '24/10/2025' },
            { id: 6, nome: 'Treino Cardio Intenso', duracao: 35, tipo: 'Cardio', data: '25/10/2025' },
            { id: 7, nome: 'Pilates', duracao: 50, tipo: 'Alongamento', data: '26/10/2025' },
            { id: 8, nome: 'Treino Abdominal', duracao: 30, tipo: 'Força', data: '27/10/2025' },
            { id: 9, nome: 'Treino HIIT', duracao: 25, tipo: 'Cardio', data: '28/10/2025' }
        ]
    });
});

//Evolução 
router.get('/evolucao', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const evolucao = {
        treinosConcluidos: 7,
        treinosTotais: 9,
        consistencia: 78,
        labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
        data: [1, 1, 2, 1, 1, 1, 0],
        detalhes: [
            { nome: 'Treino de Peito', peso: 50, repeticoes: 12 },
            { nome: 'Treino de Pernas', peso: 60, repeticoes: 10 },
            { nome: 'Yoga leve', peso: 0, repeticoes: 0 },
            { nome: 'Treino de Costas', peso: 55, repeticoes: 12 },
            { nome: 'Treino de Ombros', peso: 45, repeticoes: 12 },
            { nome: 'Treino Cardio', peso: 0, repeticoes: 0 },
            { nome: 'Treino Abdominal', peso: 0, repeticoes: 20 }
        ]
    };

    res.render('pages/evolucao', {
        user: req.session.user,
        evolucao
    });
});

// Meu Plano
router.get('/meu-plano', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const planoAtual = {
        nome: 'GYMBRO',
        descricao: [
            '3560+ Academias e estúdios',
            'Treinos online ao vivo',
            'Leve 4 amigos por mês',
            'Personal trainer online'
        ],
        preco: 'R$ 85,60/mês',
        tempoRestanteDias: 21,
        progresso: 70
    };

    const outrosPlanos = [
        {
            nome: 'STARTER',
            descricao: [
                '2300+ Academias e estúdios',
                'Treinos online e presenciais'
            ],
            preco: 'R$ 64,90/mês'
        },
        {
            nome: 'BLACK',
            descricao: [
                'Acesso ilimitado em academias parceiras',
                '+5000 Academias e estúdios',
                'Treinos online e presenciais',
                'Aulas exclusivas e personal trainer',
                'Área VIP e benefícios premium'
            ],
            preco: 'R$ 145,90/mês'
        }
    ];

    res.render('pages/meu-plano', { user: req.session.user, planoAtual, outrosPlanos });
});

//Configurações
router.get('/config', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/config', { user: req.session.user });
});

// Atualizar dados pessoais (nome e e-mail)
router.post('/config/atualizar-dados', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const { nome, email } = req.body;
    const user = req.session.user;

    // Verifica se o email já existe
    const emailExistente = usuarios.find(u => u.email === email && u !== user);
    if (emailExistente) {
        return res.status(400).json({ erro: 'E-mail já cadastrado.' });
    }

    // Atualiza no "banco" e na sessão
    user.nome = nome;
    user.email = email;

    const index = usuarios.findIndex(u => u === user);
    usuarios[index] = user;
    req.session.user = user;

    return res.json({ mensagem: 'Dados atualizados com sucesso!' });
});

// Alterar senha
router.post('/config/alterar-senha', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const { senhaAtual, novaSenha } = req.body;
    const user = req.session.user;

    if (user.password !== senhaAtual) {
        return res.status(400).json({ erro: 'Senha atual incorreta.' });
    }

    user.password = novaSenha;

    const index = usuarios.findIndex(u => u === user);
    usuarios[index] = user;
    req.session.user = user;

    return res.json({ mensagem: 'Senha alterada com sucesso!' });
});

// Alterar plano
router.post('/config/alterar-plano', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const { plano } = req.body;
    const user = req.session.user;

    user.plano = plano;
    // opcional: atualizar tempo de renovação ou benefícios
    user.renovacao = '20/11/2025';

    const index = usuarios.findIndex(u => u === user);
    usuarios[index] = user;
    req.session.user = user;

    return res.json({ mensagem: 'Plano atualizado com sucesso!' });
});



// Logout
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.redirect('/login');
    });
});

// ====================
// ROTAS POST
// ====================

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

    // salva usuário na sessão
    req.session.user = user;

    console.log("Login bem-sucedido:", username);
    return res.status(200).json({ mensagem: 'Login realizado com sucesso! Redirecionando...', redirect: '/area-aluno' });
  }
);

// ====================
// ARQUIVOS ESTÁTICOS
// ====================
router.get('/js/carrossel.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/carrossel.js')));
router.get('/js/header.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/header.js')));
router.get('/js/forms.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/forms.js')));
router.get('/js/area-aluno.js', (req, res) => res.sendFile(path.join(__dirname, '../public/js/area-aluno.js')));

module.exports = router;
