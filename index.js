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
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const msg = value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const type = msg.type;
    let content = "";
    let transcricao = null;

    if (type === "text") {
      content = msg.text.body;
    } else if (type === "audio") {
      const mediaId = msg.audio.id;
      const token = process.env.WHATSAPP_TOKEN;

      const { data: mediaInfo } = await axios.get(
        `https://graph.facebook.com/v19.0/${mediaId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { data: media } = await axios.get(mediaInfo.url, {
        responseType: "arraybuffer",
        headers: { Authorization: `Bearer ${token}` },
      });

      const buffer = Buffer.from(media);
      transcricao = await transcreverAudio(buffer);
      content = "[Áudio recebido]";
    }

    await db.query(
      "INSERT INTO mensagens (remetente, tipo, conteudo, transcricao) VALUES (?, ?, ?, ?)",
      [from, type, content, transcricao]
    );

    console.log("Mensagem salva:", { from, type, content, transcricao });
    res.sendStatus(200);
  } catch (err) {
    console.error("Erro ao processar webhook:", err);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
