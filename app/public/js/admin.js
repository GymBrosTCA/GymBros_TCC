'use strict';

// ── SSE: conecta ao stream de eventos do admin ────────────────────────────────
(function initSSE() {
    const sse = new EventSource('/api/admin/stream');
    window._adminSSE = sse;

    sse.addEventListener('new_ticket', function(e) {
        const t = JSON.parse(e.data);
        addNotif('ticket', `<strong>${escHtml(t.userName)}</strong> abriu um chamado: ${escHtml(t.assunto)}`, '/admin/suporte/' + t.ticketId);
        toast('Novo chamado de ' + t.userName, 'warning', 5000);
        updateNavBadge(1);
    });

    sse.addEventListener('ticket_message', function(e) {
        const t = JSON.parse(e.data);
        addNotif('message', `<strong>${escHtml(t.userName)}</strong> enviou uma mensagem no ticket: ${escHtml(t.assunto)}`, '/admin/suporte/' + t.ticketId);
        toast('Nova mensagem de ' + t.userName, 'info', 4000);
    });

    sse.addEventListener('user_online', function(e) {
        const u = JSON.parse(e.data);
        addNotif('user', `<strong>${escHtml(u.nome)}</strong> entrou no site`, '/admin/usuarios');
        updateOnlineCount(1);
    });

    sse.addEventListener('user_activity', function(e) {
        const u = JSON.parse(e.data);
        updateOnlineCount(0); // just refresh display
    });

    sse.addEventListener('online_users', function(e) {
        const users = JSON.parse(e.data);
        setOnlineCount(users.length);
    });

    sse.onerror = function() {
        // Silent reconnect — browser handles automatically
    };

    window.addEventListener('beforeunload', function() { sse.close(); }, { once: true });
})();

// ── Notificações (notification center) ───────────────────────────────────────
let _notifCount = 0;

function addNotif(type, html, href) {
    _notifCount++;
    const badge = document.getElementById('notif-badge');
    if (badge) { badge.style.display = 'inline-block'; badge.textContent = _notifCount > 99 ? '99+' : _notifCount; }

    const list = document.getElementById('notif-list');
    if (!list) return;
    const empty = list.querySelector('.admin-notif-empty');
    if (empty) empty.remove();

    const icons = { ticket: 'fa-headset text-warning', message: 'fa-comment text-info', user: 'fa-user text-success' };
    const el = document.createElement('a');
    el.href = href || '#';
    el.className = 'admin-notif-item notif-new';
    el.innerHTML = `<span class="notif-icon"><i class="fas ${icons[type] || 'fa-bell'}"></i></span><span class="notif-text">${html}</span><span class="notif-time">agora</span>`;
    list.prepend(el);
    setTimeout(() => el.classList.remove('notif-new'), 500);

    // Limita a 20 notificações
    while (list.children.length > 20) list.lastElementChild.remove();
}

function clearNotifs() {
    _notifCount = 0;
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none';
    const list = document.getElementById('notif-list');
    if (list) list.innerHTML = '<section class="admin-notif-empty">Nenhuma atividade ainda</section>';
}

function updateNavBadge(delta) {
    const el = document.querySelector('.admin-nav-badge');
    if (el) el.textContent = (parseInt(el.textContent) || 0) + delta;
}

function updateOnlineCount(delta) {
    const el = document.getElementById('online-count');
    if (el) el.textContent = Math.max(0, (parseInt(el.textContent) || 0) + delta);
    const badge = document.getElementById('online-count-badge');
    if (badge) badge.textContent = el ? el.textContent : '0';
}

