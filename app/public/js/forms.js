document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        clearErrors();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember').checked;
        
        // Validação frontend
        let isValid = true;
        
        if (username.length < 4) {
            showError('username-error', 'Usuário deve ter pelo menos 4 caracteres');
            isValid = false;
        }
        
        if (password.length < 6) {
            showError('password-error', 'Senha deve ter pelo menos 6 caracteres');
            isValid = false;
        }
        
        if (!isValid) return;
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, rememberMe })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Erro no login');
            }
            
            // Login bem-sucedido
            localStorage.setItem('token', data.token);
            window.location.href = '/dashboard';
            
        } catch (error) {
            showError('password-error', error.message);
            console.error('Login error:', error);
        }
    });
    
    function showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        errorElement.textContent = message;
    }
    
    function clearErrors() {
        document.querySelectorAll('.error-message').forEach(el => {
            el.textContent = '';
        });
    }
});