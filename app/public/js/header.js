
const header = document.querySelector('.gymbros-header');
const headerTop = header.offsetTop;

window.addEventListener('scroll', () => {
    if (window.scrollY > headerTop) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// ── Tema claro/escuro ──
(function () {
    const toggle   = document.getElementById('themeToggle');
    const icon     = document.getElementById('themeIcon');
    const saved    = localStorage.getItem('gymbros_theme');

    if (saved === 'light') {
        document.body.classList.add('light-mode');
        if (icon) { icon.classList.replace('fa-sun', 'fa-moon'); }
    }

    if (toggle) {
        toggle.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-mode');
            localStorage.setItem('gymbros_theme', isLight ? 'light' : 'dark');
            if (icon) {
                icon.classList.toggle('fa-sun',  !isLight);
                icon.classList.toggle('fa-moon',  isLight);
            }
        });
    }
})();
