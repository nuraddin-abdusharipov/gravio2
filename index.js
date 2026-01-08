const express = require("express");
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = "8459062919:AAGwNnWKi7wGP4p7neCxVZgBJiCj_mijmkg";
const bot = new Telegraf(BOT_TOKEN);

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

app.use(cors());
app.use(express.json());

const logo = path.join(__dirname, "gravio.jpg");
if (!fs.existsSync(logo)) console.warn("⚠️ gravio.jpg topilmadi!");

app.get("/", (req, res) => res.json({ status: "online", time: new Date() }));
app.get("/health", (req, res) =>
  res.json({ status: "healthy", uptime: process.uptime() })
);

bot.start(async (ctx) => {
  try {
    const fromId = ctx.from.id;

    const userRef = db.collection("users").doc(String(fromId));
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        balance: 0,
        createdAt: admin.firestore.Timestamp.now(),
      });
    }

    // Xush kelibsiz
    if (fs.existsSync(logo)) {
      await ctx.replyWithPhoto(
        { source: fs.readFileSync(logo) },
        {
          caption: `Hello, ${ctx.from.first_name}. Welcome to Gravio!`,
          ...Markup.inlineKeyboard([
            [Markup.button.webApp("Open 📍", "https://graviotoken.netlify.app/")],
            [Markup.button.url("Our channel 🧧", "https://t.me/GravioToken")],
          ]),
        }
      );
    } else {
      await ctx.reply(
        `Hello, ${ctx.from.first_name}. Welcome to Gravio!`,
        Markup.inlineKeyboard([
          [Markup.button.webApp("Open 📍", "https://graviotoken.netlify.app/")],
          [Markup.button.url("Our channel 🧧", "https://t.me/GravioToken")],
        ])
      );
    }
  } catch (err) {
    console.error(err);
  }
});

app.post("/check-subscription", async (req, res) => {
  const { userId, channel, taskId, reward } = req.body;

  if (!userId || !channel || !taskId) {
    return res.status(400).json({ success: false, message: "Missing parameters" });
  }

  try {
    const member = await bot.telegram.getChatMember(channel, userId);
    const isSubscribed = ["member", "administrator", "creator"].includes(member.status);

    if (!isSubscribed) {
      return res.status(400).json({ success: false, message: "You have not subscribed!" });
    }

    const doneSnap = await db
      .collection("done")
      .where("by", "==", userId)
      .where("taskId", "==", taskId)
      .get();

    if (!doneSnap.empty) {
      return res.status(400).json({ success: false, message: "Task already completed!" });
    }

    const userRef = db.collection("users").doc(String(userId));
    const doneRef = db.collection("done").doc();

    await db.runTransaction(async (t) => {
      t.set(userRef, { balance: admin.firestore.FieldValue.increment(reward) }, { merge: true });
      t.set(doneRef, {
        by: userId,
        taskId,
        channel,
        completedAt: admin.firestore.Timestamp.now(),
      });
    });

    return res.json({ success: true, message: `Success! ${reward} added.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  bot.launch().then(() => console.log("🤖 Bot started")).catch(console.error);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
