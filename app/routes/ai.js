// ai.js — rotas do Personal Trainer IA (Groq)
const express          = require('express');
const router           = express.Router();
const Groq             = require('groq-sdk');
const requirePlanLevel = require('../middleware/requirePlanLevel');
const db               = require('../config/db');

// Planos gymbro e black têm acesso à IA
const requireIA = requirePlanLevel(['gymbro', 'black']);

const BASE_PROMPT = `Você é um personal trainer virtual chamado GymBot, assistente oficial do GymBros.
Você ajuda alunos com dúvidas sobre treinos, exercícios, nutrição básica e motivação.
Seja direto, motivador e use linguagem acessível. Responda sempre em português.`;

// Carrega perfil IMC do DB se a sessão não tiver (compatibilidade)
async function loadImcProfile(userId) {
    const [rows] = await db.execute(
        `SELECT * FROM imc_profile WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [userId]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
        peso:                  r.peso,
        altura:                r.altura,
        imcValor:              r.imc_valor,
        idade:                 r.idade,
        sexo:                  r.sexo,
        objetivo:              r.objetivo,
        experiencia:           r.experiencia,
        diasSemana:            r.dias_semana,
        tempoPorSessao:        r.tempo_por_sessao,
        localTreino:           r.local_treino,
        lesoes:                JSON.parse(r.lesoes || '[]'),
        restricoesAlimentares: JSON.parse(r.restricoes_alimentares || '[]'),
        suplementacao:         JSON.parse(r.suplementacao || '[]'),
        hidratacao:            r.hidratacao,
    };
}

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
router.get('/chat', requireIA, (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('pages/ai-chat', { user: req.session.user,
        seo: { title: 'GymBot Personal Trainer IA — GymBros', canonical: '/ai/chat', robots: 'noindex, nofollow', description: 'Converse com o GymBot, seu personal trainer IA.' },
    });
});

// GET /ai/avaliacao — renderiza a página de avaliação corporal
router.get('/avaliacao', requireIA, (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('pages/ai-avaliacao', { user: req.session.user,
        seo: { title: 'Avaliação Corporal IA — GymBros', canonical: '/ai/avaliacao', robots: 'noindex, nofollow', description: 'Avaliação corporal por inteligência artificial GymBros.' },
    });
});

// POST /ai/avaliacao — avaliação corporal por imagem (visão do LLaMA 4)
router.post('/avaliacao', requireIA, async (req, res) => {
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

// POST /ai/avaliacao-salvar — persiste avaliação no DB e na sessão
router.post('/avaliacao-salvar', requireIA, async (req, res) => {
    if (!req.session.user) return res.status(401).json({ erro: 'Não autorizado.' });

    const { resultado, fotoPath } = req.body;
    if (!resultado) return res.status(400).json({ erro: 'Resultado não informado.' });

    const c = resultado.composicao || {};
    try {
        await db.execute(
            `INSERT INTO body_photo
             (user_id, foto_path, consent_given, consent_at,
              gordura_total, gordura_tronco, gordura_braco, gordura_perna,
              margem_erro, analise_raw, modelo_ia)
             VALUES (?, ?, 1, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.session.user.id,
                fotoPath || null,
                c.percentual_gordura_estimado || null,
                c.regiao_predominante || null,
                c.massa_muscular_aparente || null,
                null,
                c.margem_erro || null,
                JSON.stringify(resultado),
                'llama-4-scout',
            ]
        );
    } catch (err) {
        console.error('[ai/avaliacao-salvar DB]', err.message);
        // Não bloqueia — salva na sessão mesmo assim
    }

    req.session.user.avaliacaoCorporal = {
        ...resultado,
        data: new Date().toLocaleDateString('pt-BR'),
    };

    return res.json({ ok: true });
});

// POST /ai/message — envia mensagem ao Groq e persiste sessão + mensagens no DB
router.post('/message', requireIA, async (req, res) => {
    if (!req.session.user) return res.status(401).json({ reply: 'Não autorizado.' });

    const { message } = req.body;
    if (!message || !message.trim()) return res.json({ reply: 'Por favor, envie uma mensagem.' });

    const userId = req.session.user.id;

    // Garante IMC na sessão (carrega do DB se não tiver)
    if (!req.session.user.imc) {
        req.session.user.imc = await loadImcProfile(userId).catch(() => null);
    }

    try {
        // Busca ou cria sessão ativa de IA
        const [sessions] = await db.execute(
            "SELECT * FROM ai_session WHERE user_id=? AND ativa=1 ORDER BY created_at DESC LIMIT 1",
            [userId]
        );

        let sessionId;
        if (sessions.length === 0) {
            const [[ctxRows]] = await db.execute('CALL sp_contexto_ia(?)', [userId]);
            const ctx = ctxRows?.[0] || { nome: req.session.user.nome, plano: req.session.user.plano };
            const [r] = await db.execute(
                'INSERT INTO ai_session (user_id, modelo, context_snapshot) VALUES (?, ?, ?)',
                [userId, 'llama-3.3-70b-versatile', JSON.stringify(ctx)]
            );
            sessionId = r.insertId;
        } else {
            sessionId = sessions[0].id;
        }

        // Salva mensagem do usuário
        await db.execute(
            'INSERT INTO ai_message (session_id, role, content) VALUES (?, "user", ?)',
            [sessionId, message]
        );

        const groq       = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
            model:    'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: buildSystemPrompt(req.session.user) },
                { role: 'user',   content: message },
            ],
        });

        const reply  = completion.choices[0].message.content;
        const tokens = completion.usage?.total_tokens || 0;

        // Salva resposta da IA
        await db.execute(
            'INSERT INTO ai_message (session_id, role, content, tokens) VALUES (?, "assistant", ?, ?)',
            [sessionId, reply, tokens]
        );
        await db.execute(
            'UPDATE ai_session SET total_mensagens=total_mensagens+2, total_tokens=total_tokens+? WHERE id=?',
            [tokens, sessionId]
        );

        return res.json({ reply });
    } catch (err) {
        console.error('Erro ao chamar Groq:', err.message);
        return res.json({ reply: 'Desculpe, não consegui processar sua mensagem. Tente novamente.' });
    }
});

module.exports = router;
