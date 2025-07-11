module.exports = async (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;
    
    // Check if the bot was mentioned
    if (message.mentions.has(message.client.user)) {
        await message.reply({
            content: `:wave: Hey, ${message.author.username}! I'm here to help! Use \`/help\` to see my commands.`
        });
    }
};
