'use strict';
require('dotenv').config();
const cron = require('node-cron');
const SITE = process.env.SITE_URL || 'http://localhost:3000';
const HOOKS = (process.env.DISCORD_HOOKS || '').split(',').map(s => s.trim()).filter(Boolean);
const TG_GROUPS = (process.env.TG2_GROUPS || '').split(',').map(s => s.trim()).filter(Boolean);
const TG_TOKEN = process.env.TG2_TOKEN || '';
const ADMIN = process.env.TG_ADMIN || '';
const SKEY = process.env.ADMIN_KEY || '';

const log = (m) => console.log('[' + new Date().toISOString().slice(11, 19) + '] ' + m);

async function toAdmin(t) {
  if (!TG_TOKEN || !ADMIN) return;
  try {
    await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN, text: t, parse_mode: 'HTML' })
    });
  } catch (e) {}
}

const HEAD = [
  'GTA VI Access is Open',
  'GTA VI — 188.7 GB Full Package',
  'GTA VI Download Today',
  'GTA VI Access — 30 USDT',
  'GTA VI Beta Access'
];
const BODY = [
  'MetaMask only. 2 minutes. Instant download.',
  'BSC. 30 USDT. Direct link.',
  '188.7 GB. 30 USDT. Lifetime access.',
  'Connect Wallet → Pay → Download. That\'s it.',
  'Only 30 USDT. BNB gas 0.005.'
];

let h = 0;
const getPost = () => HEAD[h % HEAD.length] + '\n\n' + BODY[h++ % BODY.length] + '\n\n👉 ' + SITE;

/* Send to Discord every 1 minute */
cron.schedule('* * * * *', async () => {
  if (!HOOKS.length) return;
  const t = getPost();
  for (const u of HOOKS) {
    try {
      await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: t }) });
    } catch (e) { log('discord err: ' + e.message); }
  }
  log('Discord: Sent message to ' + HOOKS.length + ' servers');
});

/* Send to Telegram every 1 minute */
cron.schedule('* * * * *', async () => {
  if (!TG_GROUPS.length || !TG_TOKEN) return;
  const t = getPost();
  for (const g of TG_GROUPS) {
    try {
      await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: g, text: t, parse_mode: 'HTML' })
      });
    } catch (e) { log('tg err: ' + e.message); }
  }
  log('Telegram: Sent message to ' + TG_GROUPS.length + ' groups');
});

/* Daily report to admin at 9 AM */
cron.schedule('0 9 * * *', async () => {
  try {
    const r = await fetch('http://127.0.0.1:3000/stats?k=' + SKEY);
    const j = await r.json();
    await toAdmin('📊 <b>Daily Report</b>\n' +
      'Visits: ' + (j.count.visit || 0) + '\n' +
      'Connect: ' + (j.count.connect_start || 0) + '\n' +
      'Paid: ' + (j.count.pay_ok || 0) + '\n' +
      'Total Paid: ' + (j.paid || 0));
  } catch (e) {}
});

console.log('Agent is running. Sending 1 post per minute...');