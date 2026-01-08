const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path'); 
const fs = require('fs');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = '8459062919:AAGwNnWKi7wGP4p7neCxVZgBJiCj_mijmkg';
const bot = new Telegraf(BOT_TOKEN);

const logo = path.join(__dirname, 'gravio.jpg');

if (!fs.existsSync(logo)) {
    console.warn('⚠️  logo.png fayli topilmadi! images papkasida fayl borligiga ishonch hosil qiling.');
}

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
}); 

const db = admin.firestore();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        time: new Date(),
        bot: 'running'
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

bot.start(async (ctx) => {
    try {
        if (!fs.existsSync(logo)) {
            return ctx.reply(
                `Hello, ${ctx.from.first_name}. Welcome to Gravio!`,
                Markup.inlineKeyboard([
                    [Markup.button.webApp('Open 📍', 'https://graviotoken.netlify.app/')],
                    [Markup.button.url('Our channel 🧧', 'https://t.me/GravioToken')]
                ])
            );
        }

        await ctx.replyWithPhoto(
            { source: fs.readFileSync(logo) },
            {
                caption: `Hello, ${ctx.from.first_name}. Welcome to Gravio!`,
                ...Markup.inlineKeyboard([
                    [Markup.button.webApp('Open 📍', 'https://graviotoken.netlify.app/')],
                    [Markup.button.url('Our channel 🧧', 'https://t.me/GravioToken')]
                ])
            }
        );
    } catch (error) {
        console.error('Rasm yuborishda xato:', error);
        
        ctx.reply(
            `Hello, ${ctx.from.first_name}. Welcome to Gravio!\n\n` +
            Markup.inlineKeyboard([
                [Markup.button.webApp('Open 📍', 'https://graviotoken.netlify.app/')],
                [Markup.button.url('Our channel 🧧', 'https://t.me/GravioToken')]
            ])
        );
    }
});

bot.help((ctx) => {
    ctx.reply('Yordam uchun /start ni bosing');
});

app.post("/check-subscription", async (req, res) => {
  const { userId, channel, taskId, reward } = req.body;

  if (!userId || !channel || !taskId) {
    return res.status(400).json({ success: false, message: "Ma'lumotlar to'liq emas!" });
  }

  try {
    const member = await bot.telegram.getChatMember(channel, userId);
    const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);

    if (!isSubscribed) {
      return res.status(400).json({ success: false, message: "Siz kanalga a'zo emassiz!" });
    }

    const doneDoc = await db.collection("done")
      .where("by", "==", userId)
      .where("taskId", "==", taskId)
      .get();

    if (!doneDoc.empty) {
      return res.status(400).json({ success: false, message: "Bu vazifa uchun allaqachon mukofot olgansiz!" });
    }

    const userRef = db.collection("users").doc(String(userId));
    
    await db.runTransaction(async (t) => {
      t.set(userRef, { balance: admin.firestore.FieldValue.increment(reward) }, { merge: true });
      
      const newDoneRef = db.collection("done").doc();
      t.set(newDoneRef, {
        by: userId,
        taskId: taskId,
        channel: channel,
        completedAt: admin.firestore.Timestamp.now()
      });
    });

    return res.json({ 
      success: true, 
      message: `Tabriklaymiz! ${reward} ball qo'shildi.` 
    });

  } catch (err) {
    console.error("Xatolik:", err);
    return res.status(500).json({ success: false, message: "Serverda xatolik yuz berdi." });
  }
});

app.listen(PORT, () => {
    console.log(`🚀 Server ${PORT}-portda ishga tushdi`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    
    bot.launch()
        .then(() => {
            console.log('🤖 Bot muvaffaqiyatli ishga tushdi!');
            console.log(`📞 Botga shu link orqali kirishingiz mumkin:`);
            console.log(`👉 https://t.me/${bot.options.username}`);
        })
        .catch(err => {
            console.error('❌ Botni ishga tushirishda xatolik:', err.message);
            console.log('⚠️  Iltimos, BOT_TOKEN ni tekshiring');
        });
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));