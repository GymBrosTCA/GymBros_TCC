const carrossel = document.getElementById('carrossel');
const img = carrossel.querySelector('img');
const imgWidth = img.offsetWidth + 20; // largura da imagem + gap (20px)

let isDragging = false;
let startX;
let scrollStart;

[...carrossel.children].forEach(item => {
  const clone = item.cloneNode(true);
  carrossel.appendChild(clone);
});

let autoScrollInterval = setInterval(() => {
  if (!isDragging) {
    carrossel.scrollLeft += imgWidth;
    if (carrossel.scrollLeft >= carrossel.scrollWidth / 2) {
      carrossel.scrollLeft -= carrossel.scrollWidth / 2;
    }
  }
}, 2000);

function resetAutoScroll() {
  clearInterval(autoScrollInterval);
  autoScrollInterval = setInterval(() => {
    if (!isDragging) {
      carrossel.scrollLeft += imgWidth;
      if (carrossel.scrollLeft >= carrossel.scrollWidth / 2) {
        carrossel.scrollLeft -= carrossel.scrollWidth / 2;
      }
    }
  }, 2000);
}


carrossel.addEventListener('mousedown', (e) => {
  isDragging = true;
  startX = e.pageX - carrossel.offsetLeft;
  scrollStart = carrossel.scrollLeft;
  carrossel.style.cursor = 'grabbing';
  clearInterval(autoScrollInterval); 
});

carrossel.addEventListener('mouseup', () => {
  isDragging = false;
  carrossel.style.cursor = 'grab';
  resetAutoScroll();
});

carrossel.addEventListener('mouseleave', () => {
  if (isDragging) {
    isDragging = false;
    carrossel.style.cursor = 'grab';
    resetAutoScroll();
  }
});

carrossel.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  e.preventDefault();
  const x = e.pageX - carrossel.offsetLeft;
  const walk = (x - startX) * 2; 
  carrossel.scrollLeft = scrollStart - walk;

  if (carrossel.scrollLeft >= carrossel.scrollWidth / 2) {
    carrossel.scrollLeft -= carrossel.scrollWidth / 2;
  } else if (carrossel.scrollLeft <= 0) {
    carrossel.scrollLeft += carrossel.scrollWidth / 2;
  }
});

carrossel.addEventListener('touchstart', (e) => {
  isDragging = true;
  startX = e.touches[0].pageX - carrossel.offsetLeft;
  scrollStart = carrossel.scrollLeft;
  clearInterval(autoScrollInterval);
});

carrossel.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  const x = e.touches[0].pageX - carrossel.offsetLeft;
  const walk = (x - startX) * 2;
  carrossel.scrollLeft = scrollStart - walk;

  if (carrossel.scrollLeft >= carrossel.scrollWidth / 2) {
    carrossel.scrollLeft -= carrossel.scrollWidth / 2;
  } else if (carrossel.scrollLeft <= 0) {
    carrossel.scrollLeft += carrossel.scrollWidth / 2;
  }
});

carrossel.addEventListener('touchend', () => {
  isDragging = false;
  resetAutoScroll();
});
