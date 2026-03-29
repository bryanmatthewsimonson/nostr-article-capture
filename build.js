const esbuild = require('esbuild');
const fs = require('fs');

// Read the Tampermonkey header from a separate file
const header = fs.readFileSync('src/header.js', 'utf-8');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/index.js'],
  bundle: true,
  outfile: 'dist/nostr-article-capture.user.js',
  format: 'iife',
  target: ['es2020'],
  minify: false,  // Keep readable for debugging
  banner: { js: header },
  // Don't bundle @require'd libraries (Readability, Turndown)
  external: [],
};

if (isWatch) {
  esbuild.context(buildOptions).then(ctx => {
    ctx.watch();
    console.log('Watching for changes...');
  });
} else {
  esbuild.build(buildOptions).then(() => {
    console.log('Build complete: dist/nostr-article-capture.user.js');
  }).catch(() => process.exit(1));
}
