const transactionRepo = require("../repositories/transactionRepository");

async function registerSale(db, { userId, product, quantity, unitPrice }) {
  const total = quantity * unitPrice;

  return transactionRepo.insert(db, {
    userId,
    kind: "sale",
    product,
    quantity,
    unitPrice,
    total,
  });
}

async function registerCost(db, { userId, product, quantity, unitPrice }) {
  const total = quantity * unitPrice;

  return transactionRepo.insert(db, {
    userId,
    kind: "cost",
    product,
    quantity,
    unitPrice,
    total,
  });
}

async function registerExpense(db, { userId, description, value }) {
  return transactionRepo.insert(db, {
    userId,
    kind: "expense",
    product: description,
    quantity: 1,
    unitPrice: value,
    total: value,
  });
}

async function registerIncome(db, { userId, description, value }) {
  return transactionRepo.insert(db, {
    userId,
    kind: "income",
    product: description,
    quantity: 1,
    unitPrice: value,
    total: value,
  });
}

module.exports = { 
  registerSale,
  registerCost,
  registerExpense,
  registerIncome,
 };
