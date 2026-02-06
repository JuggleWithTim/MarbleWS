const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'node_modules', 'codemirror');
const targetDir = path.join(rootDir, 'client', 'vendor', 'codemirror');

const filesToCopy = [
  'lib/codemirror.js',
  'lib/codemirror.css',
  'theme/material-darker.css',
  'mode/javascript/javascript.js'
];

if (!fs.existsSync(sourceDir)) {
  console.error('CodeMirror dependency not found. Run npm install first.');
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

filesToCopy.forEach((relativePath) => {
  const src = path.join(sourceDir, relativePath);
  const dest = path.join(targetDir, path.basename(relativePath));
  fs.copyFileSync(src, dest);
});

console.log('Copied CodeMirror assets to client/vendor/codemirror');