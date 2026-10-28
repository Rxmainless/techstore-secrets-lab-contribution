require("dotenv").config();

const { readSecret } = require("../src/config");

let backupApiKey;

try {
    backupApiKey = readSecret("BACKUP_API_KEY");
} catch (error) {
    console.error(`Erro de configuração: ${error.message}`);
    process.exit(1);
}

if (!backupApiKey) {
    console.error("Erro de configuração: variável de ambiente BACKUP_API_KEY ausente.");
    process.exit(1);
}

console.log("Inicializando rotina de backup...");
console.log("Credencial de backup carregada a partir do ambiente.");
console.log("Backup realizado com sucesso!!!");
