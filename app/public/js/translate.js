'use strict';

// Lê locale atual do cookie gymbros_lang (definido server-side pelo i18n)
function getCookieLang() {
    const match = document.cookie.split('; ').find(r => r.startsWith('gymbros_lang='));
    return match ? match.split('=')[1] : 'pt';
}

let currentLang = getCookieLang();

function updateLangButtons(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
}

// Grava o cookie (lido pelo middleware i18n no próximo request) e recarrega
// a página para que o servidor renderize as strings estáticas no novo locale.
function switchLanguage(lang) {
    if (lang === currentLang) return;
    document.cookie = `gymbros_lang=${lang}; path=/; max-age=${365 * 24 * 3600}`;
    location.reload();
}

// Expõe globalmente para uso em config.js
window.changeLang = switchLanguage;

document.addEventListener('DOMContentLoaded', () => {
    updateLangButtons(currentLang);
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => switchLanguage(btn.dataset.lang));
    });
});
