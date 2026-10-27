require("dotenv").config();

const apiKey = process.env.API_KEY;

console.log(`Inicializando rotina de backup...`);
console.log(`API KEY utilizada no backup : ${apiKey}`);
console.log("Backup realizado com sucesso!!!");
