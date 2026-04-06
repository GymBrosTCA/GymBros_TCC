'use strict';

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function enviarBoleto({
  to,
  nome,
  planoNome,
  valor,
  linhaDigitavel,
  pdfBuffer,
}) {
  const valorFmt = Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  try {
    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: 'boleto-gymbros.pdf',
        content: pdfBuffer.toString('base64'),
      });
    }

    const response = await resend.emails.send({
      // remetente autorizado (não quebra SPF/DKIM)
      from: 'GymBros <onboarding@resend.dev>',
      reply_to: 'contato.gymbross@gmail.com',
      to: [to],
      subject: `GymBros | Detalhes da sua assinatura — ${planoNome}`,
      html: `
        <h2>Olá, ${nome} 👋</h2>
        <p>Seu documento de pagamento do plano <strong>${planoNome}</strong> já está disponível.</p>
        <p><strong>Valor:</strong> ${valorFmt}</p>
        <p><strong>Código para pagamento:</strong><br>${linhaDigitavel}</p>
        <p>O arquivo em PDF está anexado para sua conveniência.</p>
        <br>
        <p>Se tiver qualquer dúvida, é só responder este email 💪</p>
        <p>Equipe GymBros</p>
      `,

      attachments,
    });

    // valida resposta
    if (response.error) {
      console.error('[email] erro resend:', response.error);
      throw new Error(response.error.message);
    }

    console.log('[email] enviado com sucesso:', to);
    return { ok: true };

  } catch (err) {
    console.error('[email] erro geral:', err);
    throw err;
  }
}

module.exports = { enviarBoleto };