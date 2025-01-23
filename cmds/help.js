const fs = require('fs');

module.exports = {
    name: 'help',
    description: 'List all available commands',
    execute(api, event, args) {
        const commandFiles = fs.readdirSync('./cmds').filter(file => file.endsWith('.js'));
        const commandsPerPage = 8; 
        let page = parseInt(args[0]) || 1; // Obtenir le numéro de page ou défaut à 1

        // Calcul du nombre total de pages
        const totalPages = Math.ceil(commandFiles.length / commandsPerPage);
        if (page < 1 || page > totalPages) {
            return api.sendMessage(`❌ Page invalide. Choisissez entre 1 et ${totalPages}.`, event.threadID);
        }

        let message = `✅Voici les commandes disponibles✅ (Page ${page}/${totalPages})\n\n`;

        // Extraire les commandes pour la page demandée
        const startIndex = (page - 1) * commandsPerPage;
        const endIndex = startIndex + commandsPerPage;
        const commandsToShow = commandFiles.slice(startIndex, endIndex);

        commandsToShow.forEach((file, index) => {
            const command = require(`./cmds/${file}`);
            message += `${startIndex + index + 1}- ${command.name}\n`;
            message += `   Description : ${command.description}\n\n`;
        });

        // Ajout des instructions pour naviguer entre les pages
        message += `Utilisez -help <numéro de page> pour voir d'autres commandes.`;

        api.sendMessage(message, event.threadID);
    }
};
