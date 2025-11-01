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

module.exports = { registerSale };
