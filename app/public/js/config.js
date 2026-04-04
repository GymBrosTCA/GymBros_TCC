'use strict';

// ─── Feedback helper ─────────────────────────────────────────────────────────
function showMsg(el, text, isOk) {
    el.textContent = text;
    el.className   = `cfg-feedback show ${isOk ? 'ok' : 'err'}`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.classList.remove('show'); }, 3500);
}

// ─── Loading state on button ──────────────────────────────────────────────────
function setLoading(btn, isLoading, originalText) {
    btn.disabled = isLoading;
    const span   = btn.querySelector('.cfg-btn-text');
    if (span) span.textContent = isLoading ? 'Salvando...' : originalText;
}

// ─── Formulário dados pessoais ────────────────────────────────────────────────
const formDados = document.getElementById('form-dados');
if (formDados) {
    const msgEl = document.getElementById('cfg-dados-msg');
    const btn   = formDados.querySelector('button[type="submit"]');
    const orig  = btn.querySelector('.cfg-btn-text')?.textContent || 'Salvar alterações';

    formDados.addEventListener('submit', async e => {
        e.preventDefault();
        setLoading(btn, true, orig);
        try {
            const res  = await fetch('/config/atualizar-dados', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    nome:  document.getElementById('cfg-nome').value.trim(),
                    email: document.getElementById('cfg-email').value.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.erro || 'Erro inesperado.');
            showMsg(msgEl, data.mensagem, true);
        } catch (err) {
            showMsg(msgEl, err.message, false);
        } finally {
            setLoading(btn, false, orig);
        }
    });
}

// ─── Formulário senha ─────────────────────────────────────────────────────────
const formSenha = document.getElementById('form-senha');
if (formSenha) {
    const msgEl = document.getElementById('cfg-senha-msg');
    const btn   = formSenha.querySelector('button[type="submit"]');
    const orig  = btn.querySelector('.cfg-btn-text')?.textContent || 'Alterar senha';

    formSenha.addEventListener('submit', async e => {
        e.preventDefault();
        const novaSenha    = document.getElementById('cfg-nova-senha').value;
        const confirmaSenha = document.getElementById('cfg-confirma-senha').value;
        if (novaSenha !== confirmaSenha) {
            showMsg(msgEl, 'As senhas não coincidem.', false);
            return;
        }
        if (novaSenha.length < 6) {
            showMsg(msgEl, 'A nova senha deve ter pelo menos 6 caracteres.', false);
            return;
        }
        setLoading(btn, true, orig);
        try {
            const res  = await fetch('/config/alterar-senha', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    senhaAtual: document.getElementById('cfg-senha-atual').value,
                    novaSenha,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.erro || 'Erro inesperado.');
            showMsg(msgEl, data.mensagem, true);
            formSenha.reset();
        } catch (err) {
            showMsg(msgEl, err.message, false);
        } finally {
            setLoading(btn, false, orig);
        }
    });
}

// ─── Toggle mostrar/ocultar senha ────────────────────────────────────────────
document.querySelectorAll('.cfg-eye').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.querySelector('i').className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    });
});

// ─── Upload de foto de perfil ─────────────────────────────────────────────────
const avatarRing   = document.getElementById('avatarRing');
const avatarInput  = document.getElementById('cfg-avatar-input');
const avatarPreview = document.getElementById('cfg-avatar-preview');
const avatarBtn    = document.getElementById('cfg-avatar-btn');
const avatarMsg    = document.getElementById('cfg-avatar-msg');
let   pendingFile  = null;
let   currentBlobUrl = null;

if (avatarRing && avatarInput) {
    avatarRing.addEventListener('click', () => avatarInput.click());

    avatarInput.addEventListener('change', () => {
        const file = avatarInput.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showMsg(avatarMsg, 'Arquivo muito grande. Máximo 5 MB.', false);
            avatarInput.value = '';
            return;
        }
        // Preview ao vivo
        if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = URL.createObjectURL(file);
        avatarPreview.src = currentBlobUrl;
        pendingFile = file;
        avatarBtn.style.display = '';
        showMsg(avatarMsg, 'Pré-visualização carregada. Clique em "Salvar foto" para confirmar.', true);
    });

    avatarBtn.addEventListener('click', async () => {
        if (!pendingFile) return;
        const origText = avatarBtn.querySelector('span')?.textContent || 'Salvar foto';
        avatarBtn.disabled = true;
        if (avatarBtn.querySelector('span')) avatarBtn.querySelector('span').textContent = 'Enviando...';

        try {
            const fd = new FormData();
            fd.append('photo', pendingFile);
            const res  = await fetch('/api/student/profile-photo', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.erro || 'Erro ao enviar.');

            // Update all avatars on page
            document.querySelectorAll('#sidebar-avatar, #cfg-avatar-preview').forEach(img => {
                img.src = data.photoUrl + '?t=' + Date.now();
            });

            if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }
            pendingFile = null;
            avatarBtn.style.display = 'none';
            showMsg(avatarMsg, 'Foto atualizada!', true);
        } catch (err) {
            showMsg(avatarMsg, err.message, false);
        } finally {
            avatarBtn.disabled = false;
            if (avatarBtn.querySelector('span')) avatarBtn.querySelector('span').textContent = origText;
        }
    });
}

// ─── Preferências: Tema ───────────────────────────────────────────────────────
const themeToggle = document.getElementById('pref-theme');
if (themeToggle) {
    const isLight = () => document.body.classList.contains('light-mode');
    const sync    = () => themeToggle.classList.toggle('on', isLight());
    sync();
    themeToggle.addEventListener('click', () => {
        const light = document.body.classList.toggle('light-mode');
        localStorage.setItem('gymbros_theme', light ? 'light' : 'dark');
        sync();
    });
}

// ─── Preferências: Idioma ─────────────────────────────────────────────────────
const langSelect = document.getElementById('pref-lang');
if (langSelect) {
    langSelect.value = localStorage.getItem('gymbros_lang') || 'pt';
    langSelect.addEventListener('change', () => {
        localStorage.setItem('gymbros_lang', langSelect.value);
        // Dispara o sistema de tradução se existir
        if (typeof window.changeLang === 'function') window.changeLang(langSelect.value);
        else location.reload();
    });
}

// ─── Preferências: Notificações ───────────────────────────────────────────────
const notifToggle = document.getElementById('pref-notif');
if (notifToggle) {
    const key   = 'gymbros_notif_enabled';
    const sync  = () => notifToggle.classList.toggle('on', localStorage.getItem(key) !== 'false');
    sync();
    notifToggle.addEventListener('click', () => {
        const cur = localStorage.getItem(key) !== 'false';
        localStorage.setItem(key, cur ? 'false' : 'true');
        sync();
    });
}
