document.addEventListener('DOMContentLoaded', () => {

    // Função para enviar formulário via AJAX
    async function submitForm(form, type) {
        const btn = form.querySelector('button');
        const message = form.querySelector('.form-message');

        // Bloqueia botão e indica loading
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Enviando...';

        // Pega os dados
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => data[key] = value);

        let url = '';
        if (type === 'data') url = '/config/atualizar-dados';
        if (type === 'password') url = '/config/alterar-senha';
        if (type === 'plan') url = '/config/alterar-plano';

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const json = await res.json();

            if (!res.ok) throw new Error(json.erro || 'Erro inesperado');

            // Sucesso
            message.textContent = json.mensagem;
            message.classList.add('show');
            message.style.color = '#32CD32';

            // Atualiza inputs (apenas dados pessoais)
            if (type === 'data') {
                document.querySelector('#nome').value = data.nome;
                document.querySelector('#email').value = data.email;
            }

            // Limpa mensagens após 3s
            setTimeout(() => message.classList.remove('show'), 3000);

        } catch (err) {
            message.textContent = err.message;
            message.classList.add('show');
            message.style.color = '#FF4C4C';
            setTimeout(() => message.classList.remove('show'), 3000);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    // Formulário de dados pessoais
    const formData = document.querySelector('#form-dados');
    if(formData){
        formData.addEventListener('submit', e => {
            e.preventDefault();
            submitForm(formData, 'data');
        });
    }

    // Formulário de senha
    const formSenha = document.querySelector('#form-senha');
    if(formSenha){
        formSenha.addEventListener('submit', e => {
            e.preventDefault();
            submitForm(formSenha, 'password');
        });
    }

    // Formulário de plano
    const formPlano = document.querySelector('#form-plano');
    if(formPlano){
        formPlano.addEventListener('submit', e => {
            e.preventDefault();
            submitForm(formPlano, 'plan');
        });
    }

});
