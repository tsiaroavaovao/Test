const axios = require('axios');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

module.exports = {
    name: 'kai',
    description: 'Ask an AI question with Mistral API',
    async execute(api, event, args) {
        const question = args.join(' ');
        const uid = event.senderID; // Utilisation de l'ID de l'utilisateur pour le suivi de conversation

        if (!question) {
            api.sendMessage(`Veuillez entrer une question.\nUsage: ${config.prefix}ai <votre question>`, event.threadID, event.messageID);
            return;
        }

        api.sendMessage("Génération en cours...", event.threadID, event.messageID);

        try {
            const response = await axios.get(`https://api-mistral-hugging-face.vercel.app/mistralhugging?question=${encodeURIComponent(question)}&uid=${uid}`);
            
            if (response.data && response.data.length > 0) {
                const generatedText = response.data[0].generated_text;
                api.sendMessage(`🇲🇬BOT MADA🇲🇬\n\n${generatedText}`, event.threadID, event.messageID);
            } else {
                api.sendMessage("Erreur lors de la génération de la réponse. Veuillez réessayer plus tard.", event.threadID, event.messageID);
            }
        } catch (error) {
            api.sendMessage("Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer plus tard.", event.threadID, event.messageID);
        }
    }
};
