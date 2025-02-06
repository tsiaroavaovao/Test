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

// Object to track active Gemini sessions per user
let activeGeminiSessions = {};

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

        // Check if user has an active Gemini session
        if (activeGeminiSessions[senderId]) {
            const previousContext = activeGeminiSessions[senderId];
            if (message.toLowerCase() === "stop") {
                // End the Gemini session for the user
                delete activeGeminiSessions[senderId];
                api.sendMessage("Discussion avec Gemini terminée.", event.threadID);
                return;
            }

            // Continue the conversation with Gemini
            api.sendMessage("⏳ Continuation de la discussion en cours avec Gemini...", event.threadID);
            return axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                prompt: message,
                context: previousContext,
                customId: senderId
            }).then(response => {
                // Update the session context
                activeGeminiSessions[senderId] = response.data.context || previousContext;
                api.sendMessage(response.data.message, event.threadID);
            }).catch(err => console.error("API error:", err));
        }

        // If the message contains attachments, process with Gemini API
        if (attachments.length > 0 && attachments[0].type === 'photo') {
            api.sendMessage("⏳💫 Veuillez patienter pendant que Gemini analyse votre image...", event.threadID);

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
                // Save context for future discussions
                activeGeminiSessions[senderId] = response.data.context || null;
                api.sendMessage(response.data.message, event.threadID);
            }).catch(err => console.error("OCR/Response error:", err));
        } else if (!message.startsWith(prefix)) {
            // Handle general text with Gemini API
            api.sendMessage("⏳ Veuillez patienter pendant que Gemini traite votre demande...", event.threadID);

            axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                prompt: message,
                customId: senderId
            }).then(response => {
                // Save context for future discussions
                activeGeminiSessions[senderId] = response.data.context || null;
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
