/**
 * translate.js — tradução dinâmica de conteúdo GymBros
 *
 * Strings estáticas de UI (nav, sidebar, footer, botões, formulários)
 * agora são renderizadas server-side pelo pacote `i18n` via __().
 *
 * Este módulo cuida apenas de:
 *   1. Tradução dinâmica de conteúdo de página via POST /api/translate (Groq)
 *   2. Atualização visual dos botões de idioma ativos
 *   3. Troca de idioma: grava cookie gymbros_lang + recarrega a página
 *      para que o servidor re-renderize com o locale correto.
 */
'use strict';

// ── Lê locale atual do cookie (definido server-side pelo i18n) ───────────────
function getCookieLang() {
    const match = document.cookie.split('; ').find(r => r.startsWith('gymbros_lang='));
    return match ? match.split('=')[1] : 'pt';
}

let currentLang = getCookieLang();

// Nós de texto coletados no carregamento: [{ node, orig }]
const textNodes = [];

// Tags cujo conteúdo NÃO deve ser traduzido
const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE',
    'INPUT', 'SELECT', 'OPTION', 'CANVAS', 'SVG'
]);

// ── Coleta todos os nós de texto relevantes ───────────────────────────────────
function collectTextNodes() {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const par = node.parentElement;
                if (!par) return NodeFilter.FILTER_REJECT;
                if (SKIP_TAGS.has(par.tagName)) return NodeFilter.FILTER_REJECT;
                if (par.dataset && par.dataset.translateApi) return NodeFilter.FILTER_REJECT;
                const text = node.textContent.trim();
                if (text.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(text)) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
    let n;
    while ((n = walker.nextNode())) {
        textNodes.push({ node: n, orig: n.textContent });
    }
}

// ── Tradução de página inteira via API (Groq) ─────────────────────────────────
async function translatePage(lang) {
    if (!textNodes.length) return;

    textNodes.forEach(({ node, orig }) => { node.textContent = orig; });

    if (lang === 'pt') return;

    const pageKey = `gymbros_page_${lang}_${location.pathname}`;
    const cached  = sessionStorage.getItem(pageKey);

    if (cached) {
        try {
            const saved = JSON.parse(cached);
            textNodes.forEach(({ node }, i) => {
                if (saved[i] != null) node.textContent = saved[i];
            });
        } catch (e) { /* cache corrompido */ }
        return;
    }

    const texts = textNodes.map(({ node }) => node.textContent.trim());
    const valid = texts.filter(t => t.length > 1);
    if (!valid.length) return;

    try {
        const res  = await fetch('/api/translate', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ text: valid, targetLanguage: lang })
        });
        const data = await res.json();

        if (data.translations) {
            let tIdx = 0;
            const result = [];
            textNodes.forEach(({ node }, i) => {
                if (texts[i].length > 1 && data.translations[tIdx] != null) {
                    node.textContent = data.translations[tIdx];
                    result[i] = data.translations[tIdx];
                    tIdx++;
                } else {
                    result[i] = node.textContent;
                }
            });
            sessionStorage.setItem(pageKey, JSON.stringify(result));
        }
    } catch (e) {
        console.warn('[translate.js] Erro na API:', e.message);
    }
}

// ── Atualiza botões de idioma ativos ──────────────────────────────────────────
function updateLangButtons(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
}

// ── Troca de idioma ───────────────────────────────────────────────────────────
// Grava o cookie (lido pelo middleware i18n no próximo request) e recarrega
// a página para que o servidor renderize as strings estáticas no novo locale.
function switchLanguage(lang) {
    if (lang === currentLang) return;
    document.cookie = `gymbros_lang=${lang}; path=/; max-age=${365 * 24 * 3600}`;
    location.reload();
}

// Expõe globalmente para uso em config.js
window.changeLang = switchLanguage;

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    collectTextNodes();
    updateLangButtons(currentLang);

    if (currentLang !== 'pt') {
        translatePage(currentLang);
    }

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => switchLanguage(btn.dataset.lang));
    });
});
