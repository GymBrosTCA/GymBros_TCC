// imc-form.js — multi-step form logic + profile view mode
'use strict';

// ================================================
// MODO PERFIL SALVO (localStorage)
// ================================================
// Namespaced per user to avoid data bleed between accounts
const _uid = (window.GYMBROS_USER_ID || 'guest').replace(/\D/g, '');
const STORAGE_KEY = `gymbros_imc_profile_${_uid}`;

function loadSavedProfile() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
    catch { return null; }
}

function saveProfile(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Calcula IMC e retorna categoria
function imcCategory(imc) {
    imc = parseFloat(imc);
    if (imc < 18.5) return 'Abaixo do peso';
    if (imc < 25)   return '✓ Peso normal';
    if (imc < 30)   return 'Sobrepeso';
    if (imc < 35)   return 'Obesidade grau I';
    if (imc < 40)   return 'Obesidade grau II';
    return 'Obesidade grau III';
}

// Posição na barra IMC (0–100%)
function imcBarPercent(imc) {
    imc = parseFloat(imc);
    // Mapeia IMC 14–40 para 0–100%
    const min = 14, max = 40;
    return Math.min(100, Math.max(0, ((imc - min) / (max - min)) * 100));
}

// Renderiza a view de perfil salvo
function renderProfileView(data) {
    const imc  = parseFloat(data.imcValor);
    const cat  = imcCategory(imc);
    const pct  = imcBarPercent(imc);

    const view = document.getElementById('profileView');
    if (!view) return;

    view.innerHTML = `
    <section class="profile-view-card">
        <section class="profile-view-header">
            <h2><i class="fas fa-user-check"></i> Perfil IMC Salvo</h2>
            <button class="btn-edit-profile" id="btnEditProfile">
                <i class="fas fa-pencil-alt"></i> Editar
            </button>
        </section>

        <section class="profile-view-grid">
            <section class="pv-item">
                <span class="pv-label">Peso</span>
                <span class="pv-value">${data.peso} kg</span>
            </section>
            <section class="pv-item">
                <span class="pv-label">Altura</span>
                <span class="pv-value">${data.altura} cm</span>
            </section>
            <section class="pv-item">
                <span class="pv-label">Idade</span>
                <span class="pv-value">${data.idade} anos</span>
            </section>
            <section class="pv-item">
                <span class="pv-label">Sexo</span>
                <span class="pv-value">${data.sexo}</span>
            </section>
            <section class="pv-item">
                <span class="pv-label">Objetivo</span>
                <span class="pv-value">${data.objetivo}</span>
            </section>
            <section class="pv-item">
                <span class="pv-label">Experiência</span>
                <span class="pv-value">${data.experiencia}</span>
            </section>
            <section class="pv-item">
                <span class="pv-label">Treino</span>
                <span class="pv-value">${data.diasSemana} dias/sem · ${data.tempoPorSessao} min</span>
            </section>
            <section class="pv-item">
                <span class="pv-label">Local</span>
                <span class="pv-value">${data.localTreino}</span>
            </section>
            <section class="pv-item">
                <span class="pv-label">Lesões</span>
                <span class="pv-value">${Array.isArray(data.lesoes) && data.lesoes.length ? data.lesoes.join(', ') + (data.lesoesOutros ? ` — ${data.lesoesOutros}` : '') : 'nenhuma'}</span>
            </section>
        </section>

        <!-- IMC com barra visual -->
        <section class="pv-imc-block">
            <section class="pv-imc-top">
                <span class="pv-imc-value">${imc.toFixed(1)}</span>
                <span class="pv-imc-cat">${cat}</span>
            </section>
            <section class="pv-imc-bar-wrap">
                <section class="pv-imc-bar">
                    <section class="pv-imc-marker" style="left: ${pct}%"></section>
                </section>
                <section class="pv-imc-scale">
                    <span>Abaixo do peso</span>
                    <span>Normal</span>
                    <span>Sobrepeso</span>
                    <span>Obesidade</span>
                </section>
            </section>
        </section>
    </section>`;

    view.style.display = 'block';
    document.getElementById('formWrapper').style.display = 'none';

    document.getElementById('btnEditProfile').addEventListener('click', () => {
        view.style.display = 'none';
        document.getElementById('formWrapper').style.display = 'block';
        // Preenche os campos com os dados salvos
        populateForm(data);
    });
}

// Preenche o formulário com dados do localStorage
function populateForm(data) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.value = val;
    };
    const setRadio = (name, val) => {
        const el = document.querySelector(`input[name="${name}"][value="${val}"]`);
        if (el) el.checked = true;
    };
    const setChecks = (name, vals) => {
        if (!Array.isArray(vals)) return;
        document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
            cb.checked = vals.includes(cb.value);
        });
    };

    set('peso', data.peso);
    set('altura', data.altura);
    set('idade', data.idade);
    setRadio('sexo', data.sexo);
    setRadio('objetivo', data.objetivo);
    set('diasSemana', data.diasSemana);
    set('tempoPorSessao', data.tempoPorSessao);
    setRadio('localTreino', data.localTreino);
    setRadio('experiencia', data.experiencia);
    setChecks('lesoes', data.lesoes);
    if (data.lesoesOutros) {
        set('lesoesOutros', data.lesoesOutros);
        const outrosField = document.getElementById('lesoesOutrosField');
        if (outrosField) outrosField.style.display = 'block';
    }
    setRadio('acompanhamentoMedico', data.acompanhamentoMedico);
    setChecks('restricoesAlimentares', data.restricoesAlimentares);
    setRadio('seletividade', data.seletividade);
    if (data.alimentosSeletividade) set('alimentosSeletividade', data.alimentosSeletividade);
    if (data.seletividade === 'sim') {
        const d = document.getElementById('seletividadeDetails');
        if (d) d.style.display = 'block';
    }
    setChecks('gruposAlimentares', data.gruposAlimentares);
    set('refeicoesPorDia', data.refeicoesPorDia);
    setRadio('pulaRefeicoes', data.pulaRefeicoes);
    setChecks('suplementacao', data.suplementacao);
    setRadio('hidratacao', data.hidratacao);

    calcIMC();
}

