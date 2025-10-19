// forms.js
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// ----------- LOGIN -----------
if (loginForm) {
    loginForm.addEventListener('submit', async e => {
        e.preventDefault();

        // limpa erros
        loginForm.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        const successEl = loginForm.querySelector('.success-message');
        successEl.textContent = '';

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username, password })
            });
            const data = await res.json();

            if (res.status !== 200) {
                data.erros.forEach(err => {
                    const el = document.getElementById(`${err.param}-error`);
                    if (el) el.textContent = err.msg;
                });
                return;
            }

            // sucesso
            successEl.textContent = data.mensagem;

            setTimeout(() => {
                window.location.href = '/area-aluno';
            }, 1000);

        } catch (err) {
            console.error(err);
            successEl.textContent = 'Erro inesperado. Tente novamente.';
        }
    });
}

// ----------- REGISTER -----------
if (registerForm) {
    registerForm.addEventListener('submit', async e => {
        e.preventDefault();

        // limpa erros
        registerForm.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        const successEl = registerForm.querySelector('.success-message');
        successEl.textContent = '';

        const formData = {
            nome: document.getElementById('nome').value.trim(),
            cpf: document.getElementById('cpf').value.trim(),
            email: document.getElementById('email').value.trim(),
            cep: document.getElementById('cep').value.trim(),
            password: document.getElementById('password').value,
            confirmPassword: document.getElementById('confirmPassword').value,
            terms: document.getElementById('terms').checked ? 'on' : ''
        };

        try {
            const res = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(formData)
            });
            const data = await res.json();

            if (res.status !== 200) {
                data.erros.forEach(err => {
                    const el = document.getElementById(`${err.param}-error`);
                    if (el) el.textContent = err.msg;
                });
                return;
            }

            // sucesso
            successEl.textContent = data.mensagem;

            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);

        } catch (err) {
            console.error(err);
            successEl.textContent = 'Erro inesperado. Tente novamente.';
        }
    });
}
