const productRepo = require("../repositories/productRepository");

async function registerProduct(db, { userId, name, price, category }) {
  return productRepo.insert(db, {
    userId,
    name,
    price,
    category
  });
}

async function getProductByName(db, userId, name) {
  const [products] = await db.query(
    "SELECT * FROM products WHERE user_id = ? AND name LIKE ?",
    [userId, `%${name}%`]
  );
  
  return products.length > 0 ? products[0] : null;
}

async function listProducts(db, userId) {
  const [products] = await db.query(
    "SELECT * FROM products WHERE user_id = ? ORDER BY name",
    [userId]
  );
  
  return products;
}

module.exports = { 
  registerProduct,
  getProductByName,
  listProducts
};