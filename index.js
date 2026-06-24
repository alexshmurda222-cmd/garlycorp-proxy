const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

const TG_TOKEN = '8706773157:AAFxJbHZ15H0EMlhN6Ntq5MdOO2Hyp5UIzE';
const ADMIN_CHAT = '5335941213';
const SUPABASE_URL = 'https://rxdfahqavtxakifnrycg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZGZhaHFhdnR4YWtpZm5yeWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDA2MDksImV4cCI6MjA5MjM3NjYwOX0.b8iL3LZ5gBieO82rlkrkv7cBiC8_TeDcu2LBcreuAXE';

async function sendTelegram(chatId, msg) {
  if (!chatId) return;
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' })
  });
}

// Webhook Telegram - notificaciones + guardar file_id de vídeos
app.post('/tg-webhook', async (req, res) => {
  const msg = req.body.message;
  const channelPost = req.body.channel_post;

  // Guardar file_id cuando llega un vídeo del canal
  if (channelPost && channelPost.video) {
    const fileId = channelPost.video.file_id;
    const caption = channelPost.caption || 'Sin título';
    console.log('Vídeo recibido:', caption, fileId);
    // Guardar en Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/telegram_videos`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ file_id: fileId, title: caption })
    });
    return res.sendStatus(200);
  }

  if (!msg || !msg.text) return res.sendStatus(200);
  if (!msg.text.startsWith('/start')) return res.sendStatus(200);

  const chatId = String(msg.chat.id);
  const payload = msg.text.replace('/start', '').trim();

  // Mensaje de bienvenida
  await sendTelegram(chatId,
    `🎬 *GarlyCorp Cinema — Notificaciones Oficiales*\n\nBienvenido a nuestro canal de atención al cliente.\n\nDesde aquí recibirás:\n• Actualizaciones sobre el estado de tu cuenta\n• Novedades exclusivas del catálogo\n• Comunicaciones oficiales de GarlyCorp\n\n_Este es un canal oficial. No respondas a este mensaje._`
  );

  if (payload) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${payload}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ telegram_chat_id: chatId })
    });

    await sendTelegram(chatId,
      `📋 *GarlyCorp Cinema — Estado de Solicitud*\n\nHemos recibido tu solicitud de acceso correctamente.\n\nNuestro equipo está revisando tu cuenta. Te notificaremos en cuanto tu acceso esté listo.\n\n_Gracias por tu paciencia._`
    );
  }

  res.sendStatus(200);
});

// Webhook Supabase - usuario aprobado
app.post('/webhook', async (req, res) => {
  const record = req.body.record;
  if (!record) return res.sendStatus(200);

  if (record.status === 'pending') {
    await sendTelegram(ADMIN_CHAT,
      `🎬 *GarlyCorp Cinema*\n\nNuevo suscriptor registrado\n\n👤 *Nombre:* ${record.name}\n📧 *Correo:* ${record.email}\n\n⏳ Pendiente de verificación`
    );
  }

  if (record.status === 'approved' && record.telegram_chat_id) {
    await sendTelegram(record.telegram_chat_id,
      `🎬 *GarlyCorp Cinema*\n\n¡Enhorabuena ${record.name || ''}!\n\nTu solicitud ha sido *aprobada*. Ya formas parte de nuestra comunidad premium.\n\nInicia sesión y disfruta del catálogo exclusivo. 🍿\n\n_Bienvenido/a a la experiencia GarlyCorp._`
    );
  }

  res.sendStatus(200);
});

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
    const response = await fetch(fileUrl, range ? { headers: { Range: range } } : {});
    
    res.status(range ? 206 : 200);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    if (range) res.setHeader('Content-Range', response.headers.get('content-range') || '');
    response.body.pipe(res);
  } catch (e) {
    res.status(500).send('Error');
  }
});

// Ver vídeos guardados
app.get('/videos', async (req, res) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/telegram_videos?select=*`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const data = await r.json();
  res.json(data);
});

app.get('/', (req, res) => res.send('GarlyCorp Proxy OK'));
app.listen(process.env.PORT || 3000, () => console.log('Proxy running'));
