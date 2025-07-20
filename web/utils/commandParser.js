const fs = require('fs');
const path = require('path');

module.exports = function parseCommands(commandsPath) {
    const categories = fs.readdirSync(commandsPath);
    const commands = [];

    categories.forEach(category => {
        const categoryPath = path.join(commandsPath, category);
        if(fs.statSync(categoryPath).isDirectory()) {
            const commandFiles = fs.readdirSync(categoryPath)
                .filter(file => file.endsWith('.js'));
            
            commandFiles.forEach(file => {
                const command = require(path.join(categoryPath, file));
                commands.push({
                    name: command.data.name,
                    description: command.data.description,
                    category: category,
                    permissions: command.data.default_member_permissions || 0
                });
            });
        }
    });

    return commands;
};