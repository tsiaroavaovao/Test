const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

module.exports = {
    name: 'help',
    description: 'List all available commands with pagination',
    execute(api, event, args) {
        const commandFiles = fs.readdirSync('./cmds').filter(file => file.endsWith('.js'));
        const commandsPerPage = 5; // Nombre de commandes par page
        
        let page = parseInt(args[0]) || 1;
        let totalPages = Math.ceil(commandFiles.length / commandsPerPage);
        
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        
        let message = `C ° O ° M ° M ° A ° N ° D ° S (Page ${page}/${totalPages})\n\n`;
        
        const startIndex = (page - 1) * commandsPerPage;
        const endIndex = startIndex + commandsPerPage;
        
        commandFiles.slice(startIndex, endIndex).forEach(file => {
            const command = require(`./cmds/${file}`);
            message += `[~] ${command.name}\n[°°°] ${command.description}\n\n`;
        });
        
        message += `Utilisez "!help <numéro de page>" pour naviguer.`;
        
        api.sendMessage(message, event.threadID);
    }
};
