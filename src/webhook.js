const axios = require("axios");
const express = require("express");
const router = express.Router();

const { transcreverAudio } = require("./whisper");
const { enviarMensagemTexto } = require("./service");
const { dispatchText} = require("./dispatcher")

function createWebhookRouter(db) {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  // ===== GET /webhook =====
  router.get("/", (req, res) => {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ WEBHOOK_VERIFIED");
      return res.status(200).send(challenge);
    }
    console.log("❌ Falha na verificação do webhook");
    return res.sendStatus(403);
  });

  // ===== Funções auxiliares =====
  async function getUserId(phone_number) {
    const [existingUser] = await db.query("SELECT id FROM users WHERE phone_number = ?", [phone_number]);
    if (existingUser.length === 0) {
      const result = await db.query("INSERT INTO users (phone_number) VALUES (?)", [phone_number]);
      return result[0].insertId;
    }
    return existingUser[0].id;
  }

    router.post("/", async (req, res) => {
    try {
      const messageObj = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const phone_number = messageObj?.from;

      if (!phone_number) return res.sendStatus(200);

      const userId = await getUserId(phone_number);
      const reply = (text) => enviarMensagemTexto(phone_number, text);

      if (messageObj.type === "text") {
        const text = messageObj.text?.body || "";
        try {
          await dispatchText(db, { text, userId, reply });
        } catch (error) {
          console.error("Erro ao processar mensagem de texto:", error);
          reply("❌ Ocorreu um erro ao processar sua mensagem. Tente novamente.");
        }
      }

      if (messageObj.type === "audio") {
        try {
          const media_id = messageObj.audio.id;
          const resp = await axios.get(`https://graph.facebook.com/v18.0/${media_id}`, {
            headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
          });
          const audioData = await axios.get(resp.data.url, {
            responseType: "arraybuffer",
            headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
          });
          const transcription = await transcreverAudio(audioData.data);
          await dispatchText(db, { text: transcription, userId, reply });
        } catch (error) {
          console.error("Erro ao processar áudio:", error);
          reply("❌ Ocorreu um erro ao processar seu áudio. Tente enviar como texto.");
        }
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("❌ Erro no webhook:", err);
      res.sendStatus(500);
    }
  });

  return router;
}

module.exports = { createWebhookRouter };
