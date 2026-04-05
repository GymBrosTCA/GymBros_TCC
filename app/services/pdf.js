'use strict';
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');

function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function formatLinhaDigitavel(linha = '') {
  const d = onlyDigits(linha);

  // Formatação comum de boleto bancário (47 dígitos)
  if (d.length === 47) {
    return [
      d.slice(0, 5) + '.' + d.slice(5, 10),
      d.slice(10, 15) + '.' + d.slice(15, 21),
      d.slice(21, 26) + '.' + d.slice(26, 32),
      d.slice(32, 33),
      d.slice(33),
    ].join(' ');
  }

  return linha;
}

function linhaParaCodigoBarras(linha = '') {
  const d = onlyDigits(linha);

  // Conversão da linha digitável (47) para código de barras (44)
  // usada em boletos bancários
  if (d.length !== 47) return d;

  return (
    d.slice(0, 4) +     // banco + moeda
    d.slice(32, 33) +   // DV geral
    d.slice(33, 47) +   // fator vencimento + valor
    d.slice(4, 9) +     // campo livre 1
    d.slice(10, 20) +   // campo livre 2
    d.slice(21, 31)     // campo livre 3
  );
}

async function gerarCodigoBarrasBuffer(barcodeText) {
  return bwipjs.toBuffer({
    bcid: 'interleaved2of5',
    text: barcodeText,
    scale: 2,
    height: 18,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  });
}

function box(doc, x, y, w, h, title, lines = []) {
  doc
    .roundedRect(x, y, w, h, 6)
    .lineWidth(1)
    .strokeColor('#D8D8D8')
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#222')
    .text(title, x + 12, y + 10);

  let lineY = y + 30;
  for (const line of lines) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#333')
      .text(line, x + 12, lineY, { width: w - 24 });
    lineY += 16;
  }
}

async function gerarBoletoPDF({
  nome,
  email,
  planoNome,
  valor,
  linhaDigitavel,
  vencimento,
}) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const usableWidth = pageWidth - 72;
      const brand = '#C98B1D';
      const dark = '#202020';
      const muted = '#666';

      const valorFmt = Number(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

      const linhaFmt = formatLinhaDigitavel(linhaDigitavel);
      const codigoBarras = linhaParaCodigoBarras(linhaDigitavel);
      const barcodePng = codigoBarras.length >= 44
        ? await gerarCodigoBarrasBuffer(codigoBarras)
        : null;

      // fundo branco
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFFFF');
      doc.fillColor(dark);

      // topo
      doc
        .font('Helvetica-Bold')
        .fontSize(24)
        .fillColor(brand)
        .text('GymBros', 36, 30);

      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(muted)
        .text('Boleto bancário', 36, 60);

      doc
        .moveTo(36, 82)
        .lineTo(pageWidth - 36, 82)
        .lineWidth(1.5)
        .strokeColor(brand)
        .stroke();

      // cabeçalho estilo boleto
      doc
        .roundedRect(36, 98, usableWidth, 52, 6)
        .fillAndStroke('#FAFAFA', '#D8D8D8');

      doc.fillColor('#222');
      doc.font('Helvetica-Bold').fontSize(11).text('Beneficiário', 48, 110);
      doc.font('Helvetica').fontSize(10).text('GymBros Tecnologia e Bem-estar', 48, 126);

      doc.font('Helvetica-Bold').fontSize(11).text('Vencimento', 390, 110, { width: 120, align: 'right' });
      doc.font('Helvetica').fontSize(10).text(String(vencimento), 390, 126, { width: 120, align: 'right' });

      // blocos
      box(doc, 36, 165, 255, 92, 'Pagador', [
        `Nome: ${nome}`,
        `E-mail: ${email}`,
      ]);

      box(doc, 305, 165, 254, 92, 'Cobrança', [
        `Plano: ${planoNome}`,
        `Valor: ${valorFmt}`,
        'Banco: 237 - Banco Bradesco S.A.',
      ]);

      box(doc, 36, 272, usableWidth, 66, 'Linha digitável', [linhaFmt]);

      // barra destacada da linha digitável
      doc
        .roundedRect(36, 352, usableWidth, 42, 6)
        .fillAndStroke('#FFF8E8', '#E7C26D');

      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#111')
        .text(linhaFmt, 50, 366, { width: usableWidth - 28, align: 'center' });

      // código de barras
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#222')
        .text('Código de barras', 36, 418);

      if (barcodePng) {
        doc
          .roundedRect(36, 436, usableWidth, 92, 6)
          .strokeColor('#D8D8D8')
          .stroke();

        doc.image(barcodePng, 48, 452, {
          fit: [usableWidth - 24, 54],
          align: 'center',
          valign: 'center',
        });

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#444')
          .text(codigoBarras, 36, 510, {
            width: usableWidth,
            align: 'center',
          });
      } else {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#900')
          .text('Não foi possível gerar o código de barras com a linha digitável informada.', 36, 446);
      }

      // instruções
      box(doc, 36, 548, usableWidth, 110, 'Instruções', [
        '• Não receber após o vencimento.',
        '• Após a confirmação do pagamento, a assinatura pode levar até 2 dias úteis para ser ativada.',
        '• Em caso de dúvidas, entre em contato com o suporte GymBros.',
        '• Este boleto foi gerado automaticamente para fins de demonstração.',
      ]);

      // rodapé
      doc
        .moveTo(36, 690)
        .lineTo(pageWidth - 36, 690)
        .lineWidth(0.8)
        .strokeColor('#E2E2E2')
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#999')
        .text('GymBros — plataforma digital de saúde e bem-estar', 36, 700, {
          width: usableWidth,
          align: 'center',
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { gerarBoletoPDF };