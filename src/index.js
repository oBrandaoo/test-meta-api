require("dotenv").config();
const express = require("express");
const axios = require("axios");
const ngrok = require("@ngrok/ngrok");

const { initDatabase } = require("./database");
const { createWebhookRouter } = require("./webhook");
const { updateEnvVar, randomToken } = require("./config");

const port = process.env.PORT;

async function start() {
  const app = express();
  app.use(express.json());

  // Inicializa DB antes de criar router
  const db = await initDatabase();

  // Token
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  updateEnvVar("VERIFY_TOKEN", VERIFY_TOKEN);
  console.log("🔑 VERIFY_TOKEN =", VERIFY_TOKEN);

  // Router agora recebe DB válido
  app.use("/webhook", createWebhookRouter(db));

  // Inicia servidor
  app.listen(port, async () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);

    try {
      // Ngrok
      const listener = await ngrok.connect({
        addr: port,
        authtoken: process.env.NGROK_AUTHTOKEN
      });
      const url = listener.url();
      updateEnvVar("NGROK_URL", url);

      console.log("🌍 NGROK_URL =", url);
      console.log("📡 Webhook URL =", `${url}/webhook`);

      // Registrar webhook na Meta
      const appId = process.env.META_APP_ID;
      const appSecret = process.env.META_APP_SECRET;

      const accessTokenResp = await axios.get(
        "https://graph.facebook.com/oauth/access_token",
        {
          params: {
            client_id: appId,
            client_secret: appSecret,
            grant_type: "client_credentials",
          },
        }
      );

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
        {
          headers: {
            Authorization: `Bearer ${appAccessToken}`,
          },
        }
      );

      console.log("✅ Webhook registrado com sucesso!");
    } catch (err) {
      console.error("❌ Erro ao registrar webhook ou ngrok:", err?.response?.data || err.message);
    }
  });
}

start();
