const axios = require('axios');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

module.exports = {
    name: 'mixtral',
    description: 'Ask an AI question with Mixtral',
    async execute(api, event, args) {
        const question = args.join(' ');

        if (!question) {
            api.sendMessage(`Please enter a question.\nUsage: ${config.prefix}ai <your question>`, event.threadID, event.messageID);
            return;
        }

        api.sendMessage("📲💫 Patientez, la réponse arrive… 💫📲", event.threadID, event.messageID);

        try {
            const response = await axios.get(`https://api.zetsu.xyz/api/mixtral-8b?q=${encodeURIComponent(question)}`);
            if (response.data.status) {
                api.sendMessage(`✅🙏 Mixtral AI 🙏✅\n\n` + response.data.result, event.threadID, event.messageID);
            } else {
                api.sendMessage("There was an error processing your request. Please try again later.", event.threadID, event.messageID);
            }
        } catch (error) {
            api.sendMessage("There was an error processing your request. Please try again later.", event.threadID, event.messageID);
        }
    }
};
