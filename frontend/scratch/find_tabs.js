import { readFileSync } from 'fs';

const content = readFileSync('e:/projects/Earn Fest/frontend/src/pages/AdminPanel.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('admin-tab') || line.includes('activeTab') || line.includes('render') || line.includes('return (')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
