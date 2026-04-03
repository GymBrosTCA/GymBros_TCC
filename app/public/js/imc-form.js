// imc-form.js — multi-step form logic
'use strict';

let currentStep = 1;
const TOTAL_STEPS = 5;

// ================================================
// NAVEGAÇÃO ENTRE ETAPAS
// ================================================
function updateUI() {
    const pct = ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100;
    document.getElementById('progressFill').style.width = pct + '%';

    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        const n = idx + 1;
        dot.classList.remove('active', 'done');
        if (n === currentStep)      dot.classList.add('active');
        else if (n < currentStep)   dot.classList.add('done');
    });

    const btnBack   = document.getElementById('btnBack');
    const btnNext   = document.getElementById('btnNext');
    const btnSubmit = document.getElementById('btnSubmit');

    btnBack.style.display   = currentStep === 1           ? 'none'         : 'inline-flex';
    btnNext.style.display   = currentStep === TOTAL_STEPS ? 'none'         : 'inline-flex';
    btnSubmit.style.display = currentStep === TOTAL_STEPS ? 'inline-flex'  : 'none';
}

function showStep(next, goingBack) {
    const current = document.getElementById(`step-${currentStep}`);
    const target  = document.getElementById(`step-${next}`);

    current.classList.remove('active', 'slide-back');
    target.classList.remove('slide-back');
    target.classList.add('active');
    if (goingBack) target.classList.add('slide-back');

    currentStep = next;
    updateUI();

    if (currentStep === TOTAL_STEPS) buildSummary();
}

document.getElementById('btnNext').addEventListener('click', () => {
    if (validate(currentStep)) showStep(currentStep + 1, false);
});

document.getElementById('btnBack').addEventListener('click', () => {
    if (currentStep > 1) showStep(currentStep - 1, true);
});

document.getElementById('btnSubmit').addEventListener('click', submitForm);

// ================================================
// VALIDAÇÃO POR ETAPA
// ================================================
function validate(step) {
    let ok = true;

    if (step === 1) {
        ok = reqField('peso',   'Informe seu peso.')   & ok;
        ok = reqField('altura', 'Informe sua altura.') & ok;
        ok = reqField('idade',  'Informe sua idade.')  & ok;
        ok = reqRadio('sexo',   'Selecione seu sexo biológico.') & ok;
    }
    if (step === 2) {
        ok = reqRadio('objetivo',     'Selecione seu objetivo.')            & ok;
        ok = reqField('diasSemana',   'Informe os dias disponíveis.')       & ok;
        ok = reqField('tempoPorSessao','Informe o tempo por sessão.')       & ok;
        ok = reqRadio('localTreino',  'Selecione o local de treino.')       & ok;
        ok = reqRadio('experiencia',  'Selecione seu nível de experiência.') & ok;
    }
    if (step === 4) {
        const grupos = document.querySelectorAll('input[name="gruposAlimentares"]:checked');
        if (grupos.length === 0) {
            setError('gruposAlimentares-error', 'Selecione ao menos um grupo alimentar.');
            ok = false;
        } else {
            clearError('gruposAlimentares-error');
        }
    }
    if (step === 5) {
        if (!document.getElementById('lgpd').checked) {
            setError('lgpd-error', 'Você precisa aceitar o consentimento LGPD para continuar.');
            ok = false;
        } else {
            clearError('lgpd-error');
        }
    }

    return Boolean(ok);
}

function reqField(id, msg) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) {
        setError(`${id}-error`, msg);
        el && el.closest('.imc-field').classList.add('is-invalid');
        return false;
    }
    clearError(`${id}-error`);
    el.closest('.imc-field').classList.remove('is-invalid');
    return true;
}

function reqRadio(name, msg) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    if (!checked) { setError(`${name}-error`, msg); return false; }
    clearError(`${name}-error`);
    return true;
}

function setError(id, msg)  { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearError(id)     { const el = document.getElementById(id); if (el) el.textContent = ''; }

// ================================================
// CÁLCULO DE IMC EM TEMPO REAL
// ================================================
function calcIMC() {
    const peso   = parseFloat(document.getElementById('peso').value);
    const altura = parseFloat(document.getElementById('altura').value) / 100;
    const display = document.getElementById('imcDisplay');

    if (peso > 0 && altura > 0) {
        const imc = (peso / (altura * altura)).toFixed(1);
        document.getElementById('imcValue').textContent    = imc;
        document.getElementById('imcCategory').textContent = imcCategory(imc);
        display.style.display = 'block';
    } else {
        display.style.display = 'none';
    }
}

function imcCategory(imc) {
    imc = parseFloat(imc);
    if (imc < 18.5) return 'Abaixo do peso';
    if (imc < 25)   return '✓ Peso normal';
    if (imc < 30)   return 'Sobrepeso';
    if (imc < 35)   return 'Obesidade grau I';
    if (imc < 40)   return 'Obesidade grau II';
    return 'Obesidade grau III';
}

document.getElementById('peso').addEventListener('input', calcIMC);
document.getElementById('altura').addEventListener('input', calcIMC);

// ================================================
// EXCLUSIVIDADE DA OPÇÃO "NENHUMA" em checkboxes
// ================================================
document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
        const name = cb.name;
        if (cb.value === 'nenhuma' && cb.checked) {
            document.querySelectorAll(`input[name="${name}"]`).forEach(other => {
                if (other !== cb) other.checked = false;
            });
        } else if (cb.checked) {
            const nenhuma = document.querySelector(`input[name="${name}"][value="nenhuma"]`);
            if (nenhuma) nenhuma.checked = false;
        }
        // also handles "nenhum" (suplementação)
        if (cb.value === 'nenhum' && cb.checked) {
            document.querySelectorAll(`input[name="${name}"]`).forEach(other => {
                if (other !== cb) other.checked = false;
            });
        } else if (cb.checked) {
            const nenhum = document.querySelector(`input[name="${name}"][value="nenhum"]`);
            if (nenhum) nenhum.checked = false;
        }
    });
});

