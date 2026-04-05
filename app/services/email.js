'use strict';
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST) {
    console.log('[email] SMTP não configurado (faltando SMTP_HOST)');
    return null;
  }

  const port = Number(process.env.SMTP_PORT) || 587;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },

    // ajuda a debugar conexão SMTP
    logger: true,
    debug: true,

    // fallback pra evitar erro de certificado (TEMPORÁRIO)
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
}

async function enviarBoleto({
  to,
  nome,
  planoNome,
  valor,
  linhaDigitavel,
  pdfBuffer,
}) {
  const tp = getTransporter();

  if (!tp) {
    console.log(
      `[email] SMTP não configurado — boleto para ${to} (${planoNome} ${valor})`
    );
    return { ok: true, simulado: true };
  }

  const valorFmt = Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  try {
    await tp.sendMail({
      from:
        process.env.SMTP_FROM ||
        '"GymBros" <noreply@gymbros.com.br>',
      to,
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
      attachments: pdfBuffer
        ? [
            {
              filename: 'boleto-gymbros.pdf',
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ]
        : [],
    });

    console.log('[email] Email enviado com sucesso para:', to);

    return { ok: true, simulado: false };
  } catch (err) {
    console.error('[email] Erro ao enviar:', err);
    throw err;
  }
}

module.exports = { enviarBoleto };