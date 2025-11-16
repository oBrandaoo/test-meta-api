const transactionRepo = require("../repositories/transactionRepository")

async function getDailyReport(db, userId) {
    const today = new Date().toISOString().split('T')[0];

    const[sales] = await db.query(
        `SELECT SUM(total) as total, COUNT(*) as count
        FROM transactions
        WHERE user_id = ? AND kind = 'sale' AND DATE(created_at) = ?`,
        [userId, today]
    );

    const [expenses] = await db.query(
        `SELECT SUM(total) as total, COUNT(*) as count 
        FROM transactions 
        WHERE user_id = ? AND kind IN ('expense', 'cost') AND DATE(created_at) = ?`,
        [userId, today]
    );

    const [income] = await db.query(
        `SELECT SUM(total) as total, COUNT(*) as count 
        FROM transactions 
        WHERE user_id = ? AND kind = 'income' AND DATE(created_at) = ?`,
        [userId, today]
    );

    const salesTotal = sales[0].total || 0;
    const expenseTotal = expenses[0].total || 0;
    const incomeTotal = income[0].total || 0;
    const balance = salesTotal + incomeTotal - expenseTotal;

    return {
        sales: { total: salesTotal, count: sales[0].count || 0 },
        expenses: { total: expenseTotal, count: expenses[0].count || 0},
        income: { total: incomeTotal, count: income[0].count || 0},
        balance
    };
}

async function getTopProducts(db, userId, days = 7) {
    const [products] = await db.query(
        `SELECT product, SUM(quantity) as total_quantity, SUM(total) as total_revenue
        FROM transactions 
        WHERE user_id = ? AND kind = 'sale' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY product
        ORDER BY total_quantity DESC
        LIMIT 5`,
        [userId, days]
    );

    return products;
}

module.exports = {getDailyReport, getTopProducts};