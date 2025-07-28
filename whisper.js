const { OpenAI } = require("openai");
const fs = require("fs");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function transcreverAudio(buffer) {
  try {
    const filePath = "./temp_audio.ogg";
    fs.writeFileSync(filePath, buffer);
    const resp = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      response_format: "text",
    });
    fs.unlinkSync(filePath);
    return resp;
  } catch (err) {
    console.error("Erro na transcrição:", err);
    return null;
  }
}

module.exports = { transcreverAudio };
