'use strict';

function getCookieLang() {
    const match = document.cookie
        .split('; ')
        .find(r => r.startsWith('gymbros_lang='));
    return match ? decodeURIComponent(match.split('=')[1]) : 'pt';
}

function setCookieLang(lang) {
    document.cookie = `gymbros_lang=${encodeURIComponent(lang)}; path=/; max-age=31536000; SameSite=Lax`;
}

const VALID_LANGS = ['pt', 'en', 'es'];

const dictionary = {
    /* ── navegação ─────────────────────────────────────── */
    'nav.home': { pt: 'Home', en: 'Home', es: 'Inicio' },
    'nav.academias': { pt: 'Academias', en: 'Gyms', es: 'Gimnasios' },
    'nav.about': { pt: 'Sobre nós', en: 'About us', es: 'Sobre nosotros' },
    'nav.planos': { pt: 'Planos e Preços', en: 'Plans & Pricing', es: 'Planes y Precios' },
    'nav.login': { pt: 'Entrar', en: 'Log in', es: 'Ingresar' },

    /* ── sidebar ────────────────────────────────────────── */
    'sidebar.painel':   { pt: 'Painel',              en: 'Dashboard',         es: 'Panel' },
    'sidebar.treinos':  { pt: 'Meus Treinos',        en: 'My Workouts',       es: 'Mis Entrenamientos' },
    'sidebar.evolucao': { pt: 'Evolução',            en: 'Progress',          es: 'Progreso' },
    'sidebar.plano':    { pt: 'Meu Plano',           en: 'My Plan',           es: 'Mi Plan' },
    'sidebar.config':   { pt: 'Configurações',       en: 'Settings',          es: 'Configuración' },
    'sidebar.ai':       { pt: 'Personal Trainer IA', en: 'AI Personal Trainer', es: 'Entrenador IA' },
    'sidebar.avaliacao':{ pt: 'Avaliação Corporal',  en: 'Body Assessment',   es: 'Evaluación Corporal' },
    'sidebar.imc':      { pt: 'Meu Perfil IMC',      en: 'My BMI Profile',    es: 'Mi Perfil IMC' },
    'sidebar.suporte':  { pt: 'Suporte',             en: 'Support',           es: 'Soporte' },
    'sidebar.role':     { pt: 'Aluno GymBros',       en: 'GymBros Member',    es: 'Miembro GymBros' },

    /* ── botões globais ─────────────────────────────────── */
    'btn.login':       { pt: 'Entrar',           en: 'Log in',        es: 'Ingresar' },
    'btn.register':    { pt: 'Registrar',        en: 'Register',      es: 'Registrarse' },
    'btn.save':        { pt: 'Salvar',           en: 'Save',          es: 'Guardar' },
    'btn.cancel':      { pt: 'Cancelar',         en: 'Cancel',        es: 'Cancelar' },
    'btn.next':        { pt: 'Avançar',          en: 'Next',          es: 'Siguiente' },
    'btn.back':        { pt: 'Voltar',           en: 'Back',          es: 'Atrás' },
    'btn.send':        { pt: 'Enviar',           en: 'Send',          es: 'Enviar' },
    'btn.logout':      { pt: 'Sair',             en: 'Log out',       es: 'Salir' },
    'btn.edit':        { pt: 'Editar',           en: 'Edit',          es: 'Editar' },
    'btn.geolocate':   { pt: 'Usar minha localização', en: 'Use my location', es: 'Usar mi ubicación' },
    'btn.subscribe':   { pt: 'Assinar',          en: 'Subscribe',     es: 'Suscribirse' },
    'btn.upgrade':     { pt: 'Upar de Plano',    en: 'Upgrade Plan',  es: 'Mejorar Plan' },
    'btn.cancel.plan': { pt: 'Cancelar Plano',   en: 'Cancel Plan',   es: 'Cancelar Plan' },

    /* ── formulários ────────────────────────────────────── */
    'form.name':       { pt: 'Nome completo',    en: 'Full name',         es: 'Nombre completo' },
    'form.email':      { pt: 'E-mail',           en: 'Email',             es: 'Correo electrónico' },
    'form.password':   { pt: 'Senha',            en: 'Password',          es: 'Contraseña' },
    'form.confirm.pw': { pt: 'Confirmar senha',  en: 'Confirm password',  es: 'Confirmar contraseña' },
    'form.cpf':        { pt: 'CPF (somente números)', en: 'CPF (numbers only)', es: 'CPF (solo números)' },
    'form.cep':        { pt: 'CEP',              en: 'Zip code',          es: 'Código postal' },
    'form.terms':      { pt: 'Aceito os termos de uso', en: 'I accept the terms of use', es: 'Acepto los términos de uso' },

    /* ── footer ─────────────────────────────────────────── */
    'footer.copy':    { pt: '© 2025 GymBros. Todos os direitos reservados.', en: '© 2025 GymBros. All rights reserved.', es: '© 2025 GymBros. Todos los derechos reservados.' },
    'footer.privacy': { pt: 'Política de Privacidade', en: 'Privacy Policy',   es: 'Política de Privacidad' },
    'footer.terms':   { pt: 'Termos de Serviço',       en: 'Terms of Service', es: 'Términos de Servicio' },
    'footer.faq':     { pt: 'FAQ',                     en: 'FAQ',              es: 'Preguntas Frecuentes' },

    /* ── index ──────────────────────────────────────────── */
    'index.why.title': {
        pt: 'POR QUE SE INSCREVER?',
        en: 'WHY SIGN UP?',
        es: '¿POR QUÉ INSCRIBIRSE?'
    },
    'index.why.desc': {
        pt: 'Atualmente, a rotina de exercícios físicos deixou de ser apenas uma questão de estética para tornar-se sinônimo de saúde e qualidade de vida. Entretanto, alguns experientes dificuldades para encontrar o espaço ou, até mesmo, a disposição adequada de exercitá-lo. Nessas situações, o GymBros é a melhor alternativa para quem deseja inverter seu paradigma com o exercício.',
        en: 'Today, physical exercise has gone beyond aesthetics to become a synonym for health and quality of life. However, some people struggle to find the right space or motivation to work out. In these situations, GymBros is the best alternative for those who want to change their relationship with exercise.',
        es: 'Hoy en día, la rutina de ejercicio físico ha dejado de ser solo una cuestión estética para convertirse en sinónimo de salud y calidad de vida. Sin embargo, algunas personas tienen dificultades para encontrar el espacio adecuado. En estas situaciones, GymBros es la mejor alternativa para quienes desean cambiar su relación con el ejercicio.'
    },
    'index.why.btn': { pt: 'VEJA MAIS', en: 'LEARN MORE', es: 'VER MÁS' },
    'index.mod.aerobico':   { pt: 'AERÓBICO',      en: 'AEROBICS',      es: 'AERÓBICO' },
    'index.mod.musculacao': { pt: 'MUSCULAÇÃO',    en: 'WEIGHT TRAINING', es: 'MUSCULACIÓN' },
    'index.mod.natacao':    { pt: 'NATAÇÃO',        en: 'SWIMMING',      es: 'NATACIÓN' },
    'index.mod.marciais':   { pt: 'ARTES MARCIAIS', en: 'MARTIAL ARTS',  es: 'ARTES MARCIALES' },
    'index.mod.fitdance':   { pt: 'FITDANCE',       en: 'FITDANCE',      es: 'FITDANCE' },
    'index.mod.meditacao':  { pt: 'MEDITAÇÃO',      en: 'MEDITATION',    es: 'MEDITACIÓN' },
    'index.partners.title': { pt: 'Academias Parceiras', en: 'Partner Gyms', es: 'Gimnasios Asociados' },
    'index.plans.title': {
        pt: 'UM PLANO. VÁRIAS ACADEMIAS. TREINOS DO SEU JEITO.',
        en: 'ONE PLAN. MULTIPLE GYMS. TRAINING YOUR WAY.',
        es: 'UN PLAN. VARIAS ACADEMIAS. ENTRENA A TU MANERA.'
    },
    'index.plans.desc': {
        pt: 'Com o GymBros Pass, você escolhe como e onde quer treinar, sem se prender a uma única academia. A gente cuida da flexibilidade, você cuida do foco. Conheça nossos planos e encontre o que combina com sua rotina',
        en: 'With GymBros Pass, you choose how and where to train, without being tied to one gym. We handle the flexibility, you handle the focus. Explore our plans and find the one that fits your routine.',
        es: 'Con GymBros Pass, eliges cómo y dónde entrenar, sin estar atado a un solo gimnasio. Nosotros nos encargamos de la flexibilidad, tú del enfoque. Conoce nuestros planes y encuentra el que se adapta a tu rutina.'
    },
    'index.plans.btn': { pt: 'VER PLANOS', en: 'SEE PLANS', es: 'VER PLANES' },

    /* ── sobre (about) ──────────────────────────────────── */
    'about.history.title': { pt: 'Nossa História', en: 'Our Story', es: 'Nuestra Historia' },
    'about.history.desc': {
        pt: 'Fundada com o objetivo de transformar a forma como as pessoas encaram o exercício físico, a GymBros nasceu da ideia de unir qualidade, flexibilidade e comunidade. Queremos que cada treino seja uma experiência única, que inspire nossos alunos a cuidar da saúde e se superar todos os dias.',
        en: 'Founded with the goal of transforming how people approach physical exercise, GymBros was born from the idea of uniting quality, flexibility and community. We want every workout to be a unique experience that inspires our members to take care of their health and surpass themselves every day.',
        es: 'Fundada con el objetivo de transformar la forma en que las personas abordan el ejercicio físico, GymBros nació de la idea de unir calidad, flexibilidad y comunidad. Queremos que cada entrenamiento sea una experiencia única que inspire a nuestros alumnos a cuidar su salud y superarse cada día.'
    },
    'about.mission.title': { pt: 'Missão',  en: 'Mission', es: 'Misión' },
    'about.mission.desc': {
        pt: 'Proporcionar aos nossos alunos acesso a academias de qualidade, promovendo saúde, bem-estar e motivação contínua.',
        en: 'Provide our members with access to quality gyms, promoting health, well-being and continuous motivation.',
        es: 'Proporcionar a nuestros alumnos acceso a gimnasios de calidad, promoviendo la salud, el bienestar y la motivación continua.'
    },
    'about.vision.title': { pt: 'Visão', en: 'Vision', es: 'Visión' },
    'about.vision.desc': {
        pt: 'Ser referência em academias flexíveis e inovadoras, conectando pessoas e fortalecendo uma comunidade saudável.',
        en: 'To be a reference in flexible and innovative gyms, connecting people and strengthening a healthy community.',
        es: 'Ser referencia en gimnasios flexibles e innovadores, conectando personas y fortaleciendo una comunidad saludable.'
    },
    'about.values.title': { pt: 'Valores', en: 'Values', es: 'Valores' },
    'about.values.desc': {
        pt: 'Compromisso, Flexibilidade, Inovação, Respeito e Paixão pelo exercício físico.',
        en: 'Commitment, Flexibility, Innovation, Respect and Passion for physical exercise.',
        es: 'Compromiso, Flexibilidad, Innovación, Respeto y Pasión por el ejercicio físico.'
    },
    'about.team.title': { pt: 'Conheça nossa equipe', en: 'Meet our team', es: 'Conoce a nuestro equipo' },
    'about.cta.title':  { pt: 'Venha treinar com a gente!', en: 'Come train with us!', es: '¡Ven a entrenar con nosotros!' },
    'about.cta.desc': {
        pt: 'Descubra como é fácil manter a disciplina e a motivação quando você tem suporte, comunidade e flexibilidade.',
        en: 'Discover how easy it is to maintain discipline and motivation when you have support, community and flexibility.',
        es: 'Descubre lo fácil que es mantener la disciplina y la motivación cuando tienes apoyo, comunidad y flexibilidad.'
    },
    'about.cta.btn': { pt: 'VEJA NOSSOS PLANOS', en: 'SEE OUR PLANS', es: 'VER NUESTROS PLANES' },

    /* ── planos ─────────────────────────────────────────── */
    'plans.hero.title': {
        pt: 'PLANOS E PREÇOS DO GYMBROS',
        en: 'GYMBROS PLANS & PRICING',
        es: 'PLANES Y PRECIOS DE GYMBROS'
    },
    'plans.hero.desc': {
        pt: 'O maior site de saúde e bem-estar do mundo, com melhores preços acessíveis para todos',
        en: 'The world\'s largest health and wellness platform, with the best prices accessible to everyone',
        es: 'El mayor sitio de salud y bienestar del mundo, con los mejores precios accesibles para todos'
    },
    'plans.no_plan': {
        pt: 'Você ainda não possui um plano ativo. Escolha um plano para acessar a área do aluno.',
        en: 'You don\'t have an active plan yet. Choose a plan to access the member area.',
        es: 'Aún no tienes un plan activo. Elige un plan para acceder al área del alumno.'
    },
    'plans.starter.f1': { pt: '2300+ Academias e estúdios',     en: '2300+ Gyms and studios',   es: '2300+ Gimnasios y estudios' },
    'plans.starter.f2': { pt: 'Treinos online e presenciais',    en: 'Online and in-person workouts', es: 'Entrenamientos online y presenciales' },
    'plans.gymbro.f1':  { pt: '3560+ Academias e estúdios',     en: '3560+ Gyms and studios',   es: '3560+ Gimnasios y estudios' },
    'plans.gymbro.f2':  { pt: 'Treinos online ao vivo',          en: 'Live online workouts',     es: 'Entrenamientos online en vivo' },
    'plans.gymbro.f3':  { pt: 'Leve 4 amigos por mês',          en: 'Bring 4 friends per month', es: 'Lleva 4 amigos por mes' },
    'plans.gymbro.f4':  { pt: 'Personal trainer online',        en: 'Online personal trainer',  es: 'Entrenador personal online' },
    'plans.black.f1':   { pt: 'Acesso ilimitado em academias parceiras', en: 'Unlimited access at partner gyms', es: 'Acceso ilimitado en gimnasios asociados' },
    'plans.black.f2':   { pt: '+5000 Academias e estúdios',     en: '+5000 Gyms and studios',   es: '+5000 Gimnasios y estudios' },
    'plans.black.f3':   { pt: 'Treinos online e presenciais',   en: 'Online and in-person workouts', es: 'Entrenamientos online y presenciales' },
    'plans.black.f4':   { pt: 'Aulas exclusivas e personal trainer', en: 'Exclusive classes and personal trainer', es: 'Clases exclusivas y entrenador personal' },
    'plans.black.f5':   { pt: 'Área VIP e benefícios premium',  en: 'VIP area and premium benefits', es: 'Área VIP y beneficios premium' },
    'plans.btn.subscribe': { pt: 'Assinar agora', en: 'Subscribe now', es: 'Suscribirse ahora' },
    'plans.price.month':   { pt: '/mês',          en: '/month',        es: '/mes' }
};

