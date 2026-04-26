'use strict';

// Lê locale atual do cookie gymbros_lang (definido server-side pelo i18n)
function getCookieLang() {
    const match = document.cookie.split('; ').find(r => r.startsWith('gymbros_lang='));
    return match ? match.split('=')[1] : 'pt';
}

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
    currentLang = lang;
    localStorage.setItem('gymbros_lang', lang);
    updateLangButtons(lang);
    applyDictionary(lang);
    translatePage(lang);
}

// Expõe globalmente para uso em config.js
window.changeLang = switchLanguage;

document.addEventListener('DOMContentLoaded', () => {
    updateLangButtons(currentLang);
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => switchLanguage(btn.dataset.lang));
    });
});
