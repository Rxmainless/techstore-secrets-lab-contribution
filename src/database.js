const { getDatabaseConfig } = require("./config");

const database = getDatabaseConfig();

const connection = {
    host: database.host,
    port: database.port,
    database: database.database,
    username: "root",
    password: database.password
};

function connect() {
    console.log(
        `conectando ao banco ${connection.database} como ${connection.username}...`
    );

    return connection;
}

module.exports = {
    connect
};