// ================================================
// SELETIVIDADE ALIMENTAR — campo condicional
// ================================================
document.querySelectorAll('input[name="seletividade"]').forEach(r => {
    r.addEventListener('change', () => {
        const details = document.getElementById('seletividadeDetails');
        if (details) details.style.display = r.value === 'sim' ? 'block' : 'none';
    });
});

// ================================================
// RESUMO — ETAPA 5
// ================================================
function buildSummary() {
    const val    = id  => { const el = document.getElementById(id); return el ? el.value : '—'; };
    const radio  = n   => { const el = document.querySelector(`input[name="${n}"]:checked`); return el ? el.value : '—'; };
    const checks = n   => {
        const els = document.querySelectorAll(`input[name="${n}"]:checked`);
        return els.length ? Array.from(els).map(e => e.value).join(', ') : 'nenhuma';
    };

    const peso   = val('peso');
    const altura = val('altura');
    const imc    = (peso !== '—' && altura !== '—')
        ? (parseFloat(peso) / Math.pow(parseFloat(altura) / 100, 2)).toFixed(1)
        : '—';
    const cat    = imc !== '—' ? imcCategory(imc) : '—';

    document.getElementById('imcSummary').innerHTML = `
        <section class="summary-section">
            <h3>📊 Biometria</h3>
            <p>Peso: <strong>${peso} kg</strong> &nbsp;|&nbsp; Altura: <strong>${altura} cm</strong> &nbsp;|&nbsp; Idade: <strong>${val('idade')} anos</strong></p>
            <p>Sexo biológico: <strong>${radio('sexo')}</strong> &nbsp;|&nbsp; IMC: <strong>${imc}</strong> (${cat})</p>
        </section>
        <section class="summary-section">
            <h3>🎯 Objetivo e Disponibilidade</h3>
            <p>Objetivo: <strong>${radio('objetivo')}</strong></p>
            <p>Experiência: <strong>${radio('experiencia')}</strong> &nbsp;|&nbsp; Local: <strong>${radio('localTreino')}</strong></p>
            <p>Disponibilidade: <strong>${val('diasSemana')} dias/semana, ${val('tempoPorSessao')} min/sessão</strong></p>
        </section>
        <section class="summary-section">
            <h3>🩺 Restrições Físicas</h3>
            <p>Lesões/condições: <strong>${checks('lesoes')}</strong></p>
            <p>Acompanhamento médico: <strong>${radio('acompanhamentoMedico')}</strong></p>
        </section>
        <section class="summary-section">
            <h3>🥗 Alimentação</h3>
            <p>Restrições: <strong>${checks('restricoesAlimentares')}</strong></p>
            <p>Seletividade alimentar: <strong>${radio('seletividade')}</strong></p>
            <p>Grupos alimentares: <strong>${checks('gruposAlimentares')}</strong></p>
            <p>Refeições/dia: <strong>${val('refeicoesPorDia')}</strong> &nbsp;|&nbsp; Pula refeições: <strong>${radio('pulaRefeicoes')}</strong></p>
            <p>Suplementação: <strong>${checks('suplementacao')}</strong> &nbsp;|&nbsp; Hidratação: <strong>${radio('hidratacao')}</strong></p>
        </section>
    `;
}

// ================================================
// SUBMISSÃO
// ================================================
async function submitForm() {
    if (!validate(TOTAL_STEPS)) return;

    const radio  = n => { const el = document.querySelector(`input[name="${n}"]:checked`); return el ? el.value : ''; };
    const checks = n => Array.from(document.querySelectorAll(`input[name="${n}"]:checked`)).map(e => e.value);

    const peso   = document.getElementById('peso').value;
    const altura = document.getElementById('altura').value;
    const imc    = (parseFloat(peso) / Math.pow(parseFloat(altura) / 100, 2)).toFixed(1);

    const payload = {
        peso,
        altura,
        idade:                 document.getElementById('idade').value,
        sexo:                  radio('sexo'),
        objetivo:              radio('objetivo'),
        diasSemana:            document.getElementById('diasSemana').value,
        tempoPorSessao:        document.getElementById('tempoPorSessao').value,
        localTreino:           radio('localTreino'),
        experiencia:           radio('experiencia'),
        lesoes:                checks('lesoes'),
        acompanhamentoMedico:  radio('acompanhamentoMedico'),
        restricoesAlimentares: checks('restricoesAlimentares'),
        seletividade:          radio('seletividade'),
        alimentosSeletividade: document.getElementById('alimentosSeletividade')?.value || '',
        gruposAlimentares:     checks('gruposAlimentares'),
        refeicoesPorDia:       document.getElementById('refeicoesPorDia').value,
        pulaRefeicoes:         radio('pulaRefeicoes'),
        suplementacao:         checks('suplementacao'),
        hidratacao:            radio('hidratacao'),
        imcValor:              imc
    };

    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.disabled     = true;
    btnSubmit.innerHTML    = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        const res  = await fetch('/imc-save', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.mensagem) {
            document.getElementById('submit-success').textContent = data.mensagem;
            setTimeout(() => { window.location.href = '/area-aluno'; }, 1500);
        }
    } catch (err) {
        console.error(err);
        setError('submit-error', 'Erro ao salvar. Tente novamente.');
        btnSubmit.disabled  = false;
        btnSubmit.innerHTML = '<i class="fas fa-check"></i> Salvar Perfil';
    }
}

// Init
updateUI();
