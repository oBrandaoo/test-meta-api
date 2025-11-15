const mysql = require("mysql2/promise");

async function initDatabase() {
    const {
        DB_HOST,
        DB_USER,
        DB_PASS,
        DB_NAME,
        DB_PORT,
    } = process.env;

const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    port: DB_PORT
})

await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
console.log(`✅ Banco ${DB_NAME} verificado/criado.`);

await connection.end();

  const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    port: DB_PORT
  });

  // users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone_number VARCHAR(50) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`);

  // messages (existing)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      message TEXT NOT NULL,
      type ENUM('text','audio') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );`);

  // transactions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      kind ENUM('sale','cost','income','expense') NOT NULL,
      product VARCHAR(255),
      quantity INT DEFAULT 1,
      unit_price DECIMAL(10,2),
      total DECIMAL(10,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );`);

  // states (for FSM)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS states (
      user_id INT PRIMARY KEY,
      step VARCHAR(100),
      payload JSON,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );`);

  // products
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      category VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );`);

  console.log("✅ Tabelas verificadas/criadas.");
  return pool;
}


module.exports = { initDatabase };