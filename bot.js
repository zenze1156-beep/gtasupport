'use strict';

require('dotenv').config();
const TOKEN = process.env.TG_TOKEN; // .env-ல இருந்து படிக்கும்
const API = 'https://api.telegram.org/bot' + TOKEN;

async function send(chat, text) {
  try {
    await fetch(API + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: text, parse_mode: 'HTML' })
    });
  } catch (e) { console.log(e.message); }
}

const R = [
  { k: ['hi','hello','vanakkam','start'], t: 'Hello! Welcome to GTA VI Support. Type /help to see commands.' },
  { k: ['price','vilai','evlo','how much','cost'], t: 'Price is <b>30 USDT</b> (BSC). You also need 0.005 BNB for gas.' },
  { k: ['gas','bnb','fee'], t: 'Gas is paid in BNB. Keep at least 0.005 BNB in your wallet.' },
  { k: ['pay','epdi pay','how to pay'], t: '1) Click Connect Wallet\n2) Ensure you have 30 USDT + 0.005 BNB\n3) Click Pay & Download\n4) Confirm in MetaMask' },
  { k: ['download','link'], t: 'Download will start automatically after payment is confirmed.' },
  { k: ['problem','error','fail','varala','pannala'], t: 'Troubleshooting:\n• Is BNB less than 0.005? Add more.\n• Is Network set to BSC?\n• Wait 2 minutes and click Pay again.' },
  { k: ['help','enna','epdi'], t: '/price - Price\n/gas - Gas fee\n/pay - How to pay\n/problem - Issues' }
];

function ans(s) {
  s = s.toLowerCase();
  for (const r of R) if (r.k.some(k => s.includes(k))) return r.t;
  return 'I didn\'t understand. Type /help or describe your issue.';
}

let off = 0;
async function loop() {
  try {
    const r = await fetch(API + '/getUpdates?timeout=30&offset=' + off);
    const j = await r.json();
    
    if (!j.ok) console.log("Telegram Error:", j.description);

    for (const u of (j.result || [])) {
      off = u.update_id + 1;
      const m = u.message;
      if (!m || !m.text) continue;
      
      console.log("New message:", m.text);
      // இங்கே தான் நாம் ஆங்கிலத்தில் பதில் அனுப்புகிறோம்
      await send(m.chat.id, ans(m.text));
    }
  } catch (e) { console.log(e.message); }
  setTimeout(loop, 1500);
}

console.log('bot is running in English...');
loop();