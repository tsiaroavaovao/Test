const axios = require('axios');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

module.exports = {
    name: 'photo',
    description: 'Recherche et envoie des images basées sur le texte saisi.',
    async execute(api, event, args) {
        const query = args.join(' ');

        if (!query) {
            api.sendMessage(`Veuillez entrer un terme de recherche.\nUsage: ${config.prefix}photo <recherche>`, event.threadID, event.messageID);
            return;
        }

        api.sendMessage("Recherche en cours...", event.threadID, event.messageID);

        try {
            const apiUrl = `https://recherche-photo.vercel.app/recherche?photo=${encodeURIComponent(query)}&page=1`;
            const response = await axios.get(apiUrl);
            const images = response.data.images;

            if (images && images.length > 0) {
                for (let i = 0; i < images.length; i++) {
                    const imageUrl = images[i];
                    
                    api.sendMessage({
                        attachment: {
                            type: 'image',
                            payload: {
                                url: imageUrl,
                                is_reusable: true
                            }
                        }
                    }, event.threadID, event.messageID);

                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                api.sendMessage("Toutes les images ont été envoyées.", event.threadID, event.messageID);
            } else {
                api.sendMessage("Aucune image trouvée pour votre recherche.", event.threadID, event.messageID);
            }
        } catch (error) {
            console.error("Erreur lors de la récupération des images:", error);
            api.sendMessage("Désolé, une erreur s'est produite lors du traitement de votre demande.", event.threadID, event.messageID);
        }
    }
};
