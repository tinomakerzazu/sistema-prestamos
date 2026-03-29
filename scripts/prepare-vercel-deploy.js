const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'deploy-vercel');

function rmIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyFileSafe(from, to) {
  if (!fs.existsSync(from)) return;
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

function copyDirFiltered(fromDir, toDir, shouldSkip) {
  ensureDir(toDir);
  for (const entry of fs.readdirSync(fromDir, { withFileTypes: true })) {
    if (shouldSkip(entry.name, entry.isDirectory(), fromDir)) {
      continue;
    }

    const sourcePath = path.join(fromDir, entry.name);
    const targetPath = path.join(toDir, entry.name);

    if (entry.isDirectory()) {
      copyDirFiltered(sourcePath, targetPath, shouldSkip);
      continue;
    }

    copyFileSafe(sourcePath, targetPath);
  }
}

function writeDeployReadme() {
  const content = `# Deploy para Vercel

Esta carpeta es una copia limpia del proyecto para desplegar en Vercel.

## Antes de hacer deploy
1. Configura variables en Vercel:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - SUPABASE_BUCKET
   - JWT_SECRET
2. Verifica que el bucket exista en Supabase.

## Deploy recomendado
1. Abre Vercel y crea un proyecto nuevo.
2. Importa esta carpeta \`deploy-vercel\`.
3. Framework preset: Other.
4. Deploy.
`;

  fs.writeFileSync(path.join(outputDir, 'README_DEPLOY.md'), content, 'utf8');
}

function main() {
  rmIfExists(outputDir);
  ensureDir(outputDir);

  // Archivos de configuración raíz necesarios para Vercel.
  const rootFiles = ['package.json', 'package-lock.json', 'vercel.json', '.env.example'];
  for (const fileName of rootFiles) {
    copyFileSafe(path.join(rootDir, fileName), path.join(outputDir, fileName));
  }

  // Frontend estático.
  copyDirFiltered(
    path.join(rootDir, 'sistema-corporacion-v2'),
    path.join(outputDir, 'sistema-corporacion-v2'),
    (name, isDir) => isDir && name === 'node_modules'
  );

  // Backend para funciones Node en Vercel.
  copyDirFiltered(path.join(rootDir, 'server'), path.join(outputDir, 'server'), (name, isDir) => {
    if (isDir && (name === 'node_modules' || name === 'uploads')) return true;
    if (name === '.env') return true;
    // Evita subir datos locales reales.
    if (name === 'data' && isDir) return true;
    return false;
  });

  // Scripts auxiliares opcionales.
  if (fs.existsSync(path.join(rootDir, 'scripts'))) {
    copyDirFiltered(path.join(rootDir, 'scripts'), path.join(outputDir, 'scripts'), name =>
      name === 'prepare-vercel-deploy.js'
    );
  }

  writeDeployReadme();

  console.log('Carpeta deploy-vercel creada correctamente.');
  console.log(`Ruta: ${outputDir}`);
}

main();
