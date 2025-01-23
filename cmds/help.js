const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

module.exports = {
    name: 'help',
    description: 'List all available commands',
    execute(api, event, args) {
        const commandFiles = fs.readdirSync('./cmds').filter(file => file.endsWith('.js'));
        const commandsPerPage = 8;
        const totalPages = Math.ceil(commandFiles.length / commandsPerPage);
        
        let page = 1;
        if (args.length > 0 && !isNaN(args[0])) {
            page = Math.max(1, Math.min(parseInt(args[0]), totalPages));
        }

        let message = `✅Voici les commandes disponibles✅\n\n`;
        
        const start = (page - 1) * commandsPerPage;
        const end = start + commandsPerPage;
        
        commandFiles.slice(start, end).forEach((file, index) => {
            const command = require(`./${file}`);
            message += `${start + index + 1}- ${command.name}\n`;
            message += `\tDescription : ${command.description}\n\n`;
        });
        
        message += `Page ${page}/${totalPages}\n`;
        message += `Utilisez -help <numéro de page> pour naviguer.`;
        
        api.sendMessage(message, event.threadID);
    }
};
            
