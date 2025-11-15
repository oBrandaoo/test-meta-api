const transactionService = require("./services/transactionService");
const { enviarMensagemTexto } = require("./service")
const { getSession, clearSession } = require("./session") 

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
  const session = getSession(userId);

  if (session.awaiting === "expense_value") {
    const value = parseNumber(lower);

    if (isNaN(value)) {
      return reply("❌ Valor inválido. Envie somente o número. Ex: 50");
    }

    await transactionService.registerExpense(db, {
      userId,
      description: session.description,
      value,
    });

    clearSession(userId);
    return reply(`📉 Despesa registrada: ${session.description} (R$ ${value})`);
  }

  if (session.awaiting === "expense_desc") {
    const desc = lower.trim();

    await transactionService.registerExpense(db, {
      userId,
      description: desc,
      value: session.value,
    });

    clearSession(userId);
    return reply(`📉 Despesa registrada: ${desc} (R$ ${session.value})`);
  }

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

  // CADASTRO DE PRODUTOS
  const productRegex = /cadastrar\s+produto\s+(.+)\s+(?:com|por)\s+R?\$?\s*([\d,.]+)/i;
  const productMatch = lower.match(productRegex);

  if (productMatch) {
    const productService = require("./services/productService");
    const name = productMatch[1].trim();
    const price = parseNumber(productMatch[2]);
    
    await productService.registerProduct(db, {
      userId,
      name,
      price
    });
    
    return reply(`📦 Produto "${name}" cadastrado com sucesso por R$ ${price.toFixed(2)}`);
  }

  // LISTAR PRODUTOS
  if (lower.includes("listar produtos") || lower.includes("meus produtos")) {
    const productService = require("./services/productService");
    const products = await productService.listProducts(db, userId);
    
    if (products.length === 0) {
      return reply("📦 Você não tem produtos cadastrados. Use 'cadastrar produto [nome] com [preço]'");
    }
    
    let message = `📦 *Seus Produtos*\n\n`;
    
    products.forEach((product, index) => {
      message += `${index + 1}. ${product.name}: R$ ${product.price.toFixed(2)}`;
      if (product.category) message += ` (${product.category})`;
      message += "\n";
    });
    
    return reply(message);
  }

  // RELATÓRIOS
  if (lower.includes("relatorio") || lower.includes("relatório") || lower.includes("resumo")) {
    const reportService = require("./services/reportService");
    const report = await reportService.getDailyReport(db, userId);
    
    let message = `📊 *Relatório de Hoje*\n\n`;
    message += `💰 *Vendas*: ${report.sales.count} vendas, R$ ${report.sales.total.toFixed(2)}\n`;
    message += `📉 *Despesas*: ${report.expenses.count} despesas, R$ ${report.expenses.total.toFixed(2)}\n`;
    message += `💵 *Entradas*: ${report.income.count} entradas, R$ ${report.income.total.toFixed(2)}\n`;
    message += `⚖️ *Saldo do dia*: R$ ${report.balance.toFixed(2)}`;
    
    return reply(message);
  }

  if (lower.includes("mais vendidos") || lower.includes("top produtos")) {
    const reportService = require("./services/reportService");
    const topProducts = await reportService.getTopProducts(db, userId);
    
    if (topProducts.length === 0) {
      return reply("📦 Não há vendas registradas nos últimos dias.");
    }
    
    let message = `🏆 *Produtos Mais Vendidos (Últimos 7 dias)*\n\n`;
    
    topProducts.forEach((product, index) => {
      message += `${index + 1}. ${product.product}: ${product.total_quantity} unidades, R$ ${product.total_revenue.toFixed(2)}\n`;
    });
    
    return reply(message);
  }

  // MENU DE AJUDA
  if (lower.includes("ajuda") || lower.includes("help") || lower.includes("comandos")) {
    let message = `🤖 *Comandos Disponíveis*\n\n`;
    message += `💰 *Vendas*: "vendi [quantidade] [produto] por [preço]"\n`;
    message += `🧾 *Compras*: "comprei [quantidade] [produto] por [preço]"\n`;
    message += `📉 *Despesas*: "gastei [valor] [descrição]"\n`;
    message += `💵 *Entradas*: "recebi [valor] [descrição]"\n\n`;
    message += `📦 *Produtos*: "cadastrar produto [nome] com [preço]"\n`;
    message += `📋 *Listar produtos*: "listar produtos"\n\n`;
    message += `📊 *Relatórios*: "relatório" ou "resumo"\n`;
    message += `🏆 *Mais vendidos*: "mais vendidos"\n\n`;
    message += `❓ *Ajuda*: "ajuda"`;
    
    return reply(message);
  }
  return reply("🤖 Não entendi. Digite 'ajuda' para ver os comandos disponíveis.");
}

module.exports = { dispatchText };
