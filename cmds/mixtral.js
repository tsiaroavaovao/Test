const axios = require('axios');
const fs = require('fs');

// Charger la configuration
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

module.exports = {
    name: 'mixtral',
    description: 'Ask an AI question with Mixtral',
    
    async execute(api, event, args) {
        const question = args.join(' ');

        if (!question) {
            api.sendMessage(`❌ Veuillez entrer une question.\nUsage : ${config.prefix}mixtral <votre question>`, event.threadID, event.messageID);
            return;
        }

        api.sendMessage("⏳ Génération en cours...", event.threadID, event.messageID);

        try {
            const response = await axios.get(`https://api.zetsu.xyz/api/mixtral-8b?q=${encodeURIComponent(question)}`, {
                timeout: 10000 // Timeout de 10 secondes
            });

            if (response.data.success) {
                api.sendMessage(`✅🙏 Mixtral AI🙏✅\n\n${response.data.response}`, event.threadID, event.messageID);
            } else {
                api.sendMessage("⚠️ L'IA n'a pas pu répondre. Réessayez plus tard.", event.threadID, event.messageID);
            }
        } catch (error) {
            let errorMsg = "❌ Une erreur s'est produite. Veuillez réessayer plus tard.";
            
            if (error.response) {
                errorMsg += `\n🔹 Code erreur : ${error.response.status}`;
            } else if (error.code === 'ECONNABORTED') {
                errorMsg += "\n⏳ Temps d'attente dépassé.";
            }

            api.sendMessage(errorMsg, event.threadID, event.messageID);
        }
    }
};
