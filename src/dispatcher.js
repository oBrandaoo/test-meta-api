const transactionService = require("./services/transactionService");

async function dispatchText(db, { text, userId, reply }) {
  const lower = text.toLowerCase().trim();

  // VENDA
  const saleRegex = /vendi\s+(\d+)?\s*([\w\s]+?)\s+(?:por|a)\s+([\d,\.]+)/i;
  const saleMatch = lower.match(saleRegex);

  if (saleMatch) {
    const quantity = saleMatch[1] ? parseInt(saleMatch[1]) : 1;
    const product = saleMatch[2].trim();
    let unitPrice = parseFloat(saleMatch[3].replace(",", "."));

    await transactionService.registerSale(db, {
      userId,
      product,
      quantity,
      unitPrice,
    });

    return reply(`✅ Venda registrada: ${quantity}x ${product} por R$ ${unitPrice}`);
  }

  return reply("🤖 Não entendi. Exemplos:\n• vendi 2 coca por 7");
}

module.exports = { dispatchText };
