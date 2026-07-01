const { execSync } = require('child_process');
const fs = require('fs');

try {
  const commit = execSync('git rev-parse --short HEAD')
    .toString()
    .trim();

  const branch = execSync('git rev-parse --abbrev-ref HEAD')
    .toString()
    .trim();

  const date = new Date().toISOString();

  const content = `
// Este archivo es generado automáticamente.

export const version = {
  commit: '${commit}',
  branch: '${branch}',
  buildDate: '${date}'
};
`;

  fs.writeFileSync(
    './src/environments/version.ts',
    content
  );

  console.log(`✔ Version generada (${commit})`);
} catch (err) {
  console.error('No fue posible generar version.ts');
}