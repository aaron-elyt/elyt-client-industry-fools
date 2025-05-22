import { minify } from 'terser';
import { readdir, readFile, writeFile } from 'fs/promises';

const files = (await readdir('.')).filter(f => f.endsWith('.js') && !f.endsWith('.min.js') && f !== 'build.js');

for (const file of files) {
  const code = await readFile(file, 'utf8');
  const output = await minify(code, {
    format: { comments: false },
    compress: { drop_console: true, dead_code: true }
  });
  const outName = file.replace(/\.js$/, '.min.js');
  await writeFile(outName, output.code, 'utf8');
  console.log(`✔  ${outName}`);
} 