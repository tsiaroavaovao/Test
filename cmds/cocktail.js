const axios = require('axios');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Fonction pour traduire du texte avec l'API MyMemory
async function translateText(text) {
    try {
        const response = await axios.get('https://api.mymemory.translated.net/get', {
            params: {
                q: text,
                langpair: 'en|fr'
            }
        });
        return response.data.responseData.translatedText;
    } catch (error) {
        console.error('Translation error:', error.message);
        return text;
    }
}

module.exports = {
    name: 'cocktail',
    description: 'Retrieve a random cocktail recipe and translate it into French.',
    async execute(api, event) {
        try {
            api.sendMessage("Fetching a random cocktail...", event.threadID, event.messageID);

            const apiUrl = 'https://www.thecocktaildb.com/api/json/v1/1/random.php';
            const response = await axios.get(apiUrl);

            if (response.data && response.data.drinks && response.data.drinks.length > 0) {
                const cocktail = response.data.drinks[0];
                const cocktailName = cocktail.strDrink;
                const ingredients = [];

                for (let i = 1; i <= 15; i++) {
                    const ingredient = cocktail[`strIngredient${i}`];
                    const measure = cocktail[`strMeasure${i}`];
                    if (ingredient) {
                        ingredients.push(`- ${ingredient} : ${measure || "à votre goût"}`);
                    }
                }

                const instructions = cocktail.strInstructions;
                const message = `🍸 **${cocktailName}** 🍸\n\n` +
                                `**Ingrédients :**\n${ingredients.join('\n')}\n\n` +
                                `**Préparation :**\n${instructions}`;

                const translatedMessage = await translateText(message);
                api.sendMessage(translatedMessage, event.threadID, event.messageID);
            } else {
                api.sendMessage("Impossible de récupérer un cocktail pour le moment.", event.threadID, event.messageID);
            }
        } catch (error) {
            console.error('Erreur lors de la récupération du cocktail:', error.message);
            api.sendMessage("Une erreur est survenue lors du traitement de votre demande.", event.threadID, event.messageID);
        }
    }
};
