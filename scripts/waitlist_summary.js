const fs = require('fs');
const csv = fs.readFileSync('./sendflow-waitlist.csv', 'utf8');
const lines = csv.split('\n').filter(Boolean);
const rows = lines.slice(1).map(l => {
  const m = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || [];
  return m.slice(0, -1).map(c => c.replace(/,$/,'').replace(/^"|"$/g,'').replace(/""/g,'"'));
});
const headers = lines[0].split(',');
const total = rows.length;
const subs = rows.filter(r => r[7] === 'subscribed').length;
const withPhone = rows.filter(r => r[4]).length;
const withName = rows.filter(r => r[1]).length;
const withBiz = rows.filter(r => r[5]).length;
const wantsCall = rows.filter(r => r[6] === 'YES').length;
const byMonth = {};
rows.forEach(r => {
  const d = r[9].slice(0,7);
  byMonth[d] = (byMonth[d]||0)+1;
});
console.log('=== SendFlow Waitlist Summary ===');
console.log('Total rows:', total);
console.log('Subscribed:', subs);
console.log('Have name:', withName);
console.log('Have phone:', withPhone);
console.log('Have business type:', withBiz);
console.log('Wants call:', wantsCall);
console.log('By signup month:', byMonth);
console.log('---Domain breakdown---');
const domains = {};
rows.forEach(r => {
  const d = r[0].split('@')[1]||'?';
  domains[d] = (domains[d]||0)+1;
});
Object.entries(domains).sort((a,b)=>b[1]-a[1]).slice(0,15).forEach(([d,n])=>console.log(`  ${d}: ${n}`));
