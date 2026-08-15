const fs = require('fs');
const path = '\\\\wsl$\\Ubuntu\\home\\minda\\DoctorIA\\app\\.wasp\\out\\server\\bundle\\server.js';
const src = fs.readFileSync(path, 'utf8');
const names = src.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
const counts = {};
for (const n of names) {
  if (/Scrypt|Password|hash|verify/i.test(n) && counts[n] === undefined) counts[n] = true;
}
console.log('auth-related identifiers:');
console.log(Object.keys(counts).join('\n'));