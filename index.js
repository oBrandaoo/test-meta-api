const express = require("express");
const app = express();
const port = 3000;

app.use(express.json());

const VERIFY_TOKEN = "3063WF1k1DGpXCnlgDyPJDniWa9_2z5id3ZMdJ8NJ8nsfD9Ud"; // o mesmo que você coloca no site da Meta

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado com sucesso.");
    res.status(200).send(challenge);
  } else {
    console.log("Falha na verificação do webhook.");
    res.sendStatus(403);
  }
});
app.post('/webhook', (req, res) => {
  console.log("Mensagem recebida:");
  console.dir(req.body, { depth: null });
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
