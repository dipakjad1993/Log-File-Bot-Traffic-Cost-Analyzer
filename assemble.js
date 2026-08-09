const fs = require('fs');
const path = require('path');

// Read all parts
const beforeRenderers = fs.readFileSync(path.join(__dirname, 'js', 'part_before_renderers.js'), 'utf8');
const renderers = fs.readFileSync(path.join(__dirname, 'js', 'renderers_enhanced.js'), 'utf8');
const genSample = fs.readFileSync(path.join(__dirname, 'js', 'part_gensample.js'), 'utf8');
const about = fs.readFileSync(path.join(__dirname, 'js', 'part_about.js'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname, 'js', 'part_controller.js'), 'utf8');

// Assemble the complete file
const complete = beforeRenderers + '\n\n' + renderers + '\n\n' + genSample + '\n\n' + about + '\n\n' + controller;

// Write to analyzer.js
fs.writeFileSync(path.join(__dirname, 'js', 'analyzer.js'), complete, 'utf8');

console.log('Complete file assembled!');
console.log('Total size:', complete.length, 'bytes');
console.log('Lines:', complete.split('\n').length);
