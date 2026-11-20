import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const htmlPath = 'dist/index.html';
const html = readFileSync(htmlPath, 'utf8');
const assetNames = readdirSync('dist/assets');
const css = assetNames
  .filter((name) => name.endsWith('.css'))
  .map((name) => readFileSync(`dist/assets/${name}`, 'utf8'))
  .join('\n');
const js = assetNames
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(`dist/assets/${name}`, 'utf8'))
  .join('\n');

if (!css || !js) {
  throw new Error('dist/assets 里没有找到 css 或 js');
}

const favicon = readFileSync('public/favicon.svg', 'utf8').replaceAll('#', '%23');
const faviconHref = `data:image/svg+xml,${favicon}`;

let page = html
  .replace(/<link rel="stylesheet"[^>]*>/g, '')
  .replace(/<link rel="modulepreload"[^>]*>/g, '')
  .replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/g, '')
  .replace(/href="(?:\.\/|\/engguoqu\/)?favicon\.svg"/g, `href="${faviconHref}"`);

if (page.includes('src="') && page.includes('.js')) {
  throw new Error('仍有外部脚本，单文件没有收干净');
}

page = page.replace('</head>', `<style>\n${css.replaceAll('</style', '<\\/style')}\n</style>\n</head>`);
page = page.replace(
  '</body>',
  `<script type="module">\n${js.replaceAll('</script', '<\\/script')}\n</script>\n</body>`,
);

writeFileSync('engguoqu.html', page);
console.log(`engguoqu.html ${(page.length / 1024).toFixed(1)} KB`);
