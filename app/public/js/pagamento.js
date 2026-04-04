// ==============================
// pagamento.js — GymBros Payment Flow
// ==============================

let metodoSelecionado = null;
let pixTimerInterval  = null;

// ── Step Navigation ────────────────────────────────────────────────────────

function setStep(stepId) {
    document.querySelectorAll('.pagamento-step').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(stepId);
    if (el) el.classList.remove('hidden');
    atualizarProgress(stepId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function atualizarProgress(stepId) {
    const p1 = document.getElementById('prog-1');
    const p2 = document.getElementById('prog-2');
    const p3 = document.getElementById('prog-3');
    const l1 = document.getElementById('prog-line-1');
    const l2 = document.getElementById('prog-line-2');

    // Reset
    [p1, p2, p3].forEach(p => p.className = 'prog-step');
    [l1, l2].forEach(l => l.className = 'prog-line');
    p1.querySelector('span').textContent = '1';
    p2.querySelector('span').textContent = '2';
    p3.querySelector('span').textContent = '3';

    if (stepId === 'step-1') {
        p1.classList.add('active');

    } else if (stepId.startsWith('step-2')) {
        p1.classList.add('done');
        p2.classList.add('active');
        l1.classList.add('done');
        p1.querySelector('span').textContent = '✓';

    } else if (stepId === 'step-3') {
        p1.classList.add('done');
        p2.classList.add('done');
        p3.classList.add('active');
        l1.classList.add('done');
        l2.classList.add('done');
        p1.querySelector('span').textContent = '✓';
        p2.querySelector('span').textContent = '✓';
    }
}

// ── Copy to Clipboard ──────────────────────────────────────────────────────

function copiarCodigo(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn   = document.getElementById(btnId);
    if (!input || !btn) return;

    const originalHTML = btn.innerHTML;

    const doFeedback = () => {
        btn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
        btn.classList.add('copiado');
        btn.disabled = true;
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('copiado');
            btn.disabled = false;
        }, 2500);
    };

    if (navigator.clipboard) {
        navigator.clipboard.writeText(input.value).then(doFeedback).catch(() => {
            input.select();
            document.execCommand('copy');
            doFeedback();
        });
    } else {
        input.select();
        document.execCommand('copy');
        doFeedback();
    }
}

// Make global so EJS onclick can call it
window.copiarCodigo = copiarCodigo;

// ── PIX Countdown Timer ───────────────────────────────────────────────────

function iniciarTimer() {
    let segundos = 30 * 60;
    const el = document.getElementById('pix-countdown');
    if (!el) return;

    clearInterval(pixTimerInterval);
    el.style.color = '#C98B1D';

    pixTimerInterval = setInterval(() => {
        segundos--;
        const m = Math.floor(segundos / 60);
        const s = segundos % 60;
        el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        if (m < 5) el.style.color = '#e74c3c';

        if (segundos <= 0) {
            clearInterval(pixTimerInterval);
            el.textContent = 'Expirado';
            const btnPix = document.getElementById('btn-ja-paguei');
            if (btnPix) {
                btnPix.disabled = true;
                btnPix.innerHTML = '<i class="fas fa-times"></i> Código expirado';
            }
        }
    }, 1000);
}

// ── Card Input Masks ──────────────────────────────────────────────────────

function atualizarPreviewNumero(valor) {
    const raw = valor.replace(/\s/g, '');
    let preview = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) preview += ' ';
        preview += raw[i] !== undefined ? raw[i] : '•';
    }
    const el = document.getElementById('prev-numero');
    if (el) el.textContent = preview;
}

function mascaraNumero(e) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    e.target.value = raw.replace(/(.{4})/g, '$1 ').trim();
    atualizarPreviewNumero(raw);
}

function mascaraValidade(e) {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    e.target.value = v;
    const el = document.getElementById('prev-validade');
    if (el) el.textContent = v || 'MM/AA';
}

function mascaraCVV(e) {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
}

// ── Parcelas Dropdown ─────────────────────────────────────────────────────

function preencherParcelas() {
    const select = document.getElementById('cartao-parcelas');
    if (!select || typeof PLANO === 'undefined') return;
    select.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
        const val = (PLANO.preco / i).toFixed(2).replace('.', ',');
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i === 1
            ? `1x de R$ ${val} (à vista)`
            : `${i}x de R$ ${val} sem juros`;
        select.appendChild(opt);
    }
}

// ── Card Form Validation ──────────────────────────────────────────────────

function marcarInvalido(el) {
    el.classList.add('campo-invalido', 'campo-shake');
    el.addEventListener('animationend', () => el.classList.remove('campo-shake'), { once: true });
}

function limparInvalido(el) {
    el.classList.remove('campo-invalido');
}

function validarCartao() {
    const numero   = document.getElementById('cartao-numero');
    const nome     = document.getElementById('cartao-nome');
    const validade = document.getElementById('cartao-validade');
    const cvv      = document.getElementById('cartao-cvv');

    [numero, nome, validade, cvv].forEach(el => limparInvalido(el));

    let valido = true;

    if (numero.value.replace(/\s/g, '').length < 16) {
        marcarInvalido(numero); valido = false;
    }
    if (nome.value.trim().length < 3 || /\d/.test(nome.value)) {
        marcarInvalido(nome); valido = false;
    }
    const partes = validade.value.split('/');
    const mm = parseInt(partes[0]);
    const mesOk = !isNaN(mm) && mm >= 1 && mm <= 12;
    const anoOk = partes[1] && partes[1].length === 2;
    if (!mesOk || !anoOk) {
        marcarInvalido(validade); valido = false;
    }
    if (cvv.value.length < 3) {
        marcarInvalido(cvv); valido = false;
    }

    return valido;
}

