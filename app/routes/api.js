// api.js — endpoints auxiliares (tradução, etc.)
'use strict';

const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Cache em memória: { "<lang>:<hash>" : "texto traduzido" }
const translationCache = new Map();

function cacheKey(text, lang) {
    // chave simples sem dependência externa
    return `${lang}:${Buffer.from(text).toString('base64').slice(0, 40)}`;
}

// ── POST /api/translate ─────────────────────────────────────────────────────
// Body: { text: string | string[], targetLanguage: "en" | "es" | "pt" }
router.post('/translate', async (req, res) => {
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
        return res.status(400).json({ error: 'text e targetLanguage são obrigatórios.' });
    }

    // Normaliza para array
    const texts  = Array.isArray(text) ? text : [text];
    const lang   = targetLanguage.toLowerCase().slice(0, 2);
    const langNames = { en: 'English', es: 'Spanish', pt: 'Portuguese (Brazilian)' };
    const langFull  = langNames[lang] || 'English';

    // Verifica se tudo já está em cache
    const results = new Array(texts.length).fill(null);
    const uncached = [];

    texts.forEach((t, i) => {
        const k = cacheKey(t, lang);
        if (translationCache.has(k)) {
            results[i] = translationCache.get(k);
        } else {
            uncached.push({ i, t, k });
        }
    });

    if (uncached.length === 0) {
        return res.json({ translations: results });
    }

    // Chama Groq para textos não cacheados (em lote)
    const batchText = uncached.map(({ i, t }) => `[${i}] ${t}`).join('\n');

    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [
                {
                    role: 'system',
                    content: `You are a professional translator specializing in fitness and sports content.
Translate the provided texts to ${langFull}.
Each line starts with [N] where N is the index.
Return ONLY the translated lines in the same [N] format.
Preserve HTML tags, placeholders, and special characters exactly.
Keep the same tone: friendly, motivating, professional.`
                },
                { role: 'user', content: batchText }
            ],
            temperature: 0.2,
            max_tokens: 2000
        });

        const raw = completion.choices[0]?.message?.content || '';

        // Parseia resposta [N] texto
        const lines = raw.split('\n').filter(l => l.trim());
        lines.forEach(line => {
            const m = line.match(/^\[(\d+)\]\s*(.*)/);
            if (m) {
                const idx  = parseInt(m[1], 10);
                const item = uncached.find(u => u.i === idx);
                if (item) {
                    const translated = m[2].trim();
                    translationCache.set(item.k, translated);
                    results[idx] = translated;
                }
            }
        });

        // Fallback: se algum não foi parseado, usa original
        results.forEach((r, i) => { if (r === null) results[i] = texts[i]; });

        return res.json({ translations: results });

    } catch (err) {
        console.error('[/api/translate]', err.message);
        // Em caso de erro retorna os originais para não quebrar a UI
        return res.json({ translations: texts });
    }
});

// ── GET /api/health ─────────────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({ status: 'ok', cache: translationCache.size }));

module.exports = router;
