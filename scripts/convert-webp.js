/**
 * scripts/convert-webp.js
 * Converte todas as imagens PNG/JPG para WebP e gera a imagem OG padrão 1200×630.
 *
 * Uso:  node scripts/convert-webp.js
 * Deps: npm install sharp  (já no devDependencies após esse script)
 */

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const IMG_DIR  = path.join(__dirname, '../app/public/images');
const ORIG_DIR = path.join(IMG_DIR, 'originals');
const WEBP_QUALITY = 85;

// ── Garante pasta de originais ──────────────────────────────────────────────
fs.mkdirSync(ORIG_DIR, { recursive: true });

// ── SVG da imagem OG padrão 1200×630 ───────────────────────────────────────
const OG_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <!-- fundo escuro -->
  <rect width="1200" height="630" fill="#121212"/>

  <!-- faixa dourada lateral esquerda -->
  <rect x="0" y="0" width="8" height="630" fill="#FFD700"/>

  <!-- área safe zone 630×630 centrada -->
  <!-- logo placeholder: círculo dourado -->
  <circle cx="600" cy="230" r="90" fill="#FFD700" opacity="0.12"/>
  <circle cx="600" cy="230" r="68" fill="#FFD700" opacity="0.25"/>

  <!-- haltere SVG simplificado (ícone) -->
  <rect x="548" y="220" width="104" height="20" rx="10" fill="#FFD700"/>
  <rect x="548" y="210" width="22" height="40" rx="8" fill="#FFD700"/>
  <rect x="630" y="210" width="22" height="40" rx="8" fill="#FFD700"/>
  <rect x="534" y="215" width="16" height="30" rx="6" fill="#FFD700" opacity="0.7"/>
  <rect x="650" y="215" width="16" height="30" rx="6" fill="#FFD700" opacity="0.7"/>

  <!-- título -->
  <text x="600" y="360" font-family="Arial, sans-serif" font-size="72" font-weight="800"
        fill="#FFD700" text-anchor="middle" letter-spacing="-1">GymBros</text>

  <!-- tagline -->
  <text x="600" y="415" font-family="Arial, sans-serif" font-size="26" font-weight="400"
        fill="#CCCCCC" text-anchor="middle">Academias Ilimitadas em Todo o Brasil</text>

  <!-- detalhes -->
  <text x="600" y="460" font-family="Arial, sans-serif" font-size="20"
        fill="#888888" text-anchor="middle">3.560+ academias · Treinos online · Personal Trainer IA</text>

  <!-- linha decorativa inferior -->
  <rect x="200" y="510" width="800" height="2" fill="#FFD700" opacity="0.3"/>

  <!-- URL -->
  <text x="600" y="555" font-family="Arial, sans-serif" font-size="18"
        fill="#555555" text-anchor="middle">gymbros.com.br</text>
</svg>`;

// ── Converte imagens ────────────────────────────────────────────────────────
async function run() {
    const files = fs.readdirSync(IMG_DIR).filter(f =>
        /\.(png|jpg|jpeg)$/i.test(f) && !f.startsWith('og-default')
    );

    console.log(`\n🔄  Convertendo ${files.length} imagem(ns) para WebP...\n`);

    for (const file of files) {
        const src  = path.join(IMG_DIR, file);
        const base = path.basename(file, path.extname(file));
        const dest = path.join(IMG_DIR, `${base}.webp`);
        const orig = path.join(ORIG_DIR, file);

        // Copia original (apenas se ainda não copiado)
        if (!fs.existsSync(orig)) fs.copyFileSync(src, orig);

        try {
            await sharp(src).webp({ quality: WEBP_QUALITY }).toFile(dest);
            const srcSize  = (fs.statSync(src).size  / 1024).toFixed(1);
            const destSize = (fs.statSync(dest).size / 1024).toFixed(1);
            console.log(`  ✓  ${file.padEnd(28)}  ${srcSize}KB → ${destSize}KB`);
        } catch (err) {
            console.warn(`  ✗  ${file}: ${err.message}`);
        }
    }

    // ── Gera og-default.jpg ─────────────────────────────────────────────────
    console.log('\n🖼   Gerando og-default.jpg (1200×630)...');
    try {
        await sharp(Buffer.from(OG_SVG))
            .resize(1200, 630)
            .jpeg({ quality: 90, mozjpeg: true })
            .toFile(path.join(IMG_DIR, 'og-default.jpg'));
        console.log('  ✓  og-default.jpg gerado com sucesso.');
    } catch (err) {
        console.error('  ✗  Erro ao gerar og-default.jpg:', err.message);
    }

    console.log('\n✅  Conversão concluída!');
    console.log('    Originais salvos em: app/public/images/originals/');
    console.log('    Execute novamente se adicionar novas imagens.\n');
}

run().catch(console.error);
