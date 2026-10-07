const fs = require('node:fs');
const path = require('node:path');
function sources(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? sources(file) : entry.name.endsWith('.js') ? [file] : [];
  });
}
fs.writeFileSync(path.join(__dirname, 'fsm.js'), sources(path.join(__dirname, 'src')).map(file => fs.readFileSync(file, 'utf8')).join('\n'));
