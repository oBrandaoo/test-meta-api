require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const ngrok = require("@ngrok/ngrok");
const fs = require("fs");
const mysql = require("mysql2/promise");
const { transcreverAudio } = require("./whisper");
const { enviarMensagemTexto } = require("./service");

// Porta do servidor
const port = process.env.PORT || 3000;

// Função utilitária para atualizar .env
function updateEnvVar(key, value) {
  const env = fs.readFileSync(".env", "utf8").split("\n");
  const index = env.findIndex((line) => line.startsWith(`${key}=`));
  if (index !== -1) env[index] = `${key}=${value}`;
  else env.push(`${key}=${value}`);
  fs.writeFileSync(".env", env.join("\n"));
}

// Gera token aleatório simples
function randomToken() {
  return Math.random().toString(36).substring(2, 12);
}

// Cria Express
const app = express();
app.use(bodyParser.json());

// Banco de dados
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Mapas para controle interno
const userConfirmationPreferences = new Map();
const lastAudioTranscription = new Map();

// ===== Gera VERIFY_TOKEN =====
const VERIFY_TOKEN = randomToken();
updateEnvVar("VERIFY_TOKEN", VERIFY_TOKEN);
console.log("🔑 VERIFY_TOKEN =", VERIFY_TOKEN);

// ===== Rota GET para validação do webhook =====
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK_VERIFIED");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Falha na verificação do webhook");
    res.sendStatus(403);
  }
});

// ===== Rota POST para receber mensagens =====
app.post("/webhook", async (req, res) => {
  try {
    const webhookData = req.body;
    const messageObj = webhookData?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const phone_number = messageObj?.from;
    const message_type = messageObj?.type;

    if (!phone_number) return res.sendStatus(200);
    if (phone_number.startsWith("1646")) return res.sendStatus(200);

    // Verifica usuário no banco
    const [existingUser] = await db.query("SELECT id FROM users WHERE phone_number = ?", [phone_number]);
    let userId;
    if (existingUser.length === 0) {
      const result = await db.query("INSERT INTO users (phone_number) VALUES (?)", [phone_number]);
      userId = result[0].insertId;
    } else {
      userId = existingUser[0].id;
    }

    // Mensagens interativas (botões)
    if (message_type === "interactive") {
      const interactive = messageObj.interactive;
      if (interactive.type === "button_reply") {
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
      return res.sendStatus(200);
    }

    // Mensagem de texto
    if (message_type === "text") {
      const message_text = messageObj.text.body.trim();
      await db.query("INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)", [userId, message_text, "text"]);
      console.log(`[TEXTO] ${phone_number}: ${message_text}`);
    }

    // Mensagem do tipo botão
    if (message_type === "button") {
      const payload = messageObj.button.payload;
      if (payload.toLowerCase().startsWith("confirmar:")) {
        const confirmado = payload.slice("confirmar:".length).trim();
        await db.query("INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)", [userId, confirmado, "audio"]);
        await enviarMensagemTexto(phone_number, "✅ Transcrição confirmada e salva!");
        lastAudioTranscription.delete(phone_number);
        console.log(`[BUTTON_PAYLOAD] Transcrição confirmada: ${confirmado}`);
        return res.sendStatus(200);
      }
    }

    // Mensagem de áudio
    if (message_type === "audio") {
      const media_id = messageObj.audio.id;

      const response = await axios({
        method: "GET",
        url: `https://graph.facebook.com/v18.0/${media_id}`,
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
      });

      const audioUrl = response.data.url;

      const audioData = await axios({
        method: "GET",
        url: audioUrl,
        responseType: "arraybuffer",
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
      });

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

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Erro no webhook:", error);
    res.sendStatus(500);
  }
});

// ===== Inicia servidor =====
app.listen(port, async () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);

  // ===== Conecta ngrok =====
  try {
    const listener = await ngrok.connect({ addr: port, authtoken: process.env.NGROK_AUTHTOKEN });
    const url = await listener.url();
    updateEnvVar("NGROK_URL", url);
    console.log("🌍 NGROK_URL =", url);
    console.log("📡 Webhook URL =", `${url}/webhook`);

    // ===== Registra webhook na Meta =====
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const accessTokenResp = await axios.get("https://graph.facebook.com/oauth/access_token", {
      params: { client_id: appId, client_secret: appSecret, grant_type: "client_credentials" },
    });
    const appAccessToken = accessTokenResp.data.access_token;
    updateEnvVar("APP_ACCESS_TOKEN", appAccessToken);

    await axios.post(
      `https://graph.facebook.com/v19.0/${appId}/subscriptions`,
      {
        object: "whatsapp_business_account",
        callback_url: `${url}/webhook`,
        verify_token: VERIFY_TOKEN,
        fields: "messages",
      },
      { headers: { Authorization: `Bearer ${appAccessToken}` } }
    );
    console.log("✅ Webhook registrado com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao registrar webhook ou ngrok:", err.response?.data || err.message);
  }
});
