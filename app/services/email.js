'use strict';

const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function formatarMoeda(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    throw new Error('Valor inválido para formatação monetária.');
  }

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function enviarBoleto({
  to,
  nome,
  planoNome,
  valor,
  linhaDigitavel,
  pdfBuffer,
}) {
  if (!resend) {
    throw new Error('RESEND_API_KEY não definida.');
  }

  if (!to || typeof to !== 'string') {
    throw new Error('Email de destino inválido.');
  }

  if (!nome || typeof nome !== 'string') {
    throw new Error('Nome do destinatário inválido.');
  }

  if (!planoNome || typeof planoNome !== 'string') {
    throw new Error('Nome do plano inválido.');
  }

  if (valor === undefined || valor === null) {
    throw new Error('Valor do boleto é obrigatório.');
  }

  if (!linhaDigitavel || typeof linhaDigitavel !== 'string') {
    throw new Error('Linha digitável inválida.');
  }

  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new Error('pdfBuffer é obrigatório e deve ser um Buffer.');
  }

  const valorFmt = formatarMoeda(valor);

  const nomeSafe = escapeHtml(nome);
  const planoNomeSafe = escapeHtml(planoNome);
  const linhaDigitavelSafe = escapeHtml(linhaDigitavel);

  const attachments = [
    {
      filename: 'boleto-gymbros.pdf',
      content: pdfBuffer.toString('base64'),
    },
  ];

  const html = `
    <h2>Olá, ${nomeSafe} 👋</h2>
    <p>Seu documento de pagamento do plano <strong>${planoNomeSafe}</strong> já está disponível.</p>
    <p><strong>Valor:</strong> ${valorFmt}</p>
    <p><strong>Código para pagamento:</strong><br>${linhaDigitavelSafe}</p>
    <p>O arquivo em PDF está anexado para sua conveniência.</p>
    <br>
    <p>Se tiver qualquer dúvida, é só responder este email 💪</p>
    <p>Equipe GymBros</p>
  `;

  const text = `
Olá, ${nome}

Seu documento de pagamento do plano ${planoNome} já está disponível.
Valor: ${valorFmt}
Código para pagamento: ${linhaDigitavel}

O arquivo em PDF está anexado para sua conveniência.

Se tiver qualquer dúvida, é só responder este email.
Equipe GymBros
  `.trim();

  try {
    const response = await resend.emails.send({
      from: 'GymBros <noreply@gymbros.app.br>',
      reply_to: 'contato@gymbros.app.br',
      to: [to],
      subject: `GymBros | Detalhes da sua assinatura — ${planoNome}`,
      html,
      text,
      attachments,
    });

    if (response?.error) {
      console.error('[email] erro resend:', response.error);
      throw new Error(response.error.message);
    }

    console.log('[email] enviado com sucesso:', to);

    return {
      ok: true,
      id: response?.data?.id || null,
    };
  } catch (err) {
    console.error('[email] erro geral:', err);
    throw err;
  }
}

module.exports = { enviarBoleto };