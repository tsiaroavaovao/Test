const fs = require("fs");
const login = require("ws3-fca");
const axios = require("axios");
const express = require("express");
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

const port = config.port || 3000;  // Use the port from config.json or default to 3000

// Load commands from the cmds folder
const commandFiles = fs.readdirSync('./cmds').filter(file => file.endsWith('.js'));
const commands = {};
commandFiles.forEach(file => {
    const command = require(`./cmds/${file}`);
    commands[command.name] = command;
});

// Determine login method
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
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0",
        online: true,
        autoMarkDelivery: true,
        autoMarkRead: true
    });

    function handleCommand(event) {
        const prefix = config.prefix;
        const message = event.body;

        if (!message.startsWith(prefix)) {
            handleNonCommandMessage(api, event);
            return;
        }

        const args = message.slice(prefix.length).split(/ +/);
        const commandName = args.shift().toLowerCase();

        if (!commands[commandName]) {
            api.sendMessage("Cette commande n'est pas disponible.", event.threadID);
            return;
        }

        try {
            commands[commandName].execute(api, event, args);
        } catch (error) {
            console.error(`Erreur lors de l'exécution de la commande ${commandName}:`, error);
            api.sendMessage(`Erreur lors de l'exécution de la commande ${commandName}.`, event.threadID);
        }
    }

    function handleNonCommandMessage(api, event) {
        if (event.attachments.length > 0 && event.attachments[0].type === "photo") {
            const imageUrl = event.attachments[0].url;
            axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                link: imageUrl,
                prompt: "Analyse du texte de l'image pour détection de mots-clés",
                customId: event.senderID
            }).then(ocrResponse => {
                const ocrText = ocrResponse.data.message || "";
                const hasExerciseKeywords = /\d+\)|[a-c]\)/i.test(ocrText);
                const prompt = hasExerciseKeywords ? "Faire cet exercice et donner la correction complète." : "Décrire cette photo.";
                
                axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                    link: imageUrl,
                    prompt,
                    customId: event.senderID
                }).then(finalResponse => {
                    api.sendMessage(finalResponse.data.message, event.threadID);
                });
            });
        } else {
            axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                prompt: event.body,
                customId: event.senderID
            }).then(response => {
                api.sendMessage(response.data.message, event.threadID);
            });
        }
    }

    api.listenMqtt((err, event) => {
        if (err) return console.error("Error while listening:", err);
        
        switch (event.type) {
            case "message":
                handleCommand(event);
                break;
            case "event":
                console.log("Other event type:", event);
                break;
        }
    });
});

app.get("/", (req, res) => {
    res.send("Bot is running");
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
