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
      from: 'GymBros <onboarding@resend.dev>',
      to: [to],
      subject: `GymBros | Detalhes da sua assinatura — ${planoNome}`,
      html: `
        <h2>Olá, ${nome} 👋</h2>
        <p>Seu documento de pagamento do plano <strong>${planoNome}</strong> já está disponível.</p>
        <p><strong>Valor:</strong> ${valorFmt}</p>
        <p><strong>Código para pagamento:</strong><br>${linhaDigitavel}</p>
        <p>O arquivo em PDF está anexado para sua conveniência.</p>
        <p>Se tiver qualquer dúvida, estamos por aqui 💪</p>
        <br>
        <p>Equipe GymBros</p>
      `,
      attachments,
    });

    console.log('[email] Email enviado via Resend para:', to, response);

    return { ok: true, response };
  } catch (err) {
    console.error('[email] Erro ao enviar via Resend:', err);
    throw err;
  }
}

module.exports = { enviarBoleto };