import { minify } from 'terser';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const srcDir = 'src';
const distDir = 'dist';

// Ensure dist directory exists
try {
  await mkdir(distDir, { recursive: true });
} catch (err) {
  // Directory already exists or other error, continue
}

const files = (await readdir(srcDir)).filter(f => f.endsWith('.js') && !f.endsWith('.min.js'));

for (const file of files) {
  const srcPath = join(srcDir, file);
  const code = await readFile(srcPath, 'utf8');
  const output = await minify(code, {
    format: { comments: false },
    compress: { drop_console: true, dead_code: true }
  });
  const outName = file.replace(/\.js$/, '.min.js');
  const distPath = join(distDir, outName);
  await writeFile(distPath, output.code, 'utf8');
  console.log(`✔  ${srcPath} → ${distPath}`);
} 