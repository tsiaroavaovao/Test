const login = require("ws3-fca");
const express = require("express");
const axios = require("axios");
const app = express();

// Charger la configuration depuis config.json
const fs = require("fs");
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// Charger appstate depuis les variables d'environnement
let appState = null;
try {
    appState = JSON.parse(process.env.APPSTATE); // Charger depuis la variable d'environnement
    console.log("Appstate chargé avec succès depuis les variables d'environnement.");
} catch (error) {
    console.error("Échec du chargement de l'appstate depuis l'environnement", error);
    process.exit(1); // Quitter l'application si appstate n'est pas chargé
}

const port = config.port || 3000;

// Charger les commandes depuis le dossier cmds
const commandFiles = fs.readdirSync('./cmds').filter(file => file.endsWith('.js'));
const commands = {};
commandFiles.forEach(file => {
    const command = require(`./cmds/${file}`);
    commands[command.name] = command;
});

// Object pour suivre les commandes actives par utilisateur
let activeCommands = {};

login({ appState }, (err, api) => {
    if (err) return console.error("Erreur de connexion :", err);

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

        // Vérifier si l'utilisateur a une commande active
        if (activeCommands[senderId]) {
            const activeCommand = activeCommands[senderId];
            if (message.toLowerCase() === "stop") {
                // Désactiver la commande active pour l'utilisateur
                delete activeCommands[senderId];
                api.sendMessage(`La commande ${activeCommand} a été désactivée avec succès.`, event.threadID);
                return;
            } else if (commands[activeCommand]) {
                // Continuer la conversation avec la commande active
                return commands[activeCommand].execute(api, event, [message]);
            }
        }

        // Vérifier s'il s'agit d'une commande avec un préfixe
        if (message.startsWith(prefix)) {
            const args = message.slice(prefix.length).split(/ +/);
            const commandName = args.shift().toLowerCase();

            if (commands[commandName]) {
                if (commandName === "help") {
                    // La commande help n'a pas besoin d'une commande stop
                    return commands[commandName].execute(api, event, args);
                }

                // Définir une commande active pour l'utilisateur
                activeCommands[senderId] = commandName;

                // Exécuter la commande sélectionnée
                return commands[commandName].execute(api, event, args);
            } else {
                // Si la commande n'existe pas, utiliser l'API Gemini
                api.sendMessage("⏳ Veuillez patienter un instant pendant que Bruno traite votre demande...", event.threadID);
                axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                    prompt: message,
                    customId: senderId
                }).then(response => {
                    api.sendMessage(response.data.message, event.threadID);
                }).catch(err => console.error("Erreur API :", err));
            }
        }

        // Si le message contient des pièces jointes, les traiter avec l'API Gemini
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
            }).catch(err => console.error("Erreur OCR ou réponse :", err));
        } else if (!message.startsWith(prefix)) {
            // Si aucun préfixe, fallback à l'API Gemini
            api.sendMessage("⏳ Veuillez patienter un instant pendant que Bruno traite votre demande...", event.threadID);

            axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                prompt: message,
                customId: senderId
            }).then(response => {
                api.sendMessage(response.data.message, event.threadID);
            }).catch(err => console.error("Erreur API :", err));
        }
    }

    api.listenMqtt((err, event) => {
        if (err) return console.error("Erreur de connexion MQTT :", err);
        if (event.type === "message") handleMessage(event);
    });
});

app.get("/", (req, res) => {
    res.send("Bot is running");
});

app.listen(port, () => {
    console.log(`Le serveur fonctionne sur http://localhost:${port}`);
});
