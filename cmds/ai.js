const axios = require('axios');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

module.exports = {
    name: 'ai',
    description: 'Pose une question à DeepSeek AI',
    async execute(api, event, args) {
        const question = args.join(' ');

        if (!question) {
            api.sendMessage(`Veuillez entrer une question.\nUtilisation : ${config.prefix}ai <votre question>`, event.threadID, event.messageID);
            return;
        }

        api.sendMessage("Génération en cours...", event.threadID, event.messageID);

        try {
            const response = await axios.get(`https://xnil.xnil.unaux.com/xnil/deepseek?text=${encodeURIComponent(question)}`);
            if (response.data.data && response.data.data.msg) {
                api.sendMessage(`✅🙏 DEEPSEEK CHAT 🙏✅\n\n${response.data.data.msg}`, event.threadID, event.messageID);
            } else {
                api.sendMessage("Une erreur s'est produite lors du traitement de votre requête. Veuillez réessayer plus tard.", event.threadID, event.messageID);
            }
        } catch (error) {
            api.sendMessage("Une erreur s'est produite lors du traitement de votre requête. Veuillez réessayer plus tard.", event.threadID, event.messageID);
        }
    }
};
