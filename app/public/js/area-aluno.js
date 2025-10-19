const sideMenu = document.getElementById('sideMenu');
const menuOverlay = document.getElementById('menuOverlay');
const closeMenu = document.getElementById('closeMenu');
const openMenuBtn = document.getElementById('openMenu'); // botão de abrir no header
const usernameDisplay = document.getElementById("usernameDisplay");
const logoutBtn = document.getElementById("logoutBtn");

// Mock login
const mockUser = { nome: "Davi" };
usernameDisplay.textContent = mockUser.nome;

// Logout (mock)
logoutBtn.addEventListener("click", () => {
  alert("Logout realizado!");
  window.location.href = "/login";
});

// ==============================
// MENU HAMBURGUER
// ==============================
if(openMenuBtn && closeMenuBtn){
    openMenuBtn.addEventListener('click', () => {
        sideMenu.style.transform = 'translateX(0)';
    });

    closeMenuBtn.addEventListener('click', () => {
        sideMenu.style.transform = 'translateX(-100%)';
    });
}

// ==============================
// PROGRESS BARS ANIMADAS
// ==============================
document.querySelectorAll('.progress-fill').forEach(fill => {
    const width = fill.style.width || '0%';
    fill.style.width = '0%';
    setTimeout(() => {
        fill.style.width = width;
    }, 100);
});

// ==============================
// GRÁFICO DE EVOLUÇÃO
// ==============================
document.querySelectorAll('.line-graph').forEach(canvas => {
    const ctx = canvas.getContext('2d');
    const data = [20, 35, 40, 50, 70, 60, 80]; // dados de exemplo
    const max = Math.max(...data);
    const spacing = canvas.width / (data.length - 1);
    const radius = 4;

    const points = data.map((val, i) => ({x: i*spacing, y: canvas.height - (val/max)*canvas.height}));

    let progress = 0;

    function drawLine() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        // Linha suave usando Bezier simples
        for(let i=0; i<points.length-1; i++){
            const cpX = (points[i].x + points[i+1].x)/2;
            ctx.bezierCurveTo(cpX, points[i].y, cpX, points[i+1].y, points[i+1].x, points[i+1].y);
        }

        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Pontos animados
        for(let i=0; i<points.length; i++){
            if(i/(points.length-1) <= progress){
                ctx.beginPath();
                ctx.arc(points[i].x, points[i].y, radius, 0, 2*Math.PI);
                ctx.fillStyle = '#FFD700';
                ctx.fill();
            }
        }

        if(progress < 1){
            progress += 0.01;
            requestAnimationFrame(drawLine);
        }
    }

    drawLine();

    // Tooltip
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        drawLine();
        points.forEach((p,i)=>{
            if(Math.abs(x - p.x) < spacing/2){
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.fillText(`Valor: ${data[i]}`, p.x - 15, p.y - 10);
            }
        });
    });
});
