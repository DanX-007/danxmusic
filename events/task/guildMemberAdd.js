const { guild } = require('../../schemas/guild');

module.exports = {
    name: 'guildMemberAdd',
    run: async (member, client) => {
        try {
            const guildData = await guild.findOne({ guildId: member.guild.id });
            if (!guildData) return;

            // Berikan role jika ada
            if (guildData.welcomeRole) {
                await member.roles.add(guildData.welcomeRole).catch(console.error);
            }

            // Kirim welcome message jika channel ada
            if (guildData.welcomeChannel) {
                const channel = member.guild.channels.cache.get(guildData.welcomeChannel);
                if (channel) {
                    const welcomeMessage = guildData.welcomeMessage
                        .replace(/{user}/g, member.toString())
                        .replace(/{server}/g, member.guild.name);

                    await channel.send(welcomeMessage);
                }
            }
        } catch (error) {
            console.error('Welcome system error:', error);
        }
    }
};