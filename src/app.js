require("dotenv").config();

const crypto = require("node:crypto");
const express = require("express");
const { getDatabaseConfig } = require("./config");
const { connect } = require("./database");

let databaseConfig;

try {
    databaseConfig = getDatabaseConfig();
} catch (error) {
    console.error(`Erro de configuração: ${error.message}`);
    process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");

function tokensMatch(received, expected) {
    const receivedHash = crypto.createHash("sha256").update(received).digest();
    const expectedHash = crypto.createHash("sha256").update(expected).digest();

    return crypto.timingSafeEqual(receivedHash, expectedHash);
}

function requireInternalToken(req, res, next) {
    const expectedToken = process.env.INTERNAL_API_TOKEN;

    if (!expectedToken) {
        return res.status(404).json({ error: "Not Found" });
    }

    const [scheme, token] = (req.get("authorization") || "").split(" ");

    if (scheme !== "Bearer" || !token || !tokensMatch(token, expectedToken)) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    return next();
}

app.get("/", (req, res) => {
    res.json({ message: "API TechStore" });
});

app.get("/health", (req, res) => {
    res.json({ status: "healthy" });
});

app.get("/config-check", requireInternalToken, (req, res) => {
    res.json({
        databaseConfigured: true,
        paymentConfigured: Boolean(process.env.PAYMENT_API_KEY),
        internalApiConfigured: true
    });
});

app.listen(PORT, () => {
    connect(databaseConfig);
    console.log(`API Techstore is running on port ${PORT}`);
});
