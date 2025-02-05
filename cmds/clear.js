const axios = require('axios');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

module.exports = {
    name: 'clear',
    description: 'Supprimer un certain nombre de messages envoyés par le bot.',
    async execute(api, event, args) {
        const { threadID, messageID, body } = event;
        const num = args[0];

        if (!num || isNaN(parseInt(num))) {
            api.sendMessage('Votre choix doit être un nombre.', threadID, messageID);
            return;
        }

        const botID = global.data && global.data.botID ? global.data.botID : api.getCurrentUserID();
        const botMessages = await api.getThreadHistory(threadID, parseInt(num));
        const botSentMessages = botMessages.filter(message => message.senderID === botID);

        if (botSentMessages.length === 0) {
            api.sendMessage(`Aucun message du bot trouvé dans l'intervalle de recherche.`, threadID, messageID);
            return;
        }

        api.sendMessage(`Trouvé ${botSentMessages.length} message(s) du bot. Suppression dans 30 secondes...`, threadID, messageID);

        setTimeout(async () => {
            for (const message of botSentMessages) {
                await api.unsendMessage(message.messageID);
            }
        }, 30000); // 30 secondes
    }
};
