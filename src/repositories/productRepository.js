async function insert(db, { userId, name, price, category }) {
  return db.query(
    `INSERT INTO products (user_id, name, price, category)
     VALUES (?, ?, ?, ?)`,
    [userId, name, price, category]
  );
}

module.exports = { insert };