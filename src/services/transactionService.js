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

async function registerExpense(db, { userId, product, quantity, unitPrice }) {
  const total = quantity * unitPrice;

  return transactionRepo.insert(db, {
    userId,
    kind: "expense",
    product,
    quantity,
    unitPrice,
    total,
  });
}

async function registerIncome(db, { userId, product, quantity, unitPrice }) {
  const total = quantity * unitPrice;

  return transactionRepo.insert(db, {
    userId,
    kind: "income",
    product,
    quantity,
    unitPrice,
    total,
  });
}

module.exports = { 
  registerSale,
  registerCost,
  registerExpense,
  registerIncome,
 };
