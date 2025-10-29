const { transcreverAudio } = require("./whisper");
const { enviarMensagemTexto } = require("./service");

function createWebhookRouter(db) {
  const express = require("express");
  const router = express.Router();

  const userConfirmationPreferences = new Map();
  const lastAudioTranscription = new Map();

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

  async function handleInteractive(messageObj, phone_number, userId) {
    const interactive = messageObj.interactive;
    if (interactive.type !== "button_reply") return;

    const resposta = interactive.button_reply.id;
    const confirmado = lastAudioTranscription.get(phone_number);

    if (resposta === "confirmar_sim" && confirmado) {
      await db.query("INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)", [userId, confirmado, "audio"]);
      await enviarMensagemTexto(phone_number, "✅ Transcrição confirmada e salva!");
      lastAudioTranscription.delete(phone_number);
      console.log(`[BOTÃO] Transcrição confirmada: ${confirmado}`);
    } else if (resposta === "confirmar_nao") {
      await enviarMensagemTexto(phone_number, "❌ Mensagem descartada.");
      lastAudioTranscription.delete(phone_number);
      console.log(`[BOTÃO] Transcrição rejeitada`);
    }
  }

  async function handleText(messageObj, phone_number, userId) {
    const message_text = messageObj.text.body.trim();
    await db.query("INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)", [userId, message_text, "text"]);
    console.log(`[TEXTO] ${phone_number}: ${message_text}`);
  }

  async function handleButton(messageObj, phone_number, userId) {
    const payload = messageObj.button.payload;
    if (payload.toLowerCase().startsWith("confirmar:")) {
      const confirmado = payload.slice("confirmar:".length).trim();
      await db.query("INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)", [userId, confirmado, "audio"]);
      await enviarMensagemTexto(phone_number, "✅ Transcrição confirmada e salva!");
      lastAudioTranscription.delete(phone_number);
      console.log(`[BUTTON_PAYLOAD] Transcrição confirmada: ${confirmado}`);
    }
  }

  async function handleAudio(messageObj, phone_number, userId) {
    const axios = require("axios");
    const media_id = messageObj.audio.id;

    // Pega URL do arquivo de áudio
    const response = await axios({
      method: "GET",
      url: `https://graph.facebook.com/v18.0/${media_id}`,
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    });
    const audioUrl = response.data.url;

    // Baixa áudio
    const audioData = await axios({
      method: "GET",
      url: audioUrl,
      responseType: "arraybuffer",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    });

    // Transcreve
    const transcription = await transcreverAudio(audioData.data);
    lastAudioTranscription.set(phone_number, transcription);

    if (userConfirmationPreferences.get(phone_number) === false) {
      await db.query("INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)", [userId, transcription, "audio"]);
      console.log(`[ÁUDIO] Transcrição salva automaticamente: ${transcription}`);
    } else {
      await axios.post(`https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp",
        to: phone_number,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: `Transcrição: ${transcription}\nDeseja confirmar?` },
          action: {
            buttons: [
              { type: "reply", reply: { id: "confirmar_sim", title: "✅ Sim" } },
              { type: "reply", reply: { id: "confirmar_nao", title: "❌ Não" } }
            ]
          }
        }
      }, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" }});
      console.log(`[ÁUDIO] Transcrição enviada para confirmação: ${transcription}`);
    }
  }

  // ===== POST /webhook =====
  router.post("/", async (req, res) => {
    try {
      const webhookData = req.body;
      const messageObj = webhookData?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const phone_number = messageObj?.from;
      const message_type = messageObj?.type;

      if (!phone_number) return res.sendStatus(200);
      if (phone_number.startsWith("1646")) return res.sendStatus(200);

      const userId = await getUserId(phone_number);

      if (message_type === "interactive") await handleInteractive(messageObj, phone_number, userId);
      else if (message_type === "text") await handleText(messageObj, phone_number, userId);
      else if (message_type === "button") await handleButton(messageObj, phone_number, userId);
      else if (message_type === "audio") await handleAudio(messageObj, phone_number, userId);

      res.sendStatus(200);
    } catch (error) {
      console.error("❌ Erro no webhook:", error);
      res.sendStatus(500);
    }
  });

  return router;
}

module.exports = { createWebhookRouter };
