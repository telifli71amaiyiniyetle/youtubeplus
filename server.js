const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = 3000;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const TRANSCODED_DIR = path.join(__dirname, 'transcoded');
const DB_FILE = path.join(__dirname, 'db.json');

[UPLOADS_DIR, TRANSCODED_DIR].forEach(d => !fs.existsSync(d) && fs.mkdirSync(d, { recursive: true }));

function readDB() {
  if (!fs.existsSync(DB_FILE)) return { users: {}, videos: [] };
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch(e) { return { users: {}, videos: [] }; }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/transcoded', express.static(TRANSCODED_DIR));
app.use(session({
  secret: 'youtubeplus-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const id = 'vid_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const ext = path.extname(file.originalname);
    cb(null, id + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.ts', '.m2ts'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Giriş gerekli' });
  next();
}

// ─── TRANSCODE ─────────────────────────────────────
// Dual audio track:
// Track 0 → AAC 5.1  (Chrome, Firefox, hepsi çalar)
// Track 1 → EAC-3 7.1 Atmos  (Edge, Safari - gerçek Atmos)
function startTranscode(inputPath, outFile, id, originalFile) {
  console.log(`\n🔄 Transcode başlıyor: ${path.basename(inputPath)}`);
  console.log(`   Strateji: AAC 5.1 + DD+ Atmos 7.1 dual track`);

  ffmpeg(inputPath)
    .outputOptions([
      '-map 0:v:0',
      '-map 0:a:0',
      '-map 0:a:0',
      '-c:v copy',
      '-c:a:0 aac',
      '-b:a:0 640k',
      '-ac:a:0 6',
      '-c:a:1 eac3',
      '-b:a:1 1536k',
      '-ac:a:1 8',
      '-ar 48000',
      '-movflags +faststart',
      '-metadata:s:a:0 title=AAC 5.1',
      '-metadata:s:a:1 title=Dolby Atmos 7.1',
    ])
    .output(outFile)
    .on('start', () => console.log(`🛠  ffmpeg çalışıyor...`))
    .on('progress', (p) => {
      if (p.percent) process.stdout.write(`\r⏳ İşleniyor: %${Math.floor(p.percent)} — ${p.timemark || ''}`);
    })
    .on('end', () => {
      process.stdout.write('\n');
      console.log(`✅ Transcode tamamlandı: ${id}`);
      const db2 = readDB();
      const vid = db2.videos.find(v => v.id === id);
      if (vid) { vid.transcodeStatus = 'done'; vid.streamPath = `/transcoded/${id}.mp4`; writeDB(db2); }
    })
    .on('error', (err) => {
      process.stdout.write('\n');
      console.error(`❌ Dual track başarısız: ${err.message}`);
      console.log('🔁 Fallback: sadece AAC...');
      // Fallback: sadece AAC
      ffmpeg(inputPath)
        .outputOptions(['-c:v copy', '-c:a aac', '-b:a 640k', '-ac 6', '-ar 48000', '-movflags +faststart'])
        .output(outFile)
        .on('end', () => {
          console.log(`✅ Fallback tamamlandı: ${id}`);
          const db2 = readDB();
          const vid = db2.videos.find(v => v.id === id);
          if (vid) { vid.transcodeStatus = 'done'; vid.streamPath = `/transcoded/${id}.mp4`; writeDB(db2); }
        })
        .on('error', (err2) => {
          console.error(`❌ Fallback da başarısız: ${err2.message}`);
          const db2 = readDB();
          const vid = db2.videos.find(v => v.id === id);
          if (vid) { vid.transcodeStatus = 'failed'; vid.streamPath = `/uploads/${originalFile}`; writeDB(db2); }
        })
        .run();
    })
    .run();
}

// ─── AUTH ──────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Tüm alanlar zorunlu' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter' });
  const db = readDB();
  if (db.users[email]) return res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  db.users[email] = { name, email, password: hash, joined: new Date().toLocaleDateString('tr'), likes: {}, cmts: {} };
  writeDB(db);
  req.session.user = { email, name };
  res.json({ success: true, user: { name, email } });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users[email];
  if (!user) return res.status(400).json({ error: 'Bu e-posta kayıtlı değil' });
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (user.password !== hash) return res.status(400).json({ error: 'Şifre yanlış' });
  req.session.user = { email, name: user.name };
  res.json({ success: true, user: { name: user.name, email } });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  const db = readDB();
  const u = db.users[req.session.user.email];
  if (!u) return res.json({ user: null });
  res.json({ user: { name: u.name, email: u.email, joined: u.joined } });
});

