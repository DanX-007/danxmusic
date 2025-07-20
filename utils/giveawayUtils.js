const { giveaway } = require('../schemas/guild');
const { EmbedBuilder } = require('discord.js');

/**
 * Ends a giveaway and picks winners
 * @param {Client} client - Discord client
 * @param {Object} gw - Giveaway object from database
 */
async function endGiveaway(client, gw) {
    if (!gw || !gw.channelId || !gw.messageId) {
        console.error('Invalid giveaway data provided');
        return;
    }

    const channel = client.channels.cache.get(gw.channelId);
    if (!channel) {
        console.error(`Channel ${gw.channelId} not found`);
        return;
    }

    try {
        const message = await channel.messages.fetch(gw.messageId);
        if (!message) {
            console.error(`Message ${gw.messageId} not found in channel ${gw.channelId}`);
            return;
        }
        await pickWinners(client, gw);
    } catch (error) {
        console.error('Error ending giveaway:', error);
    }
}

/**
 * Picks winners for a giveaway
 * @param {Client} client - Discord client
 * @param {Object} gw - Giveaway object from database
 * @param {boolean} [isReroll=false] - Whether this is a reroll
 */
async function pickWinners(client, gw, isReroll = false) {
    // Validate required fields
    if (!gw || !gw.channelId || !gw.messageId) {
        console.error('Invalid giveaway data provided for picking winners');
        return;
    }

    // Set default winner count if not provided
    if (!gw.winnerCount || isNaN(gw.winnerCount) || gw.winnerCount < 1) {
        gw.winnerCount = 1;
    }

    const channel = client.channels.cache.get(gw.channelId);
    if (!channel) {
        console.error(`Channel ${gw.channelId} not found for picking winners`);
        return;
    }

    try {
        const message = await channel.messages.fetch(gw.messageId);
        if (!message) {
            console.error(`Message ${gw.messageId} not found in channel ${gw.channelId}`);
            return;
        }

        // Filter valid participants (users still in the server)
        const validParticipants = gw.participants?.filter(id => 
            channel.guild.members.cache.has(id)
        ) || [];

        // Select winners
        const winners = [];
        const winnerCount = Math.min(gw.winnerCount, validParticipants.length);
        
        // Clone the array to avoid modifying the original
        const participantsPool = [...validParticipants];
        
        for (let i = 0; i < winnerCount; i++) {
            if (participantsPool.length === 0) break;
            const randomIndex = Math.floor(Math.random() * participantsPool.length);
            winners.push(participantsPool.splice(randomIndex, 1)[0]);
        }

        // Update database
        gw.ended = true;
        gw.winners = winners;
        gw.endTime = new Date();
        
        try {
            await gw.save();
        } catch (error) {
            console.error('Error saving giveaway:', error);
            throw error;
        }

        // Create result embed
        const resultEmbed = new EmbedBuilder()
            .setTitle(`🎉 ${gw.prize || 'Giveaway'} - Winners! 🎉`)
            .setDescription(
                winners.length > 0 
                    ? winners.map(id => `<@${id}>`).join(', ')
                    : 'No valid participants'
            )
            .setColor('#FFD700')
            .setFooter({ text: `Congrats to the winner${winners.length !== 1 ? 's' : ''}!` });

        // Send results
        await channel.send({ 
            content: winners.length > 0 
                ? '🎉 **Congratulations!** 🎉' 
                : 'No winners could be determined',
            embeds: [resultEmbed] 
        });

        // Update original giveaway message
        if (message.embeds.length > 0) {
            const embed = message.embeds[0];
            if (embed.data && embed.data.description) {
                embed.data.description = embed.data.description.replace(
                    'Click the button below to enter!',
                    '**GIVEAWAY ENDED**'
                );
            }

            await message.edit({ 
                embeds: [embed], 
                components: [] 
            });
        }

        // Announce winners if not a reroll
        if (!isReroll && winners.length > 0) {
            await message.reply({ 
                content: `🎉 **Winner${winners.length > 1 ? 's' : ''}:** ${winners.map(id => `<@${id}>`).join(' ')}`,
                allowedMentions: { users: winners }
            });
        }

    } catch (error) {
        console.error('Error in pickWinners:', error);
        throw error;
    }
}

/**
 * Checks for giveaways that should be ended
 * @param {Client} client - Discord client
 */
async function checkEndedGiveaways(client) {
    try {
        const now = new Date();
        const endedGiveaways = await giveaway.find({ 
            ended: false, 
            endTime: { $lte: now } 
        });

        for (const gw of endedGiveaways) {
            try {
                await endGiveaway(client, gw);
            } catch (error) {
                console.error(`Error ending giveaway ${gw._id}:`, error);
            }
        }
    } catch (error) {
        console.error('Error checking ended giveaways:', error);
    }
}

module.exports = {
    endGiveaway,
    pickWinners,
    checkEndedGiveaways
};