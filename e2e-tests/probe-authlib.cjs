const src = require('fs').readFileSync('\\\\wsl$\\Ubuntu\\home\\minda\\DoctorIA\\app\\node_modules\\@wasp.sh\\lib-auth\\dist\\node.js', 'utf8');
const fns = src.match(/(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
console.log('function decls:', fns.join(' | '));
const exp = src.match(/export[^;]*/g) || [];
console.log('\nexports:');
console.log(exp.slice(0, 20).join('\n'));