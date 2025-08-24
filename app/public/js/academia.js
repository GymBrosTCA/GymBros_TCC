// Seleciona todas as cards
const academiaCards = document.querySelectorAll('.academia-card');

// Links de embed do Google Maps para cada academia
const mapsLinks = [
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3675.187736417724!2d-46.85687468418768!3d-23.500413733021098!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94cf03002e66d28f%3A0x936d2b2c4ffbe0a9!2sSkyfit!5e0!3m2!1spt-BR!2sbr!4v1692864000000!5m2!1spt-BR!2sbr",
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3675.123456789!2d-46.881995!3d-23.511172!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94cf03fc39784d6b%3A0xc488a7541fabe0eb!2sSmart%20Fit%20Barueri!5e0!3m2!1spt-BR!2sbr!4v1692864000000!5m2!1spt-BR!2sbr",
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3675.567891234!2d-46.8680816!3d-23.5061933!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94cf036e0b0789df%3A0xe6bb70ecd3d28a49!2sBluefit%20Barueri!5e0!3m2!1spt-BR!2sbr!4v1692864000000!5m2!1spt-BR!2sbr",
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3675.678912345!2d-46.882494!3d-23.4926318!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94cf0300220f82e1%3A0xabd5ebdfa4b96bd8!2sPanobianco%20Capit%C3%A3o%20Francisco!5e0!3m2!1spt-BR!2sbr!4v1692864000000!5m2!1spt-BR!2sbr",
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3675.198765432!2d-46.8537846!3d-23.5005887!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94cf03fde9d10e27%3A0xbb36f67fc4eb14b3!2sGavi%C3%B5es%2024h%20Alphaville!5e0!3m2!1spt-BR!2sbr!4v1692864000000!5m2!1spt-BR!2sbr",
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3675.987654321!2d-46.8684228!3d-23.5325484!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94cf0177d62afce7%3A0xb5c16e19f8102253!2sFokar%20Academia!5e0!3m2!1spt-BR!2sbr!4v1692864000000!5m2!1spt-BR!2sbr"
];

// Adiciona evento de clique para cada card
academiaCards.forEach((card, index) => {
    card.addEventListener('click', () => {
        // Fecha outras cards abertas e remove seus mapas
        academiaCards.forEach((c, i) => {
            if (c !== card) {
                c.classList.remove('expanded');
                const mapa = c.querySelector('.academia-mapa');
                if (mapa) mapa.innerHTML = "";
            }
        });

        const mapaContainer = card.querySelector('.academia-mapa');

        if (!card.classList.contains('expanded')) {
            // Adiciona iframe do Google Maps ao expandir
            mapaContainer.innerHTML = `<iframe src="${mapsLinks[index]}" width="100%" height="250" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
        } else {
            // Remove mapa se clicar novamente
            mapaContainer.innerHTML = "";
        }

        card.classList.toggle('expanded');
    });
});
