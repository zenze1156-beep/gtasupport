'use strict';
require('dotenv').config();

// .env பைல்ல இருந்து படிக்கும்
const T = process.env.TG2_TOKEN; 
const A = process.env.TG_ADMIN;
const SITE = process.env.SITE_URL || 'http://localhost:3000';
const GROUPS = (process.env.TG2_GROUPS || '').split(',').map(s => s.trim()).filter(Boolean);

if (!T) {
  console.log('Error: TG2_TOKEN is missing in .env file');
  process.exit(1);
}

const API = 'https://api.telegram.org/bot' + T;

async function call(m, b) {
  try {
    const r = await fetch(API + '/' + m, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b)
    });
    return await r.json();
  } catch (e) { console.log(e.message); return {}; }
}

const POSTS = [
  '🎮 <b>GTA VI — Access is Open</b>\n\n30 USDT. BSC. Instant download.\n\n👉 ' + SITE,
  '🔥 <b>GTA VI Today</b>\n\n188.7 GB full package. Only 30 USDT.\n\n👉 ' + SITE,
  '⚡ GTA VI Access\n\nMetaMask only. 2 minutes. 30 USDT.\n\n👉 ' + SITE
];

let pi = 0;
async function broadcast() {
  const txt = POSTS[pi++ % POSTS.length];
  for (const g of GROUPS) {
    const r = await call('sendMessage', { chat_id: g, text: txt, parse_mode: 'HTML', disable_web_page_preview: false });
    if (!r.ok) console.log('Failed', g, r.description);
  }
}

let off = 0;
async function loop() {
  const j = await call('getUpdates?timeout=30&offset=' + off, undefined);
  for (const u of (j.result || [])) {
    off = u.update_id + 1;
    const m = u.message;
    if (!m || !m.text) continue;

    if (m.text === '/id') call('sendMessage', { chat_id: m.chat.id, text: 'id: <code>' + m.chat.id + '</code>', parse_mode: 'HTML' });

    // நீங்க (அட்மின்) /post அனுப்பினா உடனே மெசேஜ் போகும்
    if (m.text === '/post' && String(m.from.id) === A) broadcast();
  }
  setTimeout(loop, 1200);
}

console.log('group bot is running');
loop();