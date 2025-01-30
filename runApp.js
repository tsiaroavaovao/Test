const axios = require("axios");
const fs = require("fs");
const login = require("ws3-fca");
const express = require("express");
const app = express();

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
let appState = null;
try {
    appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));
} catch (error) {
    console.error("Failed to load appstate.json", error);
}

const port = config.port || 3000;
const commandFiles = fs.readdirSync('./cmds').filter(file => file.endsWith('.js'));
const commands = {};
commandFiles.forEach(file => {
    const command = require(`./cmds/${file}`);
    commands[command.name] = command;
});

let activeSession = {}; // Stocke les utilisateurs en session continue

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
        bypassRegion: "PNB",
        selfListen: false,
        online: true,
        autoMarkDelivery: true,
        autoMarkRead: true
    });

    function handleUserMessage(event) {
        const prefix = config.prefix;
        const message = event.body.toLowerCase();
        const senderID = event.senderID;

        if (message === "stop") {
            delete activeSession[senderID];
            api.sendMessage("Session terminée. Vous pouvez recommencer en envoyant une commande.", event.threadID);
            return;
        }

        if (message === "help") {
            delete activeSession[senderID];
            api.sendMessage("Commandes réactivées. Vous pouvez utiliser une commande.", event.threadID);
            return;
        }

        if (activeSession[senderID]) {
            // Répondre en continu si une session est active
            commands["ai"].execute(api, event, [message]);
            return;
        }

        if (message.startsWith(prefix)) {
            const args = message.slice(prefix.length).split(/ +/);
            const commandName = args.shift().toLowerCase();
            if (commands[commandName]) {
                commands[commandName].execute(api, event, args);
                if (commandName === "ai") {
                    activeSession[senderID] = true;
                }
            } else {
                api.sendMessage("Commande invalide.", event.threadID);
            }
        } else {
            axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                prompt: message,
                customId: senderID
            }).then(response => {
                api.sendMessage("\ud83c\uddf2\ud83c\uddf3 **BOT MADA** \ud83c\uddf2\ud83c\uddf3\n\n" + response.data.message, event.threadID);
            }).catch(error => {
                console.error("Erreur API:", error);
            });
        }
    }

    api.listenMqtt((err, event) => {
        if (err) return console.error("Error while listening:", err);

        if (event.type === "message") {
            handleUserMessage(event);
        }
    });
});

app.get("/", (req, res) => {
    res.send("Bot is running");
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
