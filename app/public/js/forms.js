// forms.js
const loginForm    = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// Limpa os campos do registro após carregamento para evitar autofill do navegador
if (registerForm) {
    // Timeout curto: Chrome preenche autofill APÓS DOMContentLoaded
    setTimeout(() => {
        registerForm.querySelectorAll('input').forEach(input => {
            if (input.type !== 'checkbox') input.value = '';
        });
    }, 100);
}

// =============================================
// MÁSCARAS
// =============================================
function maskCPF(v) {
    return v.replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
            .slice(0, 14);
}

function maskCEP(v) {
    return v.replace(/\D/g, '')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .slice(0, 9);
}

const cpfInput = document.getElementById('cpf');
const cepInput = document.getElementById('cep');

if (cpfInput) cpfInput.addEventListener('input', e => { e.target.value = maskCPF(e.target.value); });
if (cepInput) cepInput.addEventListener('input', e => { e.target.value = maskCEP(e.target.value); });

// =============================================
// SHOW / HIDE PASSWORD
// =============================================
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        const icon  = btn.querySelector('i');
        if (input.type === 'password') {
            input.type     = 'text';
            icon.className = 'bx bx-show';
            btn.classList.add('visible');
        } else {
            input.type     = 'password';
            icon.className = 'bx bx-hide';
            btn.classList.remove('visible');
        }
    });
});

// =============================================
// VALIDAÇÃO EM TEMPO REAL
// =============================================
function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    return resto === parseInt(cpf[10]);
}

function setFieldState(input, errorEl, isValid, msg) {
    input.classList.toggle('input-valid',   isValid);
    input.classList.toggle('input-invalid', !isValid);
    if (errorEl) errorEl.textContent = isValid ? '' : msg;
    if (!isValid) {
        const box = input.closest('.input-box');
        if (box) {
            box.classList.remove('shake');
            void box.offsetWidth; // força reflow para reiniciar animação
            box.classList.add('shake');
        }
    }
}

const rules = {
    nome:            v => v.trim().length >= 3    ? [true] : [false, 'Nome deve ter ao menos 3 caracteres.'],
    cpf:             v => validarCPF(v)            ? [true] : [false, 'CPF inválido.'],
    email:           v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? [true] : [false, 'E-mail inválido.'],
    cep:             v => v.replace(/\D/g,'').length === 8 ? [true] : [false, 'CEP deve ter 8 dígitos.'],
    password:        v => v.length >= 6           ? [true] : [false, 'Senha deve ter ao menos 6 caracteres.'],
    confirmPassword: v => {
        const pw = document.getElementById('password');
        return (pw && v === pw.value) ? [true] : [false, 'As senhas não coincidem.'];
    },
    username:        v => v.trim().length > 0     ? [true] : [false, 'Campo obrigatório.'],
};

['nome','cpf','email','cep','password','confirmPassword','username'].forEach(id => {
    const input = document.getElementById(id);
    if (!input || !rules[id]) return;

    input.addEventListener('blur', () => {
        if (!input.value) return;
        const [ok, msg] = rules[id](input.value);
        setFieldState(input, document.getElementById(`${id}-error`), ok, msg || '');
    });

    input.addEventListener('input', () => {
        if (!input.classList.contains('input-invalid')) return;
        const [ok, msg] = rules[id](input.value);
        setFieldState(input, document.getElementById(`${id}-error`), ok, msg || '');
    });
});

// =============================================
// LOGIN
// =============================================
if (loginForm) {
    loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        loginForm.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        const successEl = loginForm.querySelector('.success-message');
        successEl.textContent = '';

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        try {
            const res  = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username, password })
            });
            const data = await res.json();

            if (res.status !== 200) {
                data.erros.forEach(err => {
                    const input = document.getElementById(err.param);
                    const el    = document.getElementById(`${err.param}-error`);
                    if (el) el.textContent = err.msg;
                    if (input) setFieldState(input, el, false, err.msg);
                });
                return;
            }

            successEl.textContent = data.mensagem;
            setTimeout(() => { window.location.href = '/area-aluno'; }, 1000);
        } catch (err) {
            console.error(err);
            successEl.textContent = 'Erro inesperado. Tente novamente.';
        }
    });
}

// =============================================
// REGISTER
// =============================================
if (registerForm) {
    registerForm.addEventListener('submit', async e => {
        e.preventDefault();
        registerForm.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        const successEl = registerForm.querySelector('.success-message');
        successEl.textContent = '';

        const formData = {
            nome:            document.getElementById('nome').value.trim(),
            cpf:             document.getElementById('cpf').value.replace(/\D/g, ''),
            email:           document.getElementById('email').value.trim(),
            cep:             document.getElementById('cep').value.replace(/\D/g, ''),
            password:        document.getElementById('password').value,
            confirmPassword: document.getElementById('confirmPassword').value,
            terms:           document.getElementById('terms').checked ? 'on' : ''
        };

        try {
            const res  = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(formData)
            });
            const data = await res.json();

            if (res.status !== 200) {
                data.erros.forEach(err => {
                    const input = document.getElementById(err.param);
                    const el    = document.getElementById(`${err.param}-error`);
                    if (el) el.textContent = err.msg;
                    if (input) setFieldState(input, el, false, err.msg);
                });
                return;
            }

            successEl.textContent = data.mensagem;
            setTimeout(() => { window.location.href = '/login'; }, 1500);
        } catch (err) {
            console.error(err);
            successEl.textContent = 'Erro inesperado. Tente novamente.';
        }
    });
}
