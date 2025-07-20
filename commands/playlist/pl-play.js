const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { logger } = require("../../utils/logger");
const config = require("../../config");
const playlist = require("../../schemas/playlist");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pl-play")
        .setDescription("Play a saved or public playlist")
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName("name")
            .setDescription("The name of the playlist")
            .setAutocomplete(true)
            .setRequired(true)
        ),

    run: async ({ interaction, client }) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);

        if (!interaction.guild.members.me.permissionsIn(interaction.channel).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
            return interaction.reply({ embeds: ["\`❌\` | Bot can't access the channel you're currently in. Please check the bot's permission on this server"], ephemeral: true });
        }
        if (!interaction.guild.members.me.permissionsIn(interaction.member.voice.channel.id).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])) {
            return interaction.reply({ embeds: ["\`❌\` | Bot can't connect to the voice channel you're currently in. Please check the bot's permission on this server"], ephemeral: true });
        }

        await interaction.deferReply();
        await interaction.editReply({embeds: [embed.setDescription("\`🔎\` | Loading Playlist...")]});

        const [playlistName, ownerId] = interaction.options.getString("name").split('|');
        
		let player = client.riffy.players.get(interaction.guildId);
        if (player && player.voiceChannel !== interaction.member.voice.channelId) {
            return interaction.editReply({ 
                embeds: [embed.setDescription("\`❌\` | You must be in the same voice channel as the bot.")], 
                ephemeral: true 
            });
        } else if (!player) {
			player = client.riffy.createConnection({
				defaultVolume: 100,
				guildId: interaction.guildId,
				voiceChannel: interaction.member.voice.channelId,
				textChannel: interaction.channelId,
				deaf: true
			});
		}

        const selectedPlaylist = await playlist.findOne({
            name: playlistName,
            userId: ownerId
        });

        if (!selectedPlaylist) {
            return interaction.editReply({ 
                embeds: [embed.setDescription("\`❌\` | Playlist not found.")] 
            });
        }

        // Check if playlist is private and user is not the owner
        if (selectedPlaylist.isPrivate && selectedPlaylist.userId !== interaction.user.id) {
            return interaction.editReply({ 
                embeds: [embed.setDescription("\`❌\` | This playlist is private!")] 
            });
        }

        for (const song of selectedPlaylist.songs) {
            const query = song.url ? song.url : song.name;
            const resolve = await client.riffy.resolve({ query: query, requester: interaction.member });
            if (!resolve || typeof resolve !== 'object') {
                throw new TypeError('Resolve response is not an object');
            }

            const { loadType, tracks } = resolve;
            if (loadType === 'track' || loadType === 'search') {
                const track = tracks.shift();
                track.info.requester = interaction.member;
                player.queue.add(track);
            } else {
                return interaction.editReply({ 
                    embeds: [embed.setDescription("\`❌\` | Error resolving song.")] 
                });
            }
        }

        const user = await interaction.client.users.fetch(selectedPlaylist.userId);
        await interaction.editReply({ 
            embeds: [embed.setDescription(
                `\`➕\` | Added playlist \`${selectedPlaylist.name}\` ${
                    selectedPlaylist.userId !== interaction.user.id 
                    ? `by ${user.username}` 
                    : ''
                } to the queue.`
            )] 
        });
        
        if (!player.playing && !player.paused) player.play();
    },

    options: {
		inVoice: true,
		premium: true,
	},

    autocomplete: async ({ interaction }) => {
        const focusedValue = interaction.options.getFocused();
        if (focusedValue.length <= 1) return;

        // Find both public playlists and user's playlists
        const playlists = await playlist.find({
            $or: [
                { isPrivate: false },             
                { userId: interaction.user.id }    
            ]
        });

        const filteredPlaylists = await Promise.all(playlists
            .filter(pl => pl.name.toLowerCase().includes(focusedValue.toLowerCase()))
            .map(async pl => {
                try {
                    const user = await interaction.client.users.fetch(pl.userId);
                    return {
                        name: `${pl.name} ${pl.isPrivate ? '🔒' : '🌐'} (by ${user.username})`,
                        value: `${pl.name}|${pl.userId}`
                    };
                } catch {
                    return {
                        name: `${pl.name} ${pl.isPrivate ? '🔒' : '🌐'} (by Unknown)`,
                        value: `${pl.name}|${pl.userId}`
                    };
                }
                        }));
            
                    await interaction.respond(filteredPlaylists.slice(0, 25));
                }
            };