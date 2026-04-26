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

window.copiarCodigo = copiarCodigo;

// ── PIX QR Code ───────────────────────────────────────────────────────────

async function carregarPixQR() {
    const loading = document.getElementById('pix-qr-loading');
    const img     = document.getElementById('pix-qr-img');
    const input   = document.getElementById('pix-codigo');
    if (!img) return;

    if (loading) loading.classList.remove('hidden');
    img.classList.add('hidden');

    try {
        const params = new URLSearchParams({
            planoId: PLANO.id,
            valor:   PLANO.preco,
        });
        const resp = await fetch(`/api/pix/qr?${params}`);
        const data = await resp.json();
        if (data.ok) {
            img.src = data.dataUrl;
            img.classList.remove('hidden');
            if (loading) loading.classList.add('hidden');
            if (input) input.value = data.pixPayload;
        }
    } catch (err) {
        console.error('[pix/qr]', err);
        if (loading) loading.classList.add('hidden');
    }
}

// ── PIX Countdown Timer ───────────────────────────────────────────────────

function iniciarTimer() {
    let segundos = 5 * 60; // 5 minutos
    const el     = document.getElementById('pix-countdown');
    const btnPix = document.getElementById('btn-ja-paguei');
    const btnReg = document.getElementById('btn-regenerar-pix');
    if (!el) return;

    clearInterval(pixTimerInterval);
    el.style.color = '#C98B1D';
    if (btnPix) { btnPix.disabled = false; btnPix.innerHTML = '<i class="fas fa-check"></i> Já paguei'; }
    if (btnReg) btnReg.classList.add('hidden');

    pixTimerInterval = setInterval(() => {
        segundos--;
        const m = Math.floor(segundos / 60);
        const s = segundos % 60;
        el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        if (m < 2) el.style.color = '#e74c3c';

        if (segundos <= 0) {
            clearInterval(pixTimerInterval);
            el.textContent = 'Expirado';
            if (btnPix) {
                btnPix.disabled = true;
                btnPix.innerHTML = '<i class="fas fa-times"></i> Código expirado';
            }
            if (btnReg) btnReg.classList.remove('hidden');
        }
    }, 1000);
}

// ── Luhn Algorithm ────────────────────────────────────────────────────────

function luhn(num) {
    const digits = num.replace(/\D/g, '');
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = parseInt(digits[i], 10);
        if (alt) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
        alt = !alt;
    }
    return sum % 10 === 0;
}

// ── Card Brand Detection ──────────────────────────────────────────────────

const BRANDS = [
    { name: 'Visa',       icon: 'fab fa-cc-visa',       pattern: /^4/ },
    { name: 'Mastercard', icon: 'fab fa-cc-mastercard', pattern: /^5[1-5]|^2(2[2-9]|[3-6]\d|7[01])/ },
    { name: 'Amex',       icon: 'fab fa-cc-amex',       pattern: /^3[47]/ },
    { name: 'Elo',        icon: 'fas fa-credit-card',   pattern: /^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|650[0-5]|6516|6550)/ },
];

function detectBrand(raw) {
    return BRANDS.find(b => b.pattern.test(raw)) || null;
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

    // Brand icon
    const brand   = detectBrand(raw);
    const iconEl  = document.getElementById('card-brand-icon');
    if (iconEl) {
        iconEl.innerHTML = brand ? `<i class="${brand.icon}" title="${brand.name}"></i>` : '';
    }

    // Real-time Luhn feedback
    if (raw.length === 16) {
        setFieldRealtime(e.target, luhn(raw));
    } else {
        clearFieldRealtime(e.target);
    }

    verificarBotaoCartao();
}

function mascaraValidade(e) {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    e.target.value = v;
    const el = document.getElementById('prev-validade');
    if (el) el.textContent = v || 'MM/AA';

    if (v.length === 5) {
        const partes = v.split('/');
        const mm = parseInt(partes[0]);
        const ok = !isNaN(mm) && mm >= 1 && mm <= 12 && partes[1].length === 2;
        setFieldRealtime(e.target, ok);
    } else {
        clearFieldRealtime(e.target);
    }

    verificarBotaoCartao();
}

function mascaraCVV(e) {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    const len = e.target.value.length;
    if (len >= 3) {
        setFieldRealtime(e.target, true);
    } else {
        clearFieldRealtime(e.target);
    }
    verificarBotaoCartao();
}

// ── Real-time Field State ─────────────────────────────────────────────────

function setFieldRealtime(el, valid) {
    el.classList.remove('campo-valido', 'campo-invalido', 'campo-shake');
    el.classList.add(valid ? 'campo-valido' : 'campo-invalido');
}

function clearFieldRealtime(el) {
    el.classList.remove('campo-valido', 'campo-invalido', 'campo-shake');
}

// ── Enable/disable Confirmar button ──────────────────────────────────────

