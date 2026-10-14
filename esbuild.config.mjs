import { context, build } from 'esbuild';
const options = {
  entryPoints: ['src/main.ts'], bundle: true, external: ['obsidian', 'electron'],
  platform: 'node', format: 'cjs', target: 'es2022', outfile: 'main.js',
  banner: { js: '/* ZAgent — generated bundle. Source: src/ */' },
};
if (process.argv.includes('--watch')) {
  const ctx = await context({ ...options, sourcemap: 'inline' });
  await ctx.watch();
  console.log('Watching ZAgent source…');
} else {
  await build({ ...options, minify: true });
}
