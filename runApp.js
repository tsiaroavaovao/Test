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
        const message = event.body;

        if (message.startsWith(prefix)) {
            const args = message.slice(prefix.length).split(/ +/);
            const commandName = args.shift().toLowerCase();
            if (commands[commandName]) {
                commands[commandName].execute(api, event, args);
            } else {
                api.sendMessage("Commande invalide.", event.threadID);
            }
        } else {
            axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                prompt: message,
                customId: event.senderID
            }).then(response => {
                api.sendMessage("🇲🇬 **BOT MADA** 🇲🇬\n\n" + response.data.message, event.threadID);
            }).catch(error => {
                console.error("Erreur API:", error);
            });
        }
    }

    const stopListening = api.listenMqtt((err, event) => {
        if (err) return console.error("Error while listening:", err);

        if (event.type === "message") {
            if (event.attachments.length > 0 && event.attachments[0].type === "photo") {
                const imageUrl = event.attachments[0].url;
                axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                    link: imageUrl,
                    prompt: "Analyse du texte de l'image pour détection de mots-clés",
                    customId: event.senderID
                }).then(ocrResponse => {
                    const ocrText = ocrResponse.data.message || "";
                    const hasExerciseKeywords = /\d+\)|[a-c]\)/i.test(ocrText);
                    const prompt = hasExerciseKeywords ? "Faire cet exercice et donner la correction complète de cet exercice" : "Décrire cette photo";

                    return axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                        link: imageUrl,
                        prompt,
                        customId: event.senderID
                    });
                }).then(response => {
                    api.sendMessage("🇲🇬 **BOT MADA** 🇲🇬\n\n" + response.data.message, event.threadID);
                }).catch(error => {
                    console.error("Erreur API OCR:", error);
                });
            } else {
                handleUserMessage(event);
            }
        }
    });
});

app.get("/", (req, res) => {
    res.send("Bot is running");
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

