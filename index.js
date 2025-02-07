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

// Object to track active commands per user
let activeCommands = {};

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
        const message = event.body;
        const senderId = event.senderID;
        const attachments = event.attachments || [];

        // Check if the user has an active command
        if (activeCommands[senderId]) {
            const activeCommand = activeCommands[senderId];
            if (message.toLowerCase() === "stop") {
                // Disable the active command for the user
                delete activeCommands[senderId];
                api.sendMessage(`La commande ${activeCommand} a été désactivée avec succès.`, event.threadID);
                return;
            } else if (commands[activeCommand]) {
                // Continue conversation with active command
                return commands[activeCommand].execute(api, event, [message]);
            }
        }

        // Check for a command with prefix
        if (message.startsWith(prefix)) {
            const args = message.slice(prefix.length).split(/ +/);
            const commandName = args.shift().toLowerCase();

            if (commands[commandName]) {
                if (commandName === "help") {
                    // Help command doesn't need a stop command
                    return commands[commandName].execute(api, event, args);
                }

                // Set active command for the user
                activeCommands[senderId] = commandName;

                // Execute the selected command
                return commands[commandName].execute(api, event, args);
            } else {
                // If the command does not exist, let Gemini handle it
                api.sendMessage("⏳ Veuillez patienter un instant pendant que Bruno traite votre demande...", event.threadID);
                axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                    prompt: message,
                    customId: senderId
                }).then(response => {
                    api.sendMessage(response.data.message, event.threadID);
                }).catch(err => console.error("API error:", err));
            }
        }

        // If the message contains attachments, process with Gemini API
        if (attachments.length > 0 && attachments[0].type === 'photo') {
            api.sendMessage("⏳💫 Veuillez patienter un instant pendant que Bruno analyse votre image...", event.threadID);

            const imageUrl = attachments[0].url;
            axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                link: imageUrl,
                prompt: "Analyse du texte de l'image pour détection de mots-clés",
                customId: senderId
            }).then(ocrResponse => {
                const ocrText = ocrResponse.data.message || "";
                const hasExerciseKeywords = /(\d+\)|[a-zA-Z]\)|Exercice)/.test(ocrText);
                const prompt = hasExerciseKeywords
                    ? "Faire cet exercice et donner la correction complète de cet exercice"
                    : "Décrire cette photo";

                return axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                    link: imageUrl,
                    prompt,
                    customId: senderId
                });
            }).then(response => {
                api.sendMessage(response.data.message, event.threadID);
            }).catch(err => console.error("OCR/Response error:", err));
        } else if (!message.startsWith(prefix)) {
            // If there's no command, fallback to Gemini API
            api.sendMessage("⏳ Veuillez patienter un instant pendant que Bruno traite votre demande...", event.threadID);

            axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                prompt: message,
                customId: senderId
            }).then(response => {
                api.sendMessage(response.data.message, event.threadID);
            }).catch(err => console.error("API error:", err));
        }
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
