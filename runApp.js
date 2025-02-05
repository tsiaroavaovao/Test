const fs = require("fs");
const login = require("ws3-fca");
const express = require("express");
const axios = require("axios");
const app = express();

// Charger la configuration depuis config.json
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// Charger appstate depuis appstate.json
let appState = null;
try {
    appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));
} catch (error) {
    console.error("Échec du chargement de appstate.json", error);
}

const port = config.port || 3000;

// Charger les commandes du dossier cmds
const commandFiles = fs.readdirSync('./cmds').filter(file => file.endsWith('.js'));
const commands = {};
commandFiles.forEach(file => {
    const command = require(`./cmds/${file}`);
    commands[command.name] = command;
});

// Gestion des sessions utilisateur
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
        const message = event.body ? event.body.trim() : "";
        const attachments = event.attachments || [];
        const senderId = event.senderID;

        // Vérifier si l'utilisateur a une session active
        if (userSessions[senderId]) {
            if (message.toLowerCase() === "stop") {
                api.sendMessage(`🔴 La commande ${userSessions[senderId]} a été désactivée avec succès.`, event.threadID);
                delete userSessions[senderId]; // Supprimer la session
                return;
            }
            return commands[userSessions[senderId]].execute(api, event, message.split(/ +/));
        }

        // Vérifier si l'utilisateur envoie une nouvelle commande avec préfixe
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
                    api.sendMessage(`✅ La commande ${commandName} est activée. Tapez "stop" pour quitter.`, event.threadID);
                    return commands[commandName].execute(api, event, args);
                }
            }
        }

        // Détection et analyse des images avec Gemini
        if (attachments.length > 0 && attachments[0].type === 'photo') {
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
            }).catch(err => {
                console.error("OCR/Response error:", err);
                api.sendMessage("❌ Erreur lors du traitement de l'image.", event.threadID);
            });

            return;
        }

        // Si aucune commande n'est active, l'API Gemini répond
        axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
            prompt: message,
            customId: senderId
        }).then(response => {
            api.sendMessage(response.data.message, event.threadID);
        }).catch(err => {
            console.error("API error:", err);
            api.sendMessage("❌ Il y a eu une erreur lors du traitement de votre demande.", event.threadID);
        });
    }

    api.listenMqtt((err, event) => {
        if (err) return console.error("Erreur d'écoute :", err);
        if (event.type === "message") handleMessage(event);
    });
});

app.get("/", (req, res) => {
    res.send("Le bot fonctionne !");
});

app.listen(port, () => {
    console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});
