// ai.js — rotas do Personal Trainer IA (Groq)
const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');

const BASE_PROMPT = `Você é um personal trainer virtual chamado GymBot, assistente oficial do GymBros.
Você ajuda alunos com dúvidas sobre treinos, exercícios, nutrição básica e motivação.
Seja direto, motivador e use linguagem acessível. Responda sempre em português.`;

function buildSystemPrompt(user) {
    const imc = user.imc;

    if (!imc) {
        return BASE_PROMPT + `

Observação: o usuário ${user.nome} ainda não preencheu o formulário de perfil IMC. Se ele pedir orientações personalizadas de treino ou nutrição, informe gentilmente que pode preencher o perfil em /imc-form para receber recomendações mais precisas.`;
    }

    const lesoes  = imc.lesoes  && imc.lesoes.length  ? imc.lesoes.join(', ')  : 'nenhuma';
    const grupos  = imc.gruposAlimentares && imc.gruposAlimentares.length ? imc.gruposAlimentares.join(', ') : 'não informado';
    const restric = imc.restricoesAlimentares && imc.restricoesAlimentares.length ? imc.restricoesAlimentares.join(', ') : 'nenhuma';
    const selet   = imc.seletividade === 'sim'
        ? `sim${imc.alimentosSeletividade ? ' — ' + imc.alimentosSeletividade : ''}`
        : 'não';
    const supl    = imc.suplementacao && imc.suplementacao.length ? imc.suplementacao.join(', ') : 'nenhuma';

    return BASE_PROMPT + `

Perfil do usuário:
Usuário: ${user.nome}, ${imc.idade} anos, ${imc.peso}kg, ${imc.altura}cm, IMC ${imc.imcValor}.
Objetivo: ${imc.objetivo}. Experiência: ${imc.experiencia}. Treina ${imc.diasSemana} dias/semana, ${imc.tempoPorSessao} min/sessão. Local: ${imc.localTreino}.
Restrições físicas: ${lesoes}.
Alimentação: consome ${grupos}, restrições: ${restric}, seletividade alimentar: ${selet}.
Suplementação: ${supl}. Hidratação: ${imc.hidratacao}.

Use este perfil para personalizar todas as respostas. Não precisa repetir os dados do perfil na resposta, apenas use-os para contextualizar as orientações.`;
}

// GET /ai/chat — renderiza a página do chat
router.get('/chat', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('pages/ai-chat', { user: req.session.user });
});

// POST /ai/message — envia mensagem ao Groq e retorna resposta em JSON
router.post('/message', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ reply: 'Não autorizado.' });

    const { message } = req.body;
    if (!message || !message.trim()) {
        return res.json({ reply: 'Por favor, envie uma mensagem.' });
    }

    try {
        const groq       = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
            model:    'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: buildSystemPrompt(req.session.user) },
                { role: 'user',   content: message }
            ]
        });
        return res.json({ reply: completion.choices[0].message.content });
    } catch (err) {
        console.error('Erro ao chamar Groq:', err.message);
        return res.json({ reply: 'Desculpe, não consegui processar sua mensagem. Tente novamente.' });
    }
});

module.exports = router;