function setOnlineCount(n) {
    const el = document.getElementById('online-count');
    if (el) el.textContent = n;
    const badge = document.getElementById('online-count-badge');
    if (badge) badge.textContent = n;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success', duration = 3500) {
    let container = document.getElementById('admin-toasts');
    if (!container) {
        container = document.createElement('section');
        container.id = 'admin-toasts';
        container.className = 'admin-toasts';
        document.body.appendChild(container);
    }
    const icon = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' }[type] || 'fa-info-circle';
    const el = document.createElement('section');
    el.className = `admin-toast ${type}`;
    el.innerHTML = `<i class="fas ${icon}"></i><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; el.style.transition = '0.3s'; setTimeout(() => el.remove(), 310); }, duration);
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(id)  { const m = document.getElementById(id); if (m) m.classList.add('open'); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('open'); }

document.addEventListener('click', e => {
    if (e.target.matches('[data-modal-open]'))  openModal(e.target.dataset.modalOpen);
    if (e.target.matches('[data-modal-close]')) closeModal(e.target.dataset.modalClose);
    if (e.target.matches('.admin-modal-backdrop') && !e.target.closest('.admin-modal')) {
        e.target.classList.remove('open');
    }
});

// ── API helper ────────────────────────────────────────────────────────────────
async function adminFetch(url, opts = {}) {
    const defaults = { headers: { 'Content-Type': 'application/json' } };
    const res  = await fetch(url, { ...defaults, ...opts, headers: { ...defaults.headers, ...(opts.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || `HTTP ${res.status}`);
    return data;
}

// ── Desativar usuário ─────────────────────────────────────────────────────────
document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-toggle-user]');
    if (!btn) return;
    const id = btn.dataset.toggleUser;
    if (!confirm('Confirma alteração de status deste usuário?')) return;
    try {
        const data = await adminFetch(`/api/admin/usuarios/${id}/desativar`, { method: 'POST' });
        toast(data.mensagem, 'success');
        setTimeout(() => location.reload(), 800);
    } catch (err) { toast(err.message, 'error'); }
});

// ── Toggle academia ───────────────────────────────────────────────────────────
document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-toggle-academia]');
    if (!btn) return;
    const id = btn.dataset.toggleAcademia;
    if (!confirm('Confirma alteração de status desta academia?')) return;
    try {
        const data = await adminFetch(`/api/admin/academias/${id}/toggle`, { method: 'POST' });
        toast(data.mensagem, 'success');
        setTimeout(() => location.reload(), 800);
    } catch (err) { toast(err.message, 'error'); }
});

// ── Criar academia ────────────────────────────────────────────────────────────
const formAcademia = document.getElementById('form-academia');
if (formAcademia) {
    formAcademia.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(formAcademia));
        try {
            await adminFetch('/api/admin/academias', { method: 'POST', body: JSON.stringify(fd) });
            toast('Academia criada!', 'success');
            setTimeout(() => location.reload(), 900);
        } catch (err) { toast(err.message, 'error'); }
    });
}

// ── Criar plano ───────────────────────────────────────────────────────────────
const formPlano = document.getElementById('form-plano');
if (formPlano) {
    formPlano.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(formPlano));
        fd.beneficios = (fd.beneficios || '').split('\n').map(s => s.trim()).filter(Boolean);
        const id     = formPlano.dataset.editId;
        const url    = id ? `/api/admin/planos/${id}` : '/api/admin/planos';
        const method = id ? 'PUT' : 'POST';
        try {
            await adminFetch(url, { method, body: JSON.stringify(fd) });
            toast(id ? 'Plano atualizado!' : 'Plano criado!', 'success');
            setTimeout(() => location.reload(), 900);
        } catch (err) { toast(err.message, 'error'); }
    });
}

// ── Mudar status do ticket ────────────────────────────────────────────────────
document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-ticket-status]');
    if (!btn) return;
    const { ticketId, ticketStatus } = btn.dataset;
    try {
        await adminFetch(`/api/admin/suporte/tickets/${ticketId}/status`, { method: 'PUT', body: JSON.stringify({ status: ticketStatus }) });
        toast('Status atualizado!', 'success');
        // Update pill inline if present
        const pill = document.querySelector('.ticket-status-pill');
        if (pill) { pill.textContent = ticketStatus.replace('_',' '); pill.className = 'ticket-status-pill ' + ticketStatus; }
        setTimeout(() => location.reload(), 700);
    } catch (err) { toast(err.message, 'error'); }
});

// ── Enviar notificação ────────────────────────────────────────────────────────
const formNotif = document.getElementById('form-notificacao');
if (formNotif) {
    formNotif.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(formNotif));
        try {
            await adminFetch('/api/admin/notificacoes', { method: 'POST', body: JSON.stringify(fd) });
            toast('Notificação enviada!', 'success');
            formNotif.reset();
            // Adiciona ao histórico dinâmicamente sem recarregar a página
            const hist = document.querySelector('.admin-card-body.no-pad');
            if (hist) {
                const empty = hist.querySelector('.admin-empty');
                if (empty) empty.remove();
                const tipoBadge = fd.tipo === 'alerta' ? 'badge-warning' : fd.tipo === 'promocao' ? 'badge-gold' : 'badge-info';
                const destLabel = fd.destinatarios === 'todos' ? 'Todos' : 'Plano específico';
                // historyEntry: distinct notification record in the history list
                const historyEntry = document.createElement('section');
                historyEntry.style.cssText = 'padding:14px 16px;border-bottom:1px solid var(--border);animation:fadeIn .3s ease';
                historyEntry.innerHTML = `
                    <section class="flex-between">
                        <span class="fw-600" style="font-size:.875rem">${escHtml(fd.titulo)}</span>
                        <span class="badge ${tipoBadge}">${escHtml(fd.tipo)}</span>
                    </section>
                    <section class="text-muted" style="font-size:.8rem;margin-top:4px">${escHtml(fd.mensagem)}</section>
                    <section class="text-muted" style="font-size:.72rem;margin-top:6px">
                        <i class="fas fa-users"></i> ${destLabel} •
                        <i class="fas fa-clock"></i> ${new Date().toLocaleDateString('pt-BR')} •
                        <i class="fas fa-eye"></i> 0 leituras
                    </section>`;
                hist.insertBefore(historyEntry, hist.firstChild);
            }
        } catch (err) { toast(err.message, 'error'); }
    });
}

// ── Salvar configurações ──────────────────────────────────────────────────────
const formConfig = document.getElementById('form-config');
if (formConfig) {
    formConfig.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(formConfig));
        fd.maintenance = formConfig.querySelector('[name=maintenance]')?.checked || false;
        try {
            await adminFetch('/api/admin/configuracoes', { method: 'PUT', body: JSON.stringify(fd) });
            toast('Configurações salvas!', 'success');
        } catch (err) { toast(err.message, 'error'); }
    });
}

const formSenha = document.getElementById('form-senha-admin');
if (formSenha) {
    formSenha.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(formSenha));
        try {
            await adminFetch('/api/admin/configuracoes/senha', { method: 'POST', body: JSON.stringify(fd) });
            toast('Senha alterada!', 'success');
            formSenha.reset();
        } catch (err) { toast(err.message, 'error'); }
    });
}

// ── Sidebar toggle (mobile) ───────────────────────────────────────────────────
const sidebarToggle = document.getElementById('admin-sidebar-toggle');
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        document.querySelector('.admin-sidebar')?.classList.toggle('open');
    });
}

// ── Escape html ───────────────────────────────────────────────────────────────
function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
