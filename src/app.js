require("dotenv").config();

const express = require("express");
const { getDatabaseConfig } = require("./config");
const { connect } = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const database = getDatabaseConfig();

app.get("/", (req, res) => {
    res.json({ message: "API TechStore" });
});

app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        database: database.host
    });
});

app.get("/config-check", (req, res) => {
    res.json({
        database: database.database,
        adminConfigured: Boolean(database.password),
        paymentConfigured: Boolean(process.env.PAYMENT_API_KEY),
        internalApiConfigured: Boolean(process.env.INTERNAL_API_TOKEN),
    });
});

app.listen(PORT, () => {
    connect();
    console.log(`API Techstore is running on port ${PORT}`);
});
