const axios = require('axios');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Objet pour stocker les questions et les réponses pour chaque utilisateur
const userQuizzes = {};

module.exports = {
    name: 'quiz',
    description: 'Poser une question de quiz aléatoire et vérifier la réponse.',
    async execute(api, event, args) {
        const senderId = event.senderID;
        const prompt = args.join(' ');

        try {
            if (userQuizzes[senderId]) {
                const userAnswer = prompt.trim();
                const correctAnswer = userQuizzes[senderId].correctAnswer;
                const shuffledAnswers = userQuizzes[senderId].shuffledAnswers;

                const userAnswerIndex = parseInt(userAnswer, 10) - 1;

                if (!isNaN(userAnswerIndex) && shuffledAnswers[userAnswerIndex] === correctAnswer) {
                    api.sendMessage("🎉 Réponse correcte !", event.threadID, event.messageID);
                } else {
                    api.sendMessage(`❌ Réponse incorrecte. La bonne réponse est : ${correctAnswer}.`, event.threadID, event.messageID);
                }
                return await askNewQuestion(api, event);
            }
            return await askNewQuestion(api, event);
        } catch (error) {
            console.error("Erreur lors de l'appel à l'API Open Trivia Database:", error);
            api.sendMessage("Désolé, une erreur s'est produite lors du traitement de votre message.", event.threadID, event.messageID);
        }
    }
};

async function askNewQuestion(api, event) {
    try {
        const apiUrl = 'https://opentdb.com/api.php?amount=1&type=multiple';
        const response = await axios.get(apiUrl);

        if (response.data.response_code === 0) {
            const quizData = response.data.results[0];
            const question = quizData.question;
            const correctAnswer = quizData.correct_answer;
            const incorrectAnswers = quizData.incorrect_answers;

            const allAnswers = [correctAnswer, ...incorrectAnswers];
            const shuffledAnswers = allAnswers.sort(() => Math.random() - 0.5);

            const translatedQuestion = await translateTextWithLimit(question, 'en', 'fr');
            const translatedAnswers = await Promise.all(shuffledAnswers.map(answer => translateTextWithLimit(answer, 'en', 'fr')));
            const translatedCorrectAnswer = await translateTextWithLimit(correctAnswer, 'en', 'fr');

            userQuizzes[event.senderID] = {
                question: translatedQuestion,
                correctAnswer: translatedCorrectAnswer,
                shuffledAnswers: translatedAnswers,
            };

            const formattedAnswers = translatedAnswers.map((answer, index) => `${index + 1}. ${answer}`).join('\n');

            await new Promise(resolve => setTimeout(resolve, 1000));

            api.sendMessage(`Voici votre question de quiz :\n${translatedQuestion}\n\nChoisissez une réponse :\n${formattedAnswers}`, event.threadID, event.messageID);
        } else {
            api.sendMessage("Désolé, une erreur s'est produite lors de la récupération du quiz.", event.threadID, event.messageID);
        }
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Open Trivia Database:", error);
        api.sendMessage("Désolé, une erreur s'est produite lors du traitement de votre message.", event.threadID, event.messageID);
    }
}

function splitTextIntoChunks(text, maxLength = 500) {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLength) {
        chunks.push(text.slice(i, i + maxLength));
    }
    return chunks;
}

async function translateTextWithLimit(text, fromLang, toLang) {
    const chunks = splitTextIntoChunks(text, 500);
    const translatedChunks = await Promise.all(chunks.map(async (chunk) => {
        const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${fromLang}|${toLang}`;
        const response = await axios.get(translateUrl);
        return response.data.responseData.translatedText;
    }));
    return translatedChunks.join(' ');
}
