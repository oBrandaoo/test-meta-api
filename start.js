require("dotenv").config();
const ngrok = require("ngrok");
const { exec } = require("child_process");
const fs = require("fs");
const axios = require("axios");

(async () => {
  try {
    console.log("🚀 Iniciando automação de tokens...");

    // 1️⃣ Gera VERIFY_TOKEN e URL do ngrok
    const url = await ngrok.connect(3000);
    const newVerifyToken = Math.random().toString(36).substring(2, 12);

    // Lê e atualiza .env
    let env = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";

    // Garante que as chaves existam
    if (!env.includes("VERIFY_TOKEN=")) env += "\nVERIFY_TOKEN=";
    if (!env.includes("NGROK_URL=")) env += "\nNGROK_URL=";

    env = env
      .replace(/VERIFY_TOKEN=.*/g, `VERIFY_TOKEN=${newVerifyToken}`)
      .replace(/NGROK_URL=.*/g, `NGROK_URL=${url}`);

    fs.writeFileSync(".env", env);

    console.log("✅ VERIFY_TOKEN e NGROK_URL atualizados");
    console.log(`🔑 VERIFY_TOKEN = ${newVerifyToken}`);
    console.log(`🌍 NGROK_URL    = ${url}`);
    console.log(`📡 Webhook URL = ${url}/webhook\n`);

    // 2️⃣ Atualiza o token do WhatsApp (Meta)
    const { META_APP_ID, META_APP_SECRET, WHATSAPP_TOKEN } = process.env;

    if (META_APP_ID && META_APP_SECRET && WHATSAPP_TOKEN) {
      console.log("🔁 Atualizando token da Meta (WhatsApp)...");

      try {
        const response = await axios.get("https://graph.facebook.com/v18.0/oauth/access_token", {
          params: {
            grant_type: "fb_exchange_token",
            client_id: META_APP_ID,
            client_secret: META_APP_SECRET,
            fb_exchange_token: WHATSAPP_TOKEN,
          },
        });

        const newToken = response.data.access_token;

        let updatedEnv = fs.readFileSync(".env", "utf8");
        if (!updatedEnv.includes("WHATSAPP_TOKEN=")) updatedEnv += "\nWHATSAPP_TOKEN=";
        updatedEnv = updatedEnv.replace(/WHATSAPP_TOKEN=.*/g, `WHATSAPP_TOKEN=${newToken}`);
        fs.writeFileSync(".env", updatedEnv);

        console.log("✅ WHATSAPP_TOKEN renovado com sucesso!");
      } catch (err) {
        console.warn("⚠️  Não foi possível atualizar o token da Meta automaticamente.");
        console.warn(err.response?.data || err.message);
      }
    } else {
      console.log("⚠️  Pulando atualização do WHATSAPP_TOKEN (faltam META_APP_ID, META_APP_SECRET ou WHATSAPP_TOKEN no .env)");
    }

    // 3️⃣ Inicia o servidor
    console.log("\n🚀 Iniciando servidor com nodemon...");
    const child = exec("npm run dev", { stdio: "inherit" });
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);

  } catch (err) {
    console.error("❌ Erro geral:", err);
    process.exit(1);
  }
})();
