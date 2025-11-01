
const VALUE_RE = /(?:r\$|rs|reais|\b)(\s*)?([0-9]+(?:[.,][0-9]{1,2})?)/i;

function parseValue(text) {
  const m = text.match(VALUE_RE);
  if (!m) return null;
  // normalize 1.234,56 or 1234.56 or 50 -> 50.00
  let v = m[2].replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function detectIntent(text) {
  const t = (text || "").toLowerCase();

  // keywords for sale
  const saleKeywords = ["venda", "vendi", "receita", "recebi", "vender", "registrar venda", "registrar uma venda", "registrei venda", "vende"];
  const expenseKeywords = ["gasto", "gastei", "custo", "despesa", "paguei", "compras", "compra"];
  const balanceKeywords = ["saldo", "quanto tenho", "balanço", "balanço do caixa", "saldo atual"];
  const helpKeywords = ["ajuda", "help", "como", "comandos", "o que posso fazer"];

  // exact commands (if user uses slash)
  if (/^\/venda\b/.test(t) || saleKeywords.some(k => t.includes(k))) {
    return { intent: "register_sale", value: parseValue(text) };
  }
  if (/^\/custo\b/.test(t) || expenseKeywords.some(k => t.includes(k))) {
    return { intent: "register_expense", value: parseValue(text) };
  }
  if (balanceKeywords.some(k => t.includes(k))) {
    return { intent: "get_balance" };
  }
  if (helpKeywords.some(k => t.includes(k))) {
    return { intent: "help" };
  }

  // fallback: if includes a number and 'r$' maybe sale
  if (parseValue(text) !== null) {
    // unknown whether sale or expense — ask for clarification
    return { intent: "ambiguous_amount", value: parseValue(text) };
  }

  return { intent: "unknown" };
}

module.exports = { detectIntent, parseValue };
