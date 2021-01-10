const fs = require('fs');
const os = require('os');
const path = require('path');
const configFile = path.resolve(__dirname, 'config.'+os.hostname()+'.json');
console.log('Loading ' + configFile)
var content = JSON.parse(fs.readFileSync(configFile,'utf-8'));
console.log(JSON.stringify(content,null,'  '));

