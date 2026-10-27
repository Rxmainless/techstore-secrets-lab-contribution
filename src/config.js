const REQUIRED_VARIABLES = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];

function getDatabaseConfig() {
    const missing = REQUIRED_VARIABLES.filter((name) => !process.env[name]);

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
        password: process.env.DB_PASSWORD
    };
}

module.exports = {
    getDatabaseConfig
};
