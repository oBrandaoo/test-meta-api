async function enviarMensagemTexto(phone_number, texto) {
  await axios.post(
    "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages",
    {
      messaging_product: "whatsapp",
      to: phone_number,
      text: { body: texto }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

module.exports = { enviarMensagemTexto }