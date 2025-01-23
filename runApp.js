const fs = require("fs");
const login = require("ws3-fca");
const express = require("express");
const axios = require("axios");  // Ajout de axios pour les requêtes HTTP
const app = express();

// Load configuration from config.json
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// Load appstate from appstate.json
let appState = null;
try {
    appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));
} catch (error) {
    console.error("Failed to load appstate.json", error);
}

const port = config.port || 3000;

// Load commands from the cmds folder
const commandFiles = fs.readdirSync('./cmds').filter(file => file.endsWith('.js'));
const commands = {};
commandFiles.forEach(file => {
    const command = require(`./cmds/${file}`);
    commands[command.name] = command;
});

let loginCredentials;
if (appState && appState.length !== 0) {
    loginCredentials = { appState: appState };
} else {
    console.error("No valid login method found in appstate.json");
    process.exit(1);
}

login(loginCredentials, (err, api) => {
    if (err) return console.error(err);

    api.setOptions({
        forceLogin: true,
        listenEvents: true,
        logLevel: "silent",
        updatePresence: true,
        selfListen: false,
        autoMarkDelivery: true,
        autoMarkRead: true
    });

    function handleCommand(event) {
        const prefix = config.prefix;
        const message = event.body;

        if (message.startsWith(prefix)) {
            const args = message.slice(prefix.length).split(/ +/);
            const commandName = args.shift().toLowerCase();

            if (commands[commandName]) {
                try {
                    commands[commandName].execute(api, event, args);
                } catch (error) {
                    console.error(`Error executing command ${commandName}:`, error);
                    api.sendMessage(`Erreur lors de l'exécution de la commande: ${commandName}.`, event.threadID);
                }
            } else {
                api.sendMessage("Commande invalide.", event.threadID);
            }
        } else {
            callAIResponse(api, event);
        }
    }

    async function callAIResponse(api, event) {
        const userMessage = encodeURIComponent(event.body);
        const apiUrl = `https://ajiro.gleeze.com/api/ai?model=claude-3-sonnet-20240229&system=You%20are%20a%20helpful%20assistant&question=${userMessage}`;

        try {
            const response = await axios.get(apiUrl);
            if (response.data.success && response.data.response) {
                api.sendMessage(response.data.response, event.threadID);
            } else {
                api.sendMessage("Je n'ai pas pu obtenir de réponse pour le moment.", event.threadID);
            }
        } catch (error) {
            console.error("Erreur lors de l'appel à l'API AI:", error);
            api.sendMessage("Une erreur est survenue en contactant l'IA.", event.threadID);
        }
    }

    api.listenMqtt((err, event) => {
        if (err) return console.error("Erreur de connexion:", err);
        if (event.type === "message") {
            handleCommand(event);
        }
    });
});

app.get("/", (req, res) => {
    res.send("Bot is running");
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