// ─── VIDEO ─────────────────────────────────────────
app.post('/api/upload', requireAuth, upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Video dosyası gerekli' });

  const { title, description, category, formats, quality, isAtmos } = req.body;
  const id = path.basename(req.file.filename, path.extname(req.file.filename));
  const ext = path.extname(req.file.filename).toLowerCase();
  const inputPath = req.file.path;

  console.log(`\n📁 Yeni yükleme: ${req.file.originalname} (${(req.file.size/1024/1024).toFixed(1)} MB)`);

  let duration = '?', audioInfo = '';
  try {
    const meta = await new Promise((resolve, reject) => ffmpeg.ffprobe(inputPath, (err, m) => err ? reject(err) : resolve(m)));
    const d = meta.format.duration;
    duration = Math.floor(d/60) + ':' + String(Math.floor(d%60)).padStart(2,'0');
    const audio = (meta.streams||[]).find(s => s.codec_type === 'audio');
    if (audio) {
      audioInfo = `${audio.codec_name} ${audio.channel_layout||''} (${audio.channels}ch)`;
      console.log(`   Ses: ${audioInfo}`);
    }
  } catch(e) { console.error('ffprobe hatası:', e.message); }

  const needsTranscode = ['.mkv','.ts','.m2ts'].includes(ext) ||
    audioInfo.toLowerCase().includes('truehd') ||
    audioInfo.toLowerCase().includes('dts') ||
    audioInfo.toLowerCase().includes('pcm');

  let streamPath = `/uploads/${req.file.filename}`;
  let transcodeStatus = 'none';

  if (needsTranscode) {
    transcodeStatus = 'processing';
    const outFile = path.join(TRANSCODED_DIR, id + '.mp4');
    streamPath = `/transcoded/${id}.mp4`;
    console.log(`   → Transcode kuyruğa alındı`);
    setImmediate(() => startTranscode(inputPath, outFile, id, req.file.filename));
  } else {
    console.log(`   → Direkt yayın`);
  }

  const fmts = formats ? JSON.parse(formats) : ['pcm'];
  const video = {
    id, title: title || 'İsimsiz Video', description: description || '',
    category: category || 'sinema', formats: fmts, quality: quality || '1080p',
    isAtmos: isAtmos === 'true', audioInfo, duration, views: 0, likes: 0,
    uploadedBy: req.session.user.email, uploaderName: req.session.user.name,
    uploadedAt: new Date().toISOString(), originalFile: req.file.filename,
    streamPath, transcodeStatus, cmts: []
  };

  const db = readDB();
  db.videos.unshift(video);
  writeDB(db);
  res.json({ success: true, video });
});

app.get('/api/videos', (req, res) => {
  const db = readDB();
  const { category, search } = req.query;
  let vids = db.videos;
  if (category) vids = vids.filter(v => (v.formats||[]).includes(category) || v.category === category);
  if (search) vids = vids.filter(v => v.title.toLowerCase().includes(search.toLowerCase()));
  res.json(vids.map(v => ({ ...v, uploadedBy: undefined })));
});

app.get('/api/videos/:id', (req, res) => {
  const db = readDB();
  const v = db.videos.find(v => v.id === req.params.id);
  if (!v) return res.status(404).json({ error: 'Video bulunamadı' });
  v.views = (v.views||0) + 1;
  writeDB(db);
  res.json(v);
});

// ─── SİL ───────────────────────────────────────────
app.delete('/api/videos/:id', requireAuth, (req, res) => {
  const db = readDB();
  const idx = db.videos.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Bulunamadı' });
  const vid = db.videos[idx];
  if (vid.uploadedBy !== req.session.user.email) return res.status(403).json({ error: 'Yetkisiz' });
  try { fs.unlinkSync(path.join(UPLOADS_DIR, vid.originalFile)); } catch(e) {}
  try { fs.unlinkSync(path.join(TRANSCODED_DIR, vid.id + '.mp4')); } catch(e) {}
  db.videos.splice(idx, 1);
  writeDB(db);
  console.log(`🗑  Silindi: ${vid.title}`);
  res.json({ success: true });
});

app.post('/api/videos/:id/like', requireAuth, (req, res) => {
  const db = readDB();
  const vid = db.videos.find(v => v.id === req.params.id);
  if (!vid) return res.status(404).json({ error: 'Bulunamadı' });
  const u = db.users[req.session.user.email];
  if (!u.likes) u.likes = {};
  const was = u.likes[req.params.id];
  u.likes[req.params.id] = !was;
  vid.likes = Math.max(0, (vid.likes||0) + (!was ? 1 : -1));
  writeDB(db);
  res.json({ liked: !was, likes: vid.likes });
});

app.get('/api/videos/:id/liked', requireAuth, (req, res) => {
  const db = readDB();
  const u = db.users[req.session.user.email];
  res.json({ liked: !!(u.likes && u.likes[req.params.id]) });
});

app.post('/api/videos/:id/comment', requireAuth, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Yorum boş olamaz' });
  const db = readDB();
  const vid = db.videos.find(v => v.id === req.params.id);
  if (!vid) return res.status(404).json({ error: 'Bulunamadı' });
  const cmt = { id: 'c_'+Date.now(), user: req.session.user.name, text, date: new Date().toLocaleString('tr') };
  if (!vid.cmts) vid.cmts = [];
  vid.cmts.unshift(cmt);
  writeDB(db);
  res.json(cmt);
});

app.get('/api/videos/:id/status', (req, res) => {
  const db = readDB();
  const v = db.videos.find(v => v.id === req.params.id);
  if (!v) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ transcodeStatus: v.transcodeStatus, streamPath: v.streamPath });
});

app.get('/api/profile', requireAuth, (req, res) => {
  const db = readDB();
  const u = db.users[req.session.user.email];
  const myVids = db.videos.filter(v => v.uploadedBy === req.session.user.email);
  res.json({
    name: u.name, email: u.email, joined: u.joined,
    videoCount: myVids.length,
    likeCount: Object.values(u.likes||{}).filter(Boolean).length,
    cmtCount: Object.values(u.cmts||{}).reduce((a,c) => a+(c.length||0), 0)
  });
});

app.listen(PORT, () => {
  console.log(`\n🎬 Youtube Plus çalışıyor!`);
  console.log(`📡 Yerel: http://localhost:${PORT}`);
  console.log(`🔊 Ses dönüşümü:`);
  console.log(`   Chrome/Firefox → AAC 5.1 (ses çıkar)`);
  console.log(`   Edge/Safari    → DD+ Atmos 7.1 (gerçek Atmos)`);
  console.log(`\nCloudflare: cloudflared tunnel --url http://localhost:${PORT}\n`);
});
