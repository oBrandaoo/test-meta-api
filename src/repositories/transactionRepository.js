
async function insert(db, { userId, kind, product, quantity, unitPrice, total }) {
  return db.query(
    `INSERT INTO transactions (user_id, kind, product, quantity, unit_price, total)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, kind, product, quantity, unitPrice, total]
  );
}

module.exports = { insert };