// ── POST /api/pagamento ───────────────────────────────────────────────────

async function finalizarPagamento(metodo, parcelas) {
    if (typeof PLANO === 'undefined') return { ok: false };
    try {
        const resp = await fetch('/api/pagamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                planoId:   PLANO.id,
                planoNome: PLANO.nome,
                valor:     PLANO.preco,
                metodo,
                parcelas:  parcelas || 1
            })
        });
        if (resp.status === 401) {
            window.location.href = '/login';
            return { ok: false };
        }
        return await resp.json();
    } catch {
        return { ok: false, status: metodo === 'cartao' ? 'ativo' : 'pendente' };
    }
}

// ── Show Step 3 ───────────────────────────────────────────────────────────

const METODO_LABEL = {
    pix:    'PIX',
    cartao: 'Cartão de Crédito',
    boleto: 'Boleto Bancário'
};

function mostrarConfirmacao(metodo, status) {
    clearInterval(pixTimerInterval);

    document.getElementById('conf-plano').textContent  = PLANO.nome;
    document.getElementById('conf-valor').textContent  = PLANO.precoFmt;
    document.getElementById('conf-metodo').textContent = METODO_LABEL[metodo] || metodo;
    document.getElementById('conf-data').textContent   = new Date().toLocaleDateString('pt-BR');

    const badge = document.getElementById('conf-status-badge');
    const sub   = document.getElementById('conf-sub');

    if (status === 'ativo') {
        badge.className = 'confirmacao-status ativo';
        badge.innerHTML = '<i class="fas fa-check-circle"></i> Assinatura ativada';
        sub.textContent = 'Sua assinatura foi ativada com sucesso. Bons treinos!';
    } else {
        badge.className = 'confirmacao-status pendente';
        badge.innerHTML = '<i class="fas fa-clock"></i> Aguardando pagamento';
        sub.textContent = metodo === 'boleto'
            ? 'Boleto gerado! Após o pagamento, sua assinatura é ativada em até 2 dias úteis.'
            : 'Confirmaremos o seu PIX em breve e ativaremos a assinatura automaticamente.';
    }

    setStep('step-3');
}

// ── Init ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // Method card selection
    document.querySelectorAll('.metodo-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.metodo-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            metodoSelecionado = card.dataset.metodo;
            document.getElementById('btn-continuar').disabled = false;
        });
    });

    // Continue button
    document.getElementById('btn-continuar').addEventListener('click', () => {
        if (!metodoSelecionado) return;
        if (metodoSelecionado === 'pix') {
            setStep('step-2-pix');
            iniciarTimer();
        } else if (metodoSelecionado === 'cartao') {
            setStep('step-2-cartao');
            preencherParcelas();
        } else if (metodoSelecionado === 'boleto') {
            setStep('step-2-boleto');
        }
    });

    // Back buttons
    ['btn-voltar-pix', 'btn-voltar-cartao', 'btn-voltar-boleto'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => {
            clearInterval(pixTimerInterval);
            setStep('step-1');
        });
    });

    // Copy buttons
    const btnCopiarPix = document.getElementById('btn-copiar-pix');
    if (btnCopiarPix) btnCopiarPix.addEventListener('click', () => copiarCodigo('pix-codigo', 'btn-copiar-pix'));

    const btnCopiarBoleto = document.getElementById('btn-copiar-boleto');
    if (btnCopiarBoleto) btnCopiarBoleto.addEventListener('click', () => copiarCodigo('boleto-codigo', 'btn-copiar-boleto'));

    // PIX: Já paguei
    const btnJaPaguei = document.getElementById('btn-ja-paguei');
    if (btnJaPaguei) {
        btnJaPaguei.addEventListener('click', async () => {
            btnJaPaguei.disabled = true;
            btnJaPaguei.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
            const result = await finalizarPagamento('pix', 1);
            mostrarConfirmacao('pix', result.status || 'pendente');
        });
    }

    // Card: Confirmar pagamento
    const btnCartao = document.getElementById('btn-confirmar-cartao');
    if (btnCartao) {
        btnCartao.addEventListener('click', async () => {
            if (!validarCartao()) return;
            const parcelas = parseInt(document.getElementById('cartao-parcelas').value) || 1;
            btnCartao.disabled = true;
            btnCartao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
            const result = await finalizarPagamento('cartao', parcelas);
            mostrarConfirmacao('cartao', result.status || 'ativo');
        });
    }

    // Boleto: Confirmar
    const btnBoleto = document.getElementById('btn-confirmar-boleto');
    if (btnBoleto) {
        btnBoleto.addEventListener('click', async () => {
            btnBoleto.disabled = true;
            btnBoleto.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando boleto...';
            const result = await finalizarPagamento('boleto', 1);
            mostrarConfirmacao('boleto', result.status || 'pendente');
        });
    }

    // Card number mask + preview
    const numInput = document.getElementById('cartao-numero');
    if (numInput) numInput.addEventListener('input', mascaraNumero);

    // Card name → preview
    const nomInput = document.getElementById('cartao-nome');
    if (nomInput) {
        nomInput.addEventListener('input', e => {
            e.target.value = e.target.value.toUpperCase();
            const el = document.getElementById('prev-nome');
            if (el) el.textContent = e.target.value || 'SEU NOME';
        });
    }

    // Expiry mask + preview
    const valInput = document.getElementById('cartao-validade');
    if (valInput) valInput.addEventListener('input', mascaraValidade);

    // CVV mask
    const cvvInput = document.getElementById('cartao-cvv');
    if (cvvInput) cvvInput.addEventListener('input', mascaraCVV);

    // Clear invalid state on user input
    ['cartao-numero', 'cartao-nome', 'cartao-validade', 'cartao-cvv'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => limparInvalido(el));
    });
});
