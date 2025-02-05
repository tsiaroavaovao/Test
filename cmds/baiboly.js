const axios = require('axios');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

module.exports = {
    name: 'baiboly',
    description: 'Retrieve a Bible verse and translate it into Malagasy.',
    async execute(api, event, args) {
        try {
            if (!args[0]) {
                api.sendMessage(`Please provide a reference for the Bible verse (e.g., John 3:16).\nUsage: ${config.prefix}baiboly <book chapter:verse>`, event.threadID, event.messageID);
                return;
            }

            api.sendMessage("Fetching Bible verse...", event.threadID, event.messageID);
            
            const reference = encodeURIComponent(args.join(" "));
            const apiUrl = `https://bible-api.com/${reference}`;
            const response = await axios.get(apiUrl);

            if (response.data && response.data.verses) {
                const verseText = response.data.verses[0].text.trim();
                const referenceText = response.data.reference;
                
                const translationUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(verseText)}&langpair=en|mg`;
                const translationResponse = await axios.get(translationUrl);
                const translatedText = translationResponse.data.responseData.translatedText;

                const message = `🍟Baiboly Malagasy🍟\n\n🙏Verse👉: ${referenceText}\n❤️Text💕 : ${translatedText}\n\nCréé par 🎉Bruno ESPA🎉`;
                api.sendMessage(message, event.threadID, event.messageID);
            } else {
                api.sendMessage("Unable to get the verse from the Bible.", event.threadID, event.messageID);
            }
        } catch (error) {
            console.error('Error making Bible API request:', error.message);
            api.sendMessage("An error occurred while processing your request.", event.threadID, event.messageID);
        }
    }
};
