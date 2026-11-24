'use strict';
require('dotenv').config();
const express = require('express');
const { JsonRpcProvider, formatUnits } = require('ethers');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const C = {
  PORT: Number(process.env.PORT || 3000),
  RPC: process.env.RPC || 'https://bsc-dataseed.binance.org',
  COLLECTOR: (process.env.COLLECTOR || '').toLowerCase(),
  PAY_TOKEN: (process.env.PAY_TOKEN || '').toLowerCase(),
  MIN: BigInt(process.env.MIN_AMOUNT_WEI || '30000000000000000000'),
  WIN: Number(process.env.BLOCK_WINDOW || 1800),
  FILE: path.resolve(process.env.FILE || './secret/GTA-VI.zip'),
  PUB: path.resolve('./public'),
  DB: path.resolve('./data/db.json'),
  TGT: process.env.TG_TOKEN || '',
  TGA: process.env.TG_ADMIN || '',
  KEY: process.env.ADMIN_KEY || ''
};

if (!/^0x[0-9a-f]{40}$/.test(C.COLLECTOR)) { console.log('Invalid COLLECTOR'); process.exit(1); }
if (!/^0x[0-9a-f]{40}$/.test(C.PAY_TOKEN)) { console.log('Invalid PAY_TOKEN'); process.exit(1); }

const prov = new JsonRpcProvider(C.RPC, 56, { staticNetwork: true });

fs.mkdirSync(path.dirname(C.DB), { recursive: true });
let db = { paid: {}, links: {}, ev: [] };
if (fs.existsSync(C.DB)) { try { db = { ...db, ...JSON.parse(fs.readFileSync(C.DB, 'utf8')) }; } catch (e) {} }
let tm = null;
const save = () => {
  clearTimeout(tm);
  tm = setTimeout(() => {
    try { fs.writeFileSync(C.DB + '.tmp', JSON.stringify(db)); fs.renameSync(C.DB + '.tmp', C.DB); } catch (e) {}
  }, 400);
};

const hits = new Map();
const rl = (ip, max) => {
  const n = Date.now();
  const a = (hits.get(ip) || []).filter(x => n - x < 60000);
  a.push(n); hits.set(ip, a);
  return a.length <= max;
};

const tg = async (t) => {
  if (!C.TGT || !C.TGA) return;
  try {
    await fetch(`https://api.telegram.org/bot${C.TGT}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: C.TGA, text: t, parse_mode: 'HTML' })
    });
  } catch (e) {}
};

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '8kb' }));

/* Pick one of three variants and remember it */
app.use((req, res, next) => {
  const m = (req.headers.cookie || '').match(/v=([abc])/);
  let v = m ? m[1] : (req.query.v && 'abc'.includes(req.query.v) ? req.query.v : 'abc'[Math.floor(Math.random() * 3)]);
  req.v = v;
  if (!m) res.setHeader('Set-Cookie', `v=${v}; Path=/; Max-Age=2592000; SameSite=Lax`);
  next();
});

app.get('/', (req, res) => res.sendFile(path.join(C.PUB, 'index.html')));
app.use(express.static(C.PUB));

app.post('/api/track', (req, res) => {
  if (!rl(req.ip, 120)) return res.json({ ok: 1 });
  const e = String(req.body.ev || '').slice(0, 20);
  if (e) { db.ev.push({ e, v: req.v, t: Date.now() }); if (db.ev.length > 6000) db.ev.splice(0, 2000); save(); }
  res.json({ ok: 1 });
});

app.get('/api/health', (_, res) => res.json({ ok: 1 }));

app.post('/api/verify', async (req, res) => {
  if (!rl(req.ip, 12)) return res.status(429).json({ ok: 0, error: 'Too many attempts. Please wait 1 minute.' });
  const a = String(req.body.address || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(a)) return res.json({ ok: 0, error: 'Invalid address' });

  try {
    if (!db.paid[a]) {
      const latest = await prov.getBlockNumber();
      const logs = await prov.getLogs({
        address: C.PAY_TOKEN,
        fromBlock: Math.max(0, latest - C.WIN),
        toBlock: latest,
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          '0x' + a.slice(2).padStart(64, '0'),
          '0x' + C.COLLECTOR.slice(2).padStart(64, '0')
        ]
      });
      let tot = 0n;
      for (const l of logs) tot += BigInt(l.data);
      if (tot < C.MIN) return res.json({ ok: 0, error: 'Payment not received yet. Please try again in 10 seconds.' });
      db.paid[a] = Date.now();
      save();
      tg('💰 Payment received\n' + a + '\n' + formatUnits(tot, 18) + ' USDT');
    }
    const t = crypto.randomBytes(18).toString('hex');
    db.links[t] = { exp: Date.now() + 20 * 60000, ip: req.ip, n: 0 };
    save();
    res.json({ ok: 1, token: t });
  } catch (e) {
    console.log('verify', e.message);
    res.json({ ok: 0, error: 'RPC unavailable. Please try again.' });
  }
});

app.get('/download/:t', (req, res) => {
  const r = db.links[req.params.t];
  if (!r) return res.status(403).send('Invalid link');
  if (r.exp < Date.now()) return res.status(410).send('Expired');
  if (!fs.existsSync(C.FILE)) return res.status(404).send('File not found');
  r.n++;
  if (r.n >= 3) delete db.links[req.params.t];
  db.ev.push({ e: 'download', v: req.v, t: Date.now() });
  save();
  res.download(C.FILE, 'GTA-VI.zip');
});

app.get('/stats', (req, res) => {
  if (!C.KEY || req.query.k !== C.KEY) return res.status(401).send('Forbidden');
  const c = {}; for (const x of db.ev) c[x.e] = (c[x.e] || 0) + 1;
  const v = {}; for (const x of db.ev) { v[x.v] = v[x.v] || {}; v[x.v][x.e] = (v[x.v][x.e] || 0) + 1; }
  res.json({ count: c, variant: v, paid: Object.keys(db.paid).length });
});

setInterval(() => { const n = Date.now(); for (const k in db.links) if (db.links[k].exp < n) delete db.links[k]; save(); }, 60000);

app.listen(C.PORT, () => console.log('OK http://localhost:' + C.PORT));