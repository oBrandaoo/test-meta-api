require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const mysql = require("mysql2/promise");
const { transcreverAudio } = require("./whisper");
const { enviarMensagemTexto } = require("./service");
const port = 3000

const app = express();
app.use(bodyParser.json());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

const userConfirmationPreferences = new Map();
const lastAudioTranscription = new Map();

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

    if (phone_number.startsWith("1646")) {
      console.log("Mensagem automática da Meta ignorada.");
      return res.sendStatus(200);
    }

    const [existingUser] = await db.query("SELECT id FROM users WHERE phone_number = ?", [phone_number]);
    let userId;
    if (existingUser.length === 0) {
      const result = await db.query("INSERT INTO users (phone_number) VALUES (?)", [phone_number]);
      userId = result[0].insertId;
    } else {
      userId = existingUser[0].id;
    }

    if (messageObj.type === "interactive") {
      const interactive = messageObj.interactive;

      if (interactive.type === "button_reply") {
        const resposta = interactive.button_reply.id; // "confirmar_sim" ou "confirmar_nao"
        console.log("Usuário clicou no botão:", resposta);

        if (resposta === "confirmar_sim") {
          const confirmado = lastAudioTranscription.get(phone_number);

          if (confirmado) {
            await db.query(
              "INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)",
              [userId, confirmado, "audio"]
            );

            await enviarMensagemTexto(phone_number, "✅ Transcrição confirmada e salva!");
            lastAudioTranscription.delete(phone_number);
            console.log("Transcrição confirmada e salva via botão:", confirmado);
          }
        } else if (resposta === "confirmar_nao") {
          await enviarMensagemTexto(phone_number, "❌ Ok, mensagem descartada.");
          lastAudioTranscription.delete(phone_number);
          console.log("Usuário rejeitou a transcrição.");
        }
      }

      return res.sendStatus(200);
    }

    if (message_type === "text") {
      const message_text = messageObj.text.body.trim();

      await db.query(
        "INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)",
        [userId, message_text, "text"]
      );

      console.log("Texto salvo no banco:", message_text);
    }

    if (message_type === "button") {
      const payload = messageObj.button.payload; // vem do botão
      console.log("Payload do botão:", payload);

      if (payload.toLowerCase().startsWith("confirmar:")) {
        const confirmado = payload.slice("confirmar:".length).trim();

        await db.query(
          "INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)",
          [userId, confirmado, "audio"]
        );

        await enviarMensagemTexto(phone_number, "✅ Transcrição confirmada e salva!");
        lastAudioTranscription.delete(phone_number);
        console.log("Transcrição confirmada e salva via botão:", confirmado);
        return res.sendStatus(200);
      }
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
      lastAudioTranscription.set(phone_number, transcription);

      if (userConfirmationPreferences.get(phone_number) === false) {
        await db.query(
          "INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)",
          [userId, transcription, "audio"]
        );
        console.log("Áudio salvo automaticamente:", transcription);
      } else {
        await axios.post(`https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`, {
          messaging_product: "whatsapp",
          to: phone_number,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: `Transcrição: ${transcription}\n\nDeseja confirmar?`
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: "confirmar_sim",
                    title: "✅ Sim"
                  }
                },
                {
                  type: "reply",
                  reply: {
                    id: "confirmar_nao",
                    title: "❌ Não"
                  }
                }
              ]
            }
          }
        }, {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          }
        });

        console.log("Transcrição enviada para confirmação:", transcription);
      }
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
