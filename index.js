const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

const TG_TOKEN = '8706773157:AAFxJbHZ15H0EMlhN6Ntq5MdOO2Hyp5UIzE';
const CHANNEL_ID = '-1001843491828';
const SUPABASE_URL = 'https://rxdfahqavtxakifnrycg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZGZhaHFhdnR4YWtpZm5yeWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDA2MDksImV4cCI6MjA5MjM3NjYwOX0.b8iL3LZ5gBieO82rlkrkv7cBiC8_TeDcu2LBcreuAXE';

// Stream vídeo desde Telegram
app.get('/stream/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getFile?file_id=${fileId}`);
    const data = await r.json();
    if (!data.ok) return res.status(404).send('Not found');
    
    const filePath = data.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${TG_TOKEN}/${filePath}`;
    
    const range = req.headers.range;
    if (!range) {
      const response = await fetch(fileUrl);
      res.setHeader('Content-Type', 'video/mp4');
      response.body.pipe(res);
      return;
    }

    const response = await fetch(fileUrl, { headers: { Range: range } });
    res.status(206);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Range', response.headers.get('content-range') || '');
    response.body.pipe(res);
  } catch (e) {
    res.status(500).send('Error');
  }
});

// Obtener file_id de los vídeos del canal y guardar en Supabase
app.get('/sync', async (req, res) => {
  try {
    let allVideos = [];
    let offset = 0;
    
    while (true) {
      const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${offset}&limit=100&allowed_updates=channel_post`);
      const data = await r.json();
      if (!data.result || data.result.length === 0) break;
      
      data.result.forEach(update => {
        const post = update.channel_post;
        if (post && post.video && String(post.chat.id) === CHANNEL_ID) {
          allVideos.push({
            file_id: post.video.file_id,
            title: post.caption || 'Sin título',
            duration: post.video.duration
          });
        }
        offset = update.update_id + 1;
      });
      
      if (data.result.length < 100) break;
    }

    res.json({ total: allVideos.length, videos: allVideos });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.send('GarlyCorp Proxy OK'));
app.listen(process.env.PORT || 3000, () => console.log('Proxy running'));
