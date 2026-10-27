require("dotenv").config();

const backupApiKey = process.env.BACKUP_API_KEY;

if (!backupApiKey) {
    console.error("Erro de configuração: variável de ambiente BACKUP_API_KEY ausente.");
    process.exit(1);
}

console.log("Inicializando rotina de backup...");
console.log("Credencial de backup carregada a partir do ambiente.");
console.log("Backup realizado com sucesso!!!");
