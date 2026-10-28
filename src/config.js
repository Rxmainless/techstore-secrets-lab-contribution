const fs = require("node:fs");

const REQUIRED_VARIABLES = ["DB_HOST", "DB_USER", "DB_NAME"];

function readSecret(name) {
    const filePath = process.env[`${name}_FILE`];

    if (filePath) {
        try {
            return fs.readFileSync(filePath, "utf8").trim();
        } catch {
            throw new Error(`não foi possível ler o arquivo indicado em ${name}_FILE`);
        }
    }

    return process.env[name];
}

function getDatabaseConfig() {
    const password = readSecret("DB_PASSWORD");
    const missing = REQUIRED_VARIABLES.filter((name) => !process.env[name]);

    if (!password) {
        missing.push("DB_PASSWORD");
    }

    if (missing.length > 0) {
        throw new Error(
            `variáveis de ambiente obrigatórias ausentes: ${missing.join(", ")}`
        );
    }

    return {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password
    };
}

module.exports = {
    getDatabaseConfig,
    readSecret
};