let currentLang = localStorage.getItem('gymbros_lang') || getCookieLang() || 'pt';
if (!VALID_LANGS.includes(currentLang)) currentLang = 'pt';

function updateLangButtons(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
}

function setElementText(el, text) {
    const hasElementChild = Array.from(el.childNodes).some(n => n.nodeType === Node.ELEMENT_NODE);
    const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
    if (textNodes.length > 0) {
        textNodes[textNodes.length - 1].textContent = hasElementChild ? ' ' + text : text;
    } else {
        el.appendChild(document.createTextNode(text));
    }
}

function applyDictionary(lang) {
    document.querySelectorAll('[data-i18n], [data-translate]').forEach(el => {
        const key = el.dataset.i18n || el.dataset.translate;
        const translation = dictionary[key]?.[lang];
        if (!translation) return;
        setElementText(el, translation);
    });
}

function applyDictionaryAttributes(lang) {
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const t = dictionary[el.dataset.i18nPlaceholder]?.[lang];
        if (t) el.setAttribute('placeholder', t);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const t = dictionary[el.dataset.i18nTitle]?.[lang];
        if (t) el.setAttribute('title', t);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        const t = dictionary[el.dataset.i18nAriaLabel]?.[lang];
        if (t) el.setAttribute('aria-label', t);
    });
}

function translatePage(lang) {
    applyDictionary(lang);
    applyDictionaryAttributes(lang);
}

function switchLanguage(lang) {
    if (!VALID_LANGS.includes(lang) || lang === currentLang) return;
    localStorage.setItem('gymbros_lang', lang);
    window.location.href = '/lang/' + lang;
}

window.changeLang        = switchLanguage;
window.switchLanguage    = switchLanguage;
window.translatePage     = translatePage;
window.applyDictionary   = applyDictionary;

document.addEventListener('DOMContentLoaded', () => {
    setCookieLang(currentLang);
    updateLangButtons(currentLang);
    translatePage(currentLang);

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => switchLanguage(btn.dataset.lang));
    });
});
