const transactionService = require("./services/transactionService");

const numberWords = {
  um: 1, uma: 1,
  dois: 2, duas: 2,
  tres: 3, quatro: 4,
  cinco: 5, seis: 6,
  sete: 7, oito: 8,
  nove: 9, dez: 10,
};

function parseNumber(str) {
  return parseFloat(
    str.replace("r$", "")
       .replace("reais", "")
       .replace(",", ".")
       .trim()
  );
}

async function dispatchText(db, { text, userId, reply }) {
  const lower = text.toLowerCase().trim();

  // VENDAS
  const saleRegex = /vendi\s+(\d+|\w+)?\s*([\w\s]+)?\s*(?:por|a)?\s*R?\$?\s*([\d,.]+)/i;
  const saleMatch = lower.match(saleRegex);

  if (saleMatch) {
    let qtyRaw = saleMatch[1];
    let product = (saleMatch[2] || "produto").trim();
    let price = parseNumber(saleMatch[3]);

    let quantity = 1;
    if (qtyRaw) {
      quantity = numberWords[qtyRaw] || parseInt(qtyRaw) || 1;
    }

    await transactionService.registerSale(db, {
      userId,
      product,
      quantity,
      unitPrice: price,
    });

    return reply(`✅ Venda registrada: ${quantity}x ${product} por ${price}`);
  }

  // CUSTOS
  const costRegex = /comprei\s+(\d+|\w+)?\s*([\w\s]+)?\s*(?:por|a)?\s*R?\$?\s*([\d,.]+)/i;
  const costMatch = lower.match(costRegex);

  if (costMatch) {
    let qtyRaw = costMatch[1];
    let product = (costMatch[2] || "item").trim();
    let price = parseNumber(costMatch[3]);

    let quantity = 1;
    if (qtyRaw) {
      quantity = numberWords[qtyRaw] || parseInt(qtyRaw) || 1;
    }

    await transactionService.registerCost(db, {
      userId,
      product,
      quantity,
      unitPrice: price,
    });

    return reply(`🧾 Compra registrada: ${quantity}x ${product} por ${price}`);
  }

  // DESPESAS
  const expenseRegex = /(gastei|paguei)\s+R?\$?\s*([\d,.]+)\s*(.*)?/i;
  const expenseMatch = lower.match(expenseRegex);

  if (expenseMatch) {
    const value = parseNumber(expenseMatch[2]);
    const desc = expenseMatch[3]?.trim() || "despesa";

    await transactionService.registerExpense(db, {
      userId,
      description: desc,
      value,
    });

    return reply(`📉 Despesa registrada: ${desc} (R$ ${value})`);
  }

  // ENTRADAS
  const incomeRegex = /(recebi|ganhei|entrou)\s+R?\$?\s*([\d,.]+)\s*(.*)?/i;
  const incomeMatch = lower.match(incomeRegex);

  if (incomeMatch) {
    const value = parseNumber(incomeMatch[2]);
    const desc = incomeMatch[3]?.trim() || "entrada";

    await transactionService.registerIncome(db, {
      userId,
      description: desc,
      value,
    });

    return reply(`💰 Entrada registrada: ${desc} (R$ ${value})`);
  }

  return reply("🤖 Não entendi. Exemplos:\n• vendi 2 coca por 7\n• comprei 3 água por 2\n• paguei 20 luz\n• recebi 100 pix");
}

module.exports = { dispatchText };