function verificarBotaoCartao() {
    const numero   = document.getElementById('cartao-numero');
    const nome     = document.getElementById('cartao-nome');
    const validade = document.getElementById('cartao-validade');
    const cvv      = document.getElementById('cartao-cvv');
    const btn      = document.getElementById('btn-confirmar-cartao');
    if (!btn) return;

    const raw = (numero?.value || '').replace(/\s/g, '');
    const numOk = raw.length === 16 && luhn(raw);

    const nomeOk = (nome?.value.trim().length >= 3) && !/\d/.test(nome?.value);

    const partes = (validade?.value || '').split('/');
    const mm = parseInt(partes[0]);
    const valOk = !isNaN(mm) && mm >= 1 && mm <= 12 && partes[1]?.length === 2;

    const cvvOk = (cvv?.value.length >= 3);

    btn.disabled = !(numOk && nomeOk && valOk && cvvOk);
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

// ── Card Form Validation (submit) ─────────────────────────────────────────

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

    const raw = numero.value.replace(/\s/g, '');
    if (raw.length < 16 || !luhn(raw)) { marcarInvalido(numero); valido = false; }
    if (nome.value.trim().length < 3 || /\d/.test(nome.value)) { marcarInvalido(nome); valido = false; }
    const partes = validade.value.split('/');
    const mm = parseInt(partes[0]);
    if (isNaN(mm) || mm < 1 || mm > 12 || !partes[1] || partes[1].length !== 2) { marcarInvalido(validade); valido = false; }
    if (cvv.value.length < 3) { marcarInvalido(cvv); valido = false; }

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

// ── POST /api/boleto ──────────────────────────────────────────────────────

async function gerarBoleto() {
    if (typeof PLANO === 'undefined') return { ok: false };
    try {
        const resp = await fetch('/api/boleto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                planoId:   PLANO.id,
                planoNome: PLANO.nome,
                valor:     PLANO.preco,
            })
        });
        if (resp.status === 401) { window.location.href = '/login'; return { ok: false }; }
        return await resp.json();
    } catch {
        return { ok: false };
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

    if (status === 'pago' || status === 'ativo') {
        badge.className = 'confirmacao-status ativo';
        badge.innerHTML = '<i class="fas fa-check-circle"></i> Assinatura ativada';
        sub.textContent = 'Sua assinatura foi ativada com sucesso. Bons treinos!';
        setTimeout(() => { window.location.replace('/area-aluno'); }, 2000);
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
            carregarPixQR();
        } else if (metodoSelecionado === 'cartao') {
            setStep('step-2-cartao');
            preencherParcelas();
            verificarBotaoCartao();
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

    // PIX: Regenerar QR
    const btnReg = document.getElementById('btn-regenerar-pix');
    if (btnReg) {
        btnReg.addEventListener('click', () => {
            iniciarTimer();
            carregarPixQR();
        });
    }

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
        btnCartao.disabled = true; // começa desabilitado
        btnCartao.addEventListener('click', async () => {
            if (!validarCartao()) return;
            const parcelas = parseInt(document.getElementById('cartao-parcelas').value) || 1;
            btnCartao.disabled = true;
            btnCartao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
            const result = await finalizarPagamento('cartao', parcelas);
            mostrarConfirmacao('cartao', result.status || 'pago');
        });
    }

    // Boleto: Confirmar
    const btnBoleto = document.getElementById('btn-confirmar-boleto');
    if (btnBoleto) {
        btnBoleto.addEventListener('click', async () => {
            btnBoleto.disabled = true;
            btnBoleto.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando boleto...';
            const result = await gerarBoleto();
            if (result.ok && result.linhaDigitavel) {
                const boletoInput = document.getElementById('boleto-codigo');
                if (boletoInput) boletoInput.value = result.linhaDigitavel;
            }
            const pagResult = await finalizarPagamento('boleto', 1);
            mostrarConfirmacao('boleto', pagResult.status || 'pendente');
        });
    }

    // Card number mask + brand + preview
    const numInput = document.getElementById('cartao-numero');
    if (numInput) numInput.addEventListener('input', mascaraNumero);

    // Card name → preview + validation
    const nomInput = document.getElementById('cartao-nome');
    if (nomInput) {
        nomInput.addEventListener('input', e => {
            e.target.value = e.target.value.toUpperCase();
            const el = document.getElementById('prev-nome');
            if (el) el.textContent = e.target.value || 'SEU NOME';
            const nomeOk = e.target.value.trim().length >= 3 && !/\d/.test(e.target.value);
            if (e.target.value.trim().length >= 3) {
                setFieldRealtime(e.target, nomeOk);
            } else {
                clearFieldRealtime(e.target);
            }
            verificarBotaoCartao();
        });
    }

    // Expiry mask + preview
    const valInput = document.getElementById('cartao-validade');
    if (valInput) valInput.addEventListener('input', mascaraValidade);

    // CVV mask
    const cvvInput = document.getElementById('cartao-cvv');
    if (cvvInput) cvvInput.addEventListener('input', mascaraCVV);
});
