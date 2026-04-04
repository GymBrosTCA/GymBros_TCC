/**
 * translate.js — tradução de página completa GymBros
 * Estratégia:
 *   1. Dicionário estático para strings de UI conhecidas (data-translate)
 *   2. TreeWalker coleta TODOS os nós de texto da página
 *   3. Chama POST /api/translate em lote para traduzir o restante
 *   4. Restaura textos originais ao voltar para PT
 *   5. Cache por página+idioma em sessionStorage
 */
'use strict';

// ── Dicionário estático ──────────────────────────────────────────────────────
const DICT = {
    'nav.home':        { pt: 'Home',        en: 'Home',         es: 'Inicio' },
    'nav.academias':   { pt: 'Academias',   en: 'Gyms',         es: 'Gimnasios' },
    'nav.about':       { pt: 'Sobre nós',   en: 'About us',     es: 'Sobre nosotros' },
    'nav.planos':      { pt: 'Planos e Preços', en: 'Plans & Pricing', es: 'Planes y Precios' },
    'nav.login':       { pt: 'Entrar',      en: 'Log in',       es: 'Ingresar' },

    'sidebar.painel':   { pt: 'Painel',      en: 'Dashboard',    es: 'Panel' },
    'sidebar.treinos':  { pt: 'Meus Treinos', en: 'My Workouts', es: 'Mis Entrenamientos' },
    'sidebar.evolucao': { pt: 'Evolução',    en: 'Progress',     es: 'Progreso' },
    'sidebar.plano':    { pt: 'Meu Plano',   en: 'My Plan',      es: 'Mi Plan' },
    'sidebar.config':   { pt: 'Configurações', en: 'Settings',   es: 'Configuración' },
    'sidebar.ai':       { pt: 'Personal Trainer IA', en: 'AI Personal Trainer', es: 'Entrenador IA' },
    'sidebar.avaliacao':{ pt: 'Avaliação Corporal', en: 'Body Assessment', es: 'Evaluación Corporal' },
    'sidebar.imc':      { pt: 'Meu Perfil IMC', en: 'My BMI Profile', es: 'Mi Perfil IMC' },
    'sidebar.suporte':  { pt: 'Suporte', en: 'Support', es: 'Soporte' },
    'sidebar.role':     { pt: 'Aluno GymBros', en: 'GymBros Member', es: 'Miembro GymBros' },

    'btn.login':       { pt: 'Entrar',       en: 'Log in',       es: 'Ingresar' },
    'btn.register':    { pt: 'Registrar',    en: 'Register',     es: 'Registrarse' },
    'btn.save':        { pt: 'Salvar',       en: 'Save',         es: 'Guardar' },
    'btn.cancel':      { pt: 'Cancelar',     en: 'Cancel',       es: 'Cancelar' },
    'btn.next':        { pt: 'Avançar',      en: 'Next',         es: 'Siguiente' },
    'btn.back':        { pt: 'Voltar',       en: 'Back',         es: 'Atrás' },
    'btn.send':        { pt: 'Enviar',       en: 'Send',         es: 'Enviar' },
    'btn.logout':      { pt: 'Sair',         en: 'Log out',      es: 'Salir' },
    'btn.edit':        { pt: 'Editar',       en: 'Edit',         es: 'Editar' },
    'btn.geolocate':   { pt: 'Usar minha localização', en: 'Use my location', es: 'Usar mi ubicación' },
    'btn.subscribe':   { pt: 'Assinar',      en: 'Subscribe',    es: 'Suscribirse' },
    'btn.upgrade':     { pt: 'Upar de Plano', en: 'Upgrade Plan', es: 'Mejorar Plan' },
    'btn.cancel.plan': { pt: 'Cancelar Plano', en: 'Cancel Plan', es: 'Cancelar Plan' },

    'form.name':       { pt: 'Nome completo', en: 'Full name',   es: 'Nombre completo' },
    'form.email':      { pt: 'E-mail',        en: 'Email',       es: 'Correo electrónico' },
    'form.password':   { pt: 'Senha',         en: 'Password',    es: 'Contraseña' },
    'form.confirm.pw': { pt: 'Confirmar senha', en: 'Confirm password', es: 'Confirmar contraseña' },
    'form.cpf':        { pt: 'CPF (somente números)', en: 'CPF (numbers only)', es: 'CPF (solo números)' },
    'form.cep':        { pt: 'CEP',           en: 'Zip code',    es: 'Código postal' },
    'form.terms':      { pt: 'Aceito os termos de uso', en: 'I accept the terms of use', es: 'Acepto los términos de uso' },

    'footer.copy': {
        pt: '© 2025 GymBros. Todos os direitos reservados.',
        en: '© 2025 GymBros. All rights reserved.',
        es: '© 2025 GymBros. Todos los derechos reservados.'
    },
    'footer.privacy': { pt: 'Política de Privacidade', en: 'Privacy Policy',  es: 'Política de Privacidad' },
    'footer.terms':   { pt: 'Termos de Serviço',       en: 'Terms of Service', es: 'Términos de Servicio' },
    'footer.faq':     { pt: 'FAQ',                     en: 'FAQ',              es: 'Preguntas Frecuentes' },
};

// ── Estado global ─────────────────────────────────────────────────────────────
let currentLang = localStorage.getItem('gymbros_lang') || 'pt';

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
                // Pula elementos já tratados pelo dicionário estático
                if (par.dataset && (par.dataset.translate || par.dataset.translateApi)) {
                    return NodeFilter.FILTER_REJECT;
                }
                const text = node.textContent.trim();
                // Só textos com letras reais (não números/símbolos sozinhos)
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

// ── Dicionário estático: aplica em elementos data-translate ───────────────────
function applyDictionary(lang) {
    document.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.dataset.translate;
        if (!DICT[key]?.[lang]) return;
        const val = DICT[key][lang];
        // Preserva ícones <i> filhos — atualiza só os nós de texto
        if (el.children.length > 0) {
            const tNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
            if (tNodes.length) {
                tNodes[tNodes.length - 1].textContent = ' ' + val;
            }
        } else {
            el.textContent = val;
        }
    });
}

// ── Tradução de página inteira via API ────────────────────────────────────────
async function translatePage(lang) {
    if (!textNodes.length) return;

    // Restaura originais (sempre, para garantir base limpa)
    textNodes.forEach(({ node, orig }) => { node.textContent = orig; });

    if (lang === 'pt') return; // PT é a base

    const pageKey = `gymbros_page_${lang}_${location.pathname}`;
    const cached  = sessionStorage.getItem(pageKey);

    if (cached) {
        try {
            const saved = JSON.parse(cached);
            textNodes.forEach(({ node }, i) => {
                if (saved[i] != null) node.textContent = saved[i];
            });
        } catch (e) { /* cache corrompido — ignora */ }
        return;
    }

    // Coleta textos únicos para enviar (filtra whitespace puro)
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

// ── Atualiza botões de idioma ─────────────────────────────────────────────────
function updateLangButtons(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
}

// ── Troca de idioma ───────────────────────────────────────────────────────────
function switchLanguage(lang) {
    if (lang === currentLang) return;
    currentLang = lang;
    localStorage.setItem('gymbros_lang', lang);
    updateLangButtons(lang);
    applyDictionary(lang);
    translatePage(lang);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    collectTextNodes();

    applyDictionary(currentLang);
    updateLangButtons(currentLang);
    if (currentLang !== 'pt') {
        translatePage(currentLang);
    }

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => switchLanguage(btn.dataset.lang));
    });
});
