const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { LICENSE_GENERATOR_PUBLIC_KEY_BASE64 } = require('../../pos-be/src/config/licenseGeneratorPublicKey');

const androidRoot = path.resolve(__dirname, '..');
const privateKeyPath = path.join(androidRoot, '.license-generator-private.jwk');
const templatePath = path.join(androidRoot, 'generator.template.html');
const outputPath = path.join(androidRoot, 'generator.html');

if (!fs.existsSync(privateKeyPath)) {
  throw new Error('Kunci privat generator lokal tidak ditemukan. Jangan membuat kunci baru tanpa memperbarui verifier server.');
}

const privateJwk = JSON.parse(fs.readFileSync(privateKeyPath, 'utf8'));
const privateKey = crypto.createPrivateKey({ key: privateJwk, format: 'jwk' });
const derivedPublicKey = crypto.createPublicKey(privateKey)
  .export({ format: 'der', type: 'spki' })
  .toString('base64');

if (derivedPublicKey !== LICENSE_GENERATOR_PUBLIC_KEY_BASE64) {
  throw new Error('Kunci privat lokal tidak cocok dengan kunci publik aplikasi. Generator dibatalkan.');
}

const template = fs.readFileSync(templatePath, 'utf8');
if (!template.includes('__PRIVATE_JWK__')) {
  throw new Error('Template generator tidak memiliki placeholder kunci privat.');
}

fs.writeFileSync(
  outputPath,
  template.replace('__PRIVATE_JWK__', JSON.stringify(privateJwk)),
  'utf8',
);

process.stdout.write(`Generator lokal dibuat: ${outputPath}`);
