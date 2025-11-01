const fs = require("fs");

function updateEnvVar(key, value) {
  const env = fs.readFileSync(".env", "utf8").split("\n");
  const index = env.findIndex((line) => line.startsWith(`${key}=`));
  if (index !== -1) env[index] = `${key}=${value}`;
  else env.push(`${key}=${value}`);
  fs.writeFileSync(".env", env.join("\n"));
}

function randomToken() {
  return Math.random().toString(36).substring(2, 12);
}

module.exports = { updateEnvVar, randomToken };
