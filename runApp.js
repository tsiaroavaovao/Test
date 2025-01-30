const fs = require("fs");
const login = require("ws3-fca");
const express = require("express");
const app = express();

// Charger la configuration
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// Charger l'appstate pour la connexion
let appState = null;
try {
    appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));
} catch (error) {
    console.error("Erreur lors du chargement de appstate.json", error);
}

const port = config.port || 3000;  // Utilisation du port configuré ou défaut à 3000

// Charger les commandes depuis le dossier cmds
const commandFiles = fs.readdirSync('./cmds').filter(file => file.endsWith('.js'));
const commands = {};
commandFiles.forEach(file => {
    const command = require(`./cmds/${file}`);
    commands[command.name] = command;
});

console.log("\n===== COMMANDES CHARGÉES =====");
commandFiles.forEach(file => console.log(`[~] ${file.replace('.js', '')}`));
console.log("================================\n");

// Vérifier la méthode de connexion
let loginCredentials;
if (appState && appState.length !== 0) {
    loginCredentials = { appState: appState };
} else {
    console.error("Aucune méthode de connexion valide trouvée.");
    process.exit(1);
}

// Variable pour suivre la commande active
let activeCommand = null;

login(loginCredentials, (err, api) => {
    if (err) return console.error("Erreur de connexion :", err);

    // Options du bot
    api.setOptions({
        forceLogin: true,
        listenEvents: true,
        logLevel: "silent",
        updatePresence: true,
        bypassRegion: "PNB",
        selfListen: false,
        userAgent: "Mozilla/5.0",
        online: true,
        autoMarkDelivery: true,
        autoMarkRead: true
    });

    console.log("[Bot] Connecté avec succès.");

    // Mise à jour de la bio du bot
    function updateBotBio(api) {
        const bio = `Prefix: ${config.prefix}\nOwner: ${config.botOwner}`;
        api.changeBio(bio, (err) => {
            if (err) console.error("Erreur mise à jour de la bio :", err);
            else console.log("Bio mise à jour avec succès.");
        });
    }
    updateBotBio(api);

    // Fonction pour gérer les commandes
    function handleCommand(event) {
        const prefix = config.prefix;
        const message = event.body.trim().toLowerCase();
        const threadID = event.threadID;
        const args = message.split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Vérifie si l'utilisateur envoie "stop"
        if (message === "stop") {
            activeCommand = null;
            api.sendMessage("🔴 Tous les commandes sont désactivées.", threadID);
            return;
        }

        // Si une commande est active, elle répond en continu
        if (activeCommand && commands[activeCommand]) {
            commands[activeCommand].execute(api, event, args);
            return;
        }

        // Si le message contient une commande valide, elle devient active
        if (commands[commandName]) {
            activeCommand = commandName;
            commands[commandName].execute(api, event, args);
            return;
        }

        // Si aucune commande spécifique n'est active, utiliser la commande "ai"
        if (commands["ai"]) {
            commands["ai"].execute(api, event, args);
        }
    }

    // Écoute des messages entrants
    api.listenMqtt((err, event) => {
        if (err) return console.error("Erreur d'écoute :", err);

        console.log("Message reçu :", event.body); // Log pour le debug

        if (event.type === "message") {
            handleCommand(event);
        }
    });
});

// Gestion des erreurs globales
process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejet non géré à :', promise, 'raison :', reason);
});

// Serveur Express pour indiquer que le bot est en ligne
app.get("/", (req, res) => {
    res.send("Bot en cours d'exécution");
});

app.listen(port, () => {
    console.log(`Serveur en ligne sur http://localhost:${port}`);
});
    
