// ai.js — rotas do Personal Trainer IA (Groq)
const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');

const BASE_PROMPT = `Você é um personal trainer virtual chamado GymBot, assistente oficial do GymBros.
Você ajuda alunos com dúvidas sobre treinos, exercícios, nutrição básica e motivação.
Seja direto, motivador e use linguagem acessível. Responda sempre em português.`;

function buildSystemPrompt(user) {
    const imc = user.imc;
    const aval = user.avaliacaoCorporal;

    let prompt = BASE_PROMPT;

    if (!imc) {
        prompt += `

Observação: o usuário ${user.nome} ainda não preencheu o formulário de perfil IMC. Se ele pedir orientações personalizadas de treino ou nutrição, informe gentilmente que pode preencher o perfil em /imc-form para receber recomendações mais precisas.`;
        return prompt;
    }

    const lesoes  = imc.lesoes  && imc.lesoes.length  ? imc.lesoes.join(', ')  : 'nenhuma';
    const grupos  = imc.gruposAlimentares && imc.gruposAlimentares.length ? imc.gruposAlimentares.join(', ') : 'não informado';
    const restric = imc.restricoesAlimentares && imc.restricoesAlimentares.length ? imc.restricoesAlimentares.join(', ') : 'nenhuma';
    const selet   = imc.seletividade === 'sim'
        ? `sim${imc.alimentosSeletividade ? ' — ' + imc.alimentosSeletividade : ''}`
        : 'não';
    const supl    = imc.suplementacao && imc.suplementacao.length ? imc.suplementacao.join(', ') : 'nenhuma';

    prompt += `

Perfil do usuário:
Usuário: ${user.nome}, ${imc.idade} anos, ${imc.peso}kg, ${imc.altura}cm, IMC ${imc.imcValor}.
Objetivo: ${imc.objetivo}. Experiência: ${imc.experiencia}. Treina ${imc.diasSemana} dias/semana, ${imc.tempoPorSessao} min/sessão. Local: ${imc.localTreino}.
Restrições físicas: ${lesoes}.
Alimentação: consome ${grupos}, restrições: ${restric}, seletividade alimentar: ${selet}.
Suplementação: ${supl}. Hidratação: ${imc.hidratacao}.`;

    // Inclui dados da avaliação corporal por IA se disponíveis
    if (aval && aval.composicao) {
        const c = aval.composicao;
        prompt += `

Avaliação corporal por IA (realizada em ${aval.data || 'data não registrada'}):
- Gordura corporal estimada: ${c.percentual_gordura_estimado} (margem: ${c.margem_erro})
- Massa muscular aparente: ${c.massa_muscular_aparente}
- Região de gordura predominante: ${c.regiao_predominante}
- Classificação IMC visual: ${aval.classificacao_imc_visual}
- Pontos positivos: ${(aval.pontos_positivos || []).join('; ')}
- Áreas de melhoria: ${(aval.areas_melhoria || []).join('; ')}`;
    }

    prompt += `

Use este perfil para personalizar todas as respostas. Não precisa repetir os dados do perfil na resposta, apenas use-os para contextualizar as orientações.`;

    return prompt;
}

// GET /ai/chat — renderiza a página do chat
router.get('/chat', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('pages/ai-chat', { user: req.session.user });
});

// GET /ai/avaliacao — renderiza a página de avaliação corporal
router.get('/avaliacao', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('pages/ai-avaliacao', { user: req.session.user });
});

// POST /ai/avaliacao — avaliação corporal por imagem (visão do LLaMA 4)
router.post('/avaliacao', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ erro: 'Não autorizado.' });

    const { fotoFrontal, fotoLateral, fotoPosterior } = req.body;

    if (!fotoFrontal) {
        return res.status(400).json({ erro: 'A foto frontal é obrigatória.' });
    }

    const user = req.session.user;
    const imc  = user.imc || {};

    // Monta prompt com dados do perfil
    const perfilTexto = imc.peso
        ? `Dados do aluno: ${user.nome}, ${imc.idade || '?'} anos, ${imc.peso}kg, ${imc.altura}cm, IMC ${imc.imcValor || '?'}. Objetivo: ${imc.objetivo || 'não informado'}.`
        : `Dados do aluno: ${user.nome}. Perfil IMC não preenchido.`;

    const promptTexto = `${perfilTexto}

Analise a composição corporal do aluno pela(s) foto(s) enviadas e retorne SOMENTE um JSON válido, sem markdown, sem texto fora do JSON, com exatamente esta estrutura:
{
  "composicao": {
    "percentual_gordura_estimado": "X%",
    "margem_erro": "±Y%",
    "regiao_predominante": "abdominal | membros | uniforme",
    "massa_muscular_aparente": "baixa | moderada | alta"
  },
  "classificacao_imc_visual": "string descritiva",
  "pontos_positivos": ["...", "..."],
  "areas_melhoria": ["...", "..."],
  "recomendacoes": {
    "treino": "...",
    "nutricao": "..."
  },
  "aviso": "Esta análise é estimativa visual e não substitui avaliação profissional."
}`;

    // Monta array de content com texto + imagens
    const contentArr = [{ type: 'text', text: promptTexto }];

    // Adiciona cada foto como image_url (base64 já vem do frontend)
    [fotoFrontal, fotoLateral, fotoPosterior].forEach(foto => {
        if (foto && foto.startsWith('data:image')) {
            contentArr.push({ type: 'image_url', image_url: { url: foto } });
        }
    });

    try {
        // Chama diretamente a API REST da Groq (formato OpenAI vision)
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                messages: [{ role: 'user', content: contentArr }],
                temperature: 0.4,
                max_tokens: 1024
            })
        });

        const groqData = await response.json();

        if (!groqData.choices || !groqData.choices[0]) {
            console.error('Resposta inesperada da Groq:', groqData);
            return res.status(500).json({ erro: 'Erro ao processar a resposta da IA.' });
        }

        const rawText = groqData.choices[0].message.content.trim();

        // Remove markdown code fences se existirem
        const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        let resultado;
        try {
            resultado = JSON.parse(cleaned);
        } catch {
            console.error('Falha ao parsear JSON da IA:', rawText);
            return res.status(422).json({ erro: 'A IA não retornou um formato válido. Tente novamente com outra foto.' });
        }

        return res.json({ resultado });
    } catch (err) {
        console.error('Erro na avaliação corporal:', err.message);
        return res.status(500).json({ erro: 'Erro de conexão com a IA. Tente novamente.' });
    }
});

// POST /ai/avaliacao-salvar — salva o resultado da avaliação corporal na sessão
// (chamado pelo frontend após receber o resultado, para que o GymBot tenha acesso)
router.post('/avaliacao-salvar', (req, res) => {
    if (!req.session.user) return res.status(401).json({ erro: 'Não autorizado.' });

    const { resultado } = req.body;
    if (!resultado) return res.status(400).json({ erro: 'Resultado não informado.' });

    req.session.user.avaliacaoCorporal = {
        ...resultado,
        data: new Date().toLocaleDateString('pt-BR')
    };

    return res.json({ ok: true });
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
