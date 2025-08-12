
  const header = document.querySelector('.gymbros-header');
  const headerTop = header.offsetTop;

  window.addEventListener('scroll', () => {
    if (window.scrollY > headerTop) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

