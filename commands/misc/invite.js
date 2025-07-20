const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { logger } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Get bot invite link'),

    options: {
        premium: false, // Premium-only command
    },

    run: async ({ interaction }) => {
        try {
            const inviteEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('🎉 Invite Me To Your Server!')
                .setDescription(`Thank you for wanting to invite me!`)
                .addFields(
                    {
                        name: 'Invite Link',
                        value: `[Click Here](https://discord.com/oauth2/authorize?client_id=1389825959581978704&permissions=8&scope=bot%20applications.commands)`,
                        inline: true
                    },
                    {
                        name: 'Support Server',
                        value: '[Join Here](https://discord.gg/1373950883330789416)',
                        inline: true
                    }
                )
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .setFooter({ 
                    text: `Requested by ${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                });

            await interaction.reply({ 
                embeds: [inviteEmbed],
                ephemeral: true 
            });

        } catch (error) {
            logger(`Invite Command Error: ${error.message}`, 'error');
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('❌ Invite Failed')
                .setDescription('An error occurred while generating the invite link');
                
            await interaction.reply({ 
                embeds: [errorEmbed],
                ephemeral: true 
            });
        }
    }
};
