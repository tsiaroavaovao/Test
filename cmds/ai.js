const axios = require('axios');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

module.exports = {
    name: 'ai',
    description: 'Pose une question à l'IA avec Gemini API',
    async execute(api, event, args) {
        const uid = event.senderID;

        if (event.type === "message" && event.attachments.length > 0 && event.attachments[0].type === "photo") {
            // Gestion des images envoyées en attachement
            const imageUrl = event.attachments[0].url;
            
            api.sendMessage("Analyse de l'image en cours...", event.threadID, event.messageID);
            
            try {
                const ocrResponse = await axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                    link: imageUrl,
                    prompt: "Analyse du texte de l'image pour détection de mots-clés",
                    customId: uid
                });
                
                const ocrText = ocrResponse.data.message || "";
                const hasExerciseKeywords = /\d+\)|[a-c]\)/i.test(ocrText);
                const prompt = hasExerciseKeywords ? "Faire cet exercice et donner la correction complète de cet exercice" : "Décrire cette photo";
                
                const response = await axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                    link: imageUrl,
                    prompt,
                    customId: uid
                });
                
                api.sendMessage(`🇲🇬BOT MADA🇲🇬\n\n${response.data.message}`, event.threadID, event.messageID);
            } catch (error) {
                api.sendMessage("Une erreur est survenue lors de l'analyse de l'image.", event.threadID, event.messageID);
            }
            return;
        }
        
        // Gestion des requêtes textuelles
        const question = args.join(' ');
        if (!question) {
            api.sendMessage(`Veuillez entrer une question.\nUsage: ${config.prefix}ai <votre question>`, event.threadID, event.messageID);
            return;
        }

        api.sendMessage("Génération en cours...", event.threadID, event.messageID);

        try {
            const response = await axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
                prompt: question,
                customId: uid
            });
            
            api.sendMessage(`🇲🇬BOT MADA🇲🇬\n\n${response.data.message}`, event.threadID, event.messageID);
        } catch (error) {
            api.sendMessage("Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer plus tard.", event.threadID, event.messageID);
        }
    }
};
