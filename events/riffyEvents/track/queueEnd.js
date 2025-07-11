const { parseTimeString } = require("../../../utils/parseTimeString");
const { EmbedBuilder } = require("discord.js");
const config = require("../../../config");
const axios = require('axios');

module.exports = async (client) => {
    client.riffy.on("queueEnd", async (player) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
        const channel = client.channels.cache.get(player.textChannel);
        
        if (player.message) {
            await player.message.delete().catch(() => {});
        }
        
        if (player.isAutoplay === true) {
            player.autoplay(player);
            await updateVoiceStatus(client, player.voiceChannel, 'Fetching related songs, please wait');
        } else {
            const is247 = await check247Status(player.guildId);
            const voiceChannelId = player.voiceChannel;
            
            await updateVoiceStatus(client, voiceChannelId, 'Music ended, use /play to start');
            
            if (!is247) {
                player.destroy();
            }
            
            const message = await channel.send({ 
                embeds: [embed.setDescription("The queue is empty. You can make the bot stays by using `247` command.")] 
            }).catch(() => null);
            
            if (message) {
                setTimeout(() => {
                    message.delete().catch(() => {});
                }, parseTimeString("30s"));
            }
        }
    });
};

const updateVoiceStatus = async (status) => {
            try {
                const voiceChannel = client.channels.cache.get(player.voiceChannel);
                if (!voiceChannel) return;

                await axios.put(
                    `https://discord.com/api/v10/channels/${player.voiceChannel}/voice-status`,
                    { status: status },
                    {
                        headers: {
                            'Authorization': `Bot ${client.token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
            } catch (error) {
                console.error('Failed to update voice status:', error.response?.data || error.message);
            }
        };

async function check247Status(guildId) {
    try {
        const guild = await client.db.get(`24_7_${guildId}`);
        return guild ? true : false;
    } catch (error) {
        return false;
    }
}