// ================================================
// INICIALIZAÇÃO
// ================================================
window.addEventListener('DOMContentLoaded', () => {
    const saved = loadSavedProfile();
    if (saved && saved.imcValor) {
        renderProfileView(saved);
    }
});

// ================================================
// NAVEGAÇÃO ENTRE ETAPAS
// ================================================
let currentStep = 1;
const TOTAL_STEPS = 5;

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
    const btnCancel = document.getElementById('btnCancelEdit');

    btnBack.style.display   = currentStep === 1           ? 'none'         : 'inline-flex';
    btnNext.style.display   = currentStep === TOTAL_STEPS ? 'none'         : 'inline-flex';
    btnSubmit.style.display = currentStep === TOTAL_STEPS ? 'inline-flex'  : 'none';

    // Mostra botão cancelar edição apenas se há perfil salvo
    if (btnCancel) {
        btnCancel.style.display = loadSavedProfile() ? 'inline-flex' : 'none';
    }
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
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (currentStep === TOTAL_STEPS) buildSummary();
}

document.getElementById('btnNext').addEventListener('click', () => {
    if (validate(currentStep)) showStep(currentStep + 1, false);
});

document.getElementById('btnBack').addEventListener('click', () => {
    if (currentStep > 1) showStep(currentStep - 1, true);
});

document.getElementById('btnSubmit').addEventListener('click', submitForm);

// Botão cancelar edição: volta para a view do perfil salvo
const btnCancelEdit = document.getElementById('btnCancelEdit');
if (btnCancelEdit) {
    btnCancelEdit.addEventListener('click', () => {
        const saved = loadSavedProfile();
        if (saved) {
            renderProfileView(saved);
        }
    });
}

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
// OUTROS — campo condicional de lesões
// ================================================
const lesoesOutrosCheckbox = document.querySelector('input[name="lesoes"][value="outros"]');
if (lesoesOutrosCheckbox) {
    lesoesOutrosCheckbox.addEventListener('change', () => {
        const field = document.getElementById('lesoesOutrosField');
        if (field) field.style.display = lesoesOutrosCheckbox.checked ? 'block' : 'none';
    });
}

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
            <p>Lesões/condições: <strong>${checks('lesoes')}${val('lesoesOutros') ? ` — ${val('lesoesOutros')}` : ''}</strong></p>
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
        lesoesOutros:          document.getElementById('lesoesOutros')?.value || '',
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
    btnSubmit.disabled  = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        const res  = await fetch('/imc-save', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.mensagem) {
            // Salva no localStorage para persistência local
            saveProfile(payload);

            // Registra snapshot no histórico de evolução
            const historico = JSON.parse(localStorage.getItem(`gymbros_evolucao_${_uid}`) || '[]');
            historico.push({
                tipo: 'imc',
                data: new Date().toLocaleDateString('pt-BR'),
                timestamp: Date.now(),
                dados: {
                    peso: payload.peso,
                    altura: payload.altura,
                    idade: payload.idade,
                    imcValor: payload.imcValor,
                    objetivo: payload.objetivo
                }
            });
            // Cap to last 100 entries to prevent unbounded localStorage growth
            if (historico.length > 100) historico.splice(0, historico.length - 100);
            localStorage.setItem(`gymbros_evolucao_${_uid}`, JSON.stringify(historico));

            document.getElementById('submit-success').textContent = '✓ Perfil salvo com sucesso!';

            // Após 1.5s mostra a view do perfil em vez de redirecionar
            setTimeout(() => {
                renderProfileView(payload);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                // Volta ao passo 1 caso o usuário edite novamente
                currentStep = 1;
                document.querySelectorAll('.imc-step').forEach(s => s.classList.remove('active'));
                document.getElementById('step-1').classList.add('active');
                updateUI();
                document.getElementById('submit-success').textContent = '';
                btnSubmit.disabled  = false;
                btnSubmit.innerHTML = '<i class="fas fa-check"></i> Salvar Perfil';
            }, 1500);
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
