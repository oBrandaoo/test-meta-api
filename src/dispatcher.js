const transactionService = require("./services/transactionService");

async function dispatchText(db, { text, userId, reply }) {
  const lower = text.toLowerCase().trim();

  // VENDA
  const saleRegex1 = /vendi\s+R?\$?\s*([\d,.]+)\s+(?:com|no|na|em)?\s*(.+)/i;
  const saleRegex2 = /vendi\s+(?:com|no|na|em)?\s*(.+?)\s+R?\$?\s*([\d,.]+)/i;
  const saleMatch = lower.match(saleRegex1) || lower.match(saleRegex2);

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

  // CUSTO
  const costRegex = /comprei\s+(\d+)?\s*([\w\s]+?)\s+(?:por|a)\s+([\d,\.]+)/i;
  const costMatch = lower.match(costRegex);

  if (costMatch) {
    const quantity = costMatch[1] ? parseInt(costMatch[1]) : 1;
    const product = costMatch[2].trim();
    let unitPrice = parseFloat(costMatch[3].replace(",", "."));

    await transactionService.registerCost(db, {
      userId,
      product,
      quantity,
      unitPrice,
    })

    return reply(`🧾 Compra registrada: ${quantity}x ${product} por R$ ${unitPrice}`)
  }

  // DESPESAS
  const expenseRegex = /(gastei|paguei)\s+R?\$?\s*([\d,\.]+)\s*(.*)?/i;
  const expenseMatch = lower.match(expenseRegex);

  if (expenseMatch) {
    const value = parseFloat(expenseMatch[2].replace(",", "."));
    const desc = expenseMatch[3]?.trim() || "despesa";

    await transactionService.registerExpense(db, {
      userId,
      description: desc,
      value,
    });

    return reply(`📉 Despesa registrada: R$ ${value} (${desc})`);
  }

  // ENTRADAS
  const incomeRegex = /(recebi|ganhei)\s+R?\$?\s*([\d,\.]+)\s*(.*)?/i;
  const incomeMatch = lower.match(incomeRegex);

  if (incomeMatch) {
    const value = parseFloat(incomeMatch[2].replace(",", "."));
    const desc = incomeMatch[3]?.trim() || "entrada";

    await transactionService.registerIncome(db, {
      userId,
      description: desc,
      value,
    });

    return reply(`💰 Entrada registrada: R$ ${value} (${desc})`);
  }

  return reply("🤖 Não entendi. Exemplos:\n• vendi 2 coca por 7\n• comprei 3 água por 2\n• paguei 20 luz\n• recebi 100 pix");
}

module.exports = { dispatchText };
