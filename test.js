const { dispatchText } = require('./src/dispatcher');
const { initDatabase } = require('./src/database');

async function runTest() {
  console.log("Iniciando teste offline...");
  const db = await initDatabase();

  const reply = (text) => {
    console.log("--- RESPOSTA DO BOT ---");
    console.log(text);
    console.log("-----------------------");
  };

  // Teste 1: Despesa
  await dispatchText(db, { text: "gastei 50 luz", userId: 1, reply });

  // Teste 2: Venda
  await dispatchText(db, { text: "vendi 2 coca por 7.50", userId: 1, reply });

  // Teste 3: Ajuda
  await dispatchText(db, { text: "ajuda", userId: 1, reply });

  console.log("Teste finalizado!");
  process.exit(0);
}

runTest();