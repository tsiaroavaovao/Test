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
            // Appel à DeepSeek API pour la réponse à la question
            const deepseekResponse = await axios.get(`https://xnil.xnil.unaux.com/xnil/deepseek?text=${encodeURIComponent(question)}`);
            const aiAnswer = deepseekResponse.data.data && deepseekResponse.data.data.msg
                ? deepseekResponse.data.data.msg
                : "Une erreur s'est produite lors de la génération de la réponse.";

            // Appel à l'API date et heure
            const dateResponse = await axios.get('https://date-heure.vercel.app/date?heure=Madagascar');
            const { date_actuelle, heure_actuelle, localisation } = dateResponse.data;

            // Formatage du message
            const message = `
🤖 • 𝗕𝗿𝘂𝗻𝗼𝗖𝗵𝗮𝘁
━━━━━━━━━━━━━━
❓𝗬𝗼𝘂𝗿 𝗤𝘂𝗲𝘀𝘁𝗶𝗼𝗻: ${question}
━━━━━━━━━━━━━━
✅ 𝗔𝗻𝘀𝘄𝗲𝗿: ${aiAnswer}
━━━━━━━━━━━━━━
⏰ 𝗥𝗲𝘀𝗽𝗼𝗻𝘀𝗲: ${date_actuelle}, ${heure_actuelle} à ${localisation}

🇲🇬Lien Facebook de l'admin: ✅https://www.facebook.com/bruno.rakotomalala.7549
            `.trim();

            // Envoi du message formaté
            api.sendMessage(message, event.threadID, event.messageID);
        } catch (error) {
            console.error(error);
            api.sendMessage("Une erreur s'est produite lors du traitement de votre requête. Veuillez réessayer plus tard.", event.threadID, event.messageID);
        }
    }
};
