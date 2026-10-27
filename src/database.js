const { getDatabaseConfig } = require("./config");

function connect(config = getDatabaseConfig()) {
    const connection = {
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password
    };

    console.log("conectando ao banco de dados...");

    return connection;
}

module.exports = {
    connect
};
