'use strict';

const fs = require('fs');

const lines = fs.readFileSync(process.argv[2]).toString().split(/\n/g);

const header = lines.shift();
lines.sort();

fs.writeFileSync(process.argv[3], [ header ].concat(lines).join('\n'));
