// ==============================
// ANIMAÇÃO DE PROGRESSO
// ==============================
document.querySelectorAll('.progress-fill').forEach(fill => {
    const width = fill.style.width || '0%';
    fill.style.width = '0%';
    setTimeout(() => {
        fill.style.width = width;
    }, 200);
});

// ==============================
// GRÁFICO DE BARRAS - "Meus Treinos"
// ==============================
const treinoCanvas = document.querySelectorAll('.line-graph')[0];
if (treinoCanvas) {
    const ctx = treinoCanvas.getContext('2d');
    const data = [4, 5, 3, 6, 7, 5, 8]; // Treinos semanais
    const max = Math.max(...data);
    const barWidth = 18;
    const spacing = (treinoCanvas.width - data.length * barWidth) / (data.length + 1);

    let progress = 0;

    function drawBars() {
        ctx.clearRect(0, 0, treinoCanvas.width, treinoCanvas.height);
        data.forEach((val, i) => {
            const x = spacing + i * (barWidth + spacing);
            const height = (val / max) * treinoCanvas.height * progress;
            const y = treinoCanvas.height - height;

            // Barra
            const grad = ctx.createLinearGradient(0, y, 0, treinoCanvas.height);
            grad.addColorStop(0, "#FFD700");
            grad.addColorStop(1, "#FFA500");
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barWidth, height, 10);

            // Valor
            ctx.fillStyle = "#fff";
            ctx.font = "12px Arial";
            ctx.fillText(val, x + 2, y - 6);
        });

        if (progress < 1) {
            progress += 0.02;
            requestAnimationFrame(drawBars);
        }
    }

    drawBars();
}

// ==============================
// GRÁFICO DE LINHA - "Evolução"
// ==============================
const evolucaoCanvas = document.querySelectorAll('.line-graph')[1];
if (evolucaoCanvas) {
    const ctx = evolucaoCanvas.getContext('2d');
    const data = [30, 45, 55, 60, 70, 80, 90];
    const max = Math.max(...data);
    const spacing = evolucaoCanvas.width / (data.length - 1);

    const points = data.map((val, i) => ({
        x: i * spacing,
        y: evolucaoCanvas.height - (val / max) * evolucaoCanvas.height
    }));

    let progress = 0;

    function drawLine() {
        ctx.clearRect(0, 0, evolucaoCanvas.width, evolucaoCanvas.height);

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length * progress; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Pontos
        points.forEach((p, i) => {
            if (i / points.length < progress) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
                ctx.fillStyle = "#fff";
                ctx.fill();
            }
        });

        if (progress < 1) {
            progress += 0.015;
            requestAnimationFrame(drawLine);
        }
    }

    drawLine();

    // Tooltip
    evolucaoCanvas.addEventListener('mousemove', e => {
        const rect = evolucaoCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        drawLine();
        points.forEach((p, i) => {
            if (Math.abs(x - p.x) < 10 && Math.abs(y - p.y) < 10) {
                ctx.fillStyle = "#fff";
                ctx.font = "12px Arial";
                ctx.fillText(`${data[i]}%`, p.x + 5, p.y - 10);
            }
        });
    });
}
