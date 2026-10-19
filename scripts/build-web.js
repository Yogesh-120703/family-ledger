// Copies the web app files into www/ for the Android build. The web app itself is unchanged.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
const files = ['index.html', 'styles.css', 'core.js', 'app.js', 'manifest.webmanifest', 'sw.js'];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
files.forEach(f => fs.copyFileSync(path.join(root, f), path.join(out, f)));
fs.readdirSync(path.join(root, 'icons')).forEach(f => fs.copyFileSync(path.join(root, 'icons', f), path.join(out, 'icons', f)));
console.log('Web files copied to www/');
