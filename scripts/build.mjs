import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await cp('public', 'dist', { recursive: true, force: true }).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});

const result = await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: 'esm',
  splitting: false,
  outdir: 'dist/assets',
  entryNames: 'main-[hash]',
  assetNames: '[name]-[hash]',
  loader: {
    '.js': 'jsx',
    '.jsx': 'jsx',
    '.css': 'css',
  },
  metafile: true,
});

const outputs = Object.keys(result.metafile.outputs);
const script = outputs.find((file) => file.endsWith('.js'));
const style = outputs.find((file) => file.endsWith('.css'));
const publicPath = (file) => file.replace(/^dist[\\/]/, '').replace(/\\/g, '/');

await writeFile(
  'dist/index.html',
  `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>skinbeauty</title>
    ${style ? `<link rel="stylesheet" href="/${publicPath(style)}" />` : ''}
    <script>
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
          .then((registrations) => registrations.forEach((registration) => registration.unregister()))
          .catch(() => {});
      }
      if ('caches' in window) {
        caches.keys()
          .then((keys) => keys.forEach((key) => caches.delete(key)))
          .catch(() => {});
      }
    </script>
    <script type="module" src="/${publicPath(script)}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`,
);
