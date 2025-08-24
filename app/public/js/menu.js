document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menuToggle');
    const sideMenu = document.getElementById('sideMenu');
    const closeMenu = document.getElementById('closeMenu');
    const menuOverlay = document.getElementById('menuOverlay');

    // Abrir menu
    menuToggle.addEventListener('click', function() {
        sideMenu.classList.add('open');
        menuOverlay.classList.add('open');
    });

    // Fechar menu
    closeMenu.addEventListener('click', function() {
        sideMenu.classList.remove('open');
        menuOverlay.classList.remove('open');
    });

    // Fechar menu ao clicar no overlay
    menuOverlay.addEventListener('click', function() {
        sideMenu.classList.remove('open');
        menuOverlay.classList.remove('open');
    });

    // Efeito de scroll no header 
    window.addEventListener('scroll', function() {
        const header = document.querySelector('.gymbros-header');
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
});