const fs = require("fs");
const login = require("ws3-fca");
const express = require("express");
const axios = require("axios");
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

// Load commands from cmds folder
const commandFiles = fs.readdirSync('./cmds').filter(file => file.endsWith('.js'));
const commands = {};
commandFiles.forEach(file => {
    const command = require(`./cmds/${file}`);
    commands[command.name] = command;
});

// Stockage des sessions utilisateur
const userSessions = {}; // { senderID: "commandName" }

login({ appState }, (err, api) => {
    if (err) return console.error(err);

    api.setOptions({
        forceLogin: true,
        listenEvents: true,
        logLevel: "silent",
        selfListen: false
    });

    function handleMessage(event) {
        const prefix = config.prefix;
        const message = event.body.trim().toLowerCase();
        const senderId = event.senderID;

        // Vérifier si l'utilisateur a une session active
        if (userSessions[senderId]) {
            if (message === "stop") {
                api.sendMessage(`La commande ${userSessions[senderId]} a été désactivée avec succès.`, event.threadID);
                delete userSessions[senderId]; // Supprime la session
                return;
            }
            // Continue avec la commande active
            return commands[userSessions[senderId]].execute(api, event, message.split(/ +/));
        }

        // Vérifier si le message commence par un préfixe de commande
        if (message.startsWith(prefix)) {
            const args = message.slice(prefix.length).split(/ +/);
            const commandName = args.shift().toLowerCase();

            if (commands[commandName]) {
                if (commandName === "help") {
                    // Help fonctionne sans session persistante
                    return commands[commandName].execute(api, event, args);
                } else {
                    // Activer la session pour une commande persistante
                    userSessions[senderId] = commandName;
                    return commands[commandName].execute(api, event, args);
                }
            }
        }

        // Si aucune commande valide, utiliser l'API Gemini
        axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
            prompt: message,
            customId: senderId
        }).then(response => {
            api.sendMessage(response.data.message, event.threadID);
        }).catch(err => console.error("API error:", err));
    }

    api.listenMqtt((err, event) => {
        if (err) return console.error("Listening error:", err);
        if (event.type === "message") handleMessage(event);
    });
});

app.get("/", (req, res) => {
    res.send("Bot is running");
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
