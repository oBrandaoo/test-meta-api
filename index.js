require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const mysql = require("mysql2/promise");
const { transcreverAudio } = require("./whisper");
const port =3000

const app = express();
app.use(bodyParser.json());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK_VERIFIED");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const webhookData = req.body;

    const messageObj = webhookData?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const phone_number = messageObj?.from;
    const message_type = messageObj?.type;

    if (!phone_number) {
      return res.sendStatus(200);
    }

    if (message_type === "text") {
      const message_text = messageObj.text.body;

      await db.query(
        "INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)",
        [phone_number, message_text, "text"]
      );

      console.log("Texto salvo no banco:", message_text);
    }

    if (message_type === "audio") {
      const media_id = messageObj.audio.id;

      const response = await axios({
        method: "GET",
        url: `https://graph.facebook.com/v18.0/${media_id}`,
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
      });

      const audioUrl = response.data.url;

      const audioData = await axios({
        method: "GET",
        url: audioUrl,
        responseType: "arraybuffer",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
      });

      const transcription = await transcreverAudio(audioData.data);

      await db.query(
        "INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)",
        [phone_number, transcription, "audio"]
      );

      console.log("Áudio transcrito e salvo no banco:", transcription);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Erro ao processar webhook:", error);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
