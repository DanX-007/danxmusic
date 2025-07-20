const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require("discord.js");
const { logger } = require("../../utils/logger");
const config = require("../../config");

// Helper function to check URL patterns
function checkUrl(link) {
    const urlPatterns = {
        youtube: /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/,
        spotify: /^(?:https:\/\/open\.spotify\.com\/(?:user\/[A-Za-z0-9]+\/)?|spotify:)(album|playlist|track|artist)(?:[/:])([A-Za-z0-9]+).*$/,
        appleMusic: /(?:https:\/\/music\.apple\.com\/)(?:.+)?(artist|album|music-video|playlist)\/([\w\-\.]+(\/)+[\w\-\.]+|[^&]+)\/([\w\-\.]+(\/)+[\w\-\.]+|[^&]+)/,
        deezer: /^(?:https?:\/\/|)?(?:www\.)?deezer\.com\/(?:\w{2}\/)?(track|album|playlist|artist)\/(\d+)/,
        soundCloud: /^https?:\/\/(soundcloud\.com|snd\.sc)\/(.*)$/
    };

    for (const [key, pattern] of Object.entries(urlPatterns)) {
        const regex = new RegExp(pattern);
        if (regex.test(link)) {
            return { type: key, url: link };
        }
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("search")
        .setDescription("Search for tracks to play")
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName("query")
                .setDescription("The song name/url")
                .setAutocomplete(true)
                .setRequired(true)
        ),

    run: async ({ interaction, client }) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);

        // Check channel permissions
        if (!interaction.guild.members.me.permissionsIn(interaction.channel).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
            return interaction.reply({ 
                embeds: [embed.setDescription("\`❌\` | Bot can't access this channel. Please check the bot's permissions.")], 
                ephemeral: true 
            });
        }

        // Check voice channel permissions if user is in one
        if (interaction.member.voice.channel) {
            if (!interaction.guild.members.me.permissionsIn(interaction.member.voice.channel).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])) {
                return interaction.reply({ 
                    embeds: [embed.setDescription("\`❌\` | Bot can't connect to your voice channel. Please check the bot's permissions.")], 
                    ephemeral: true 
                });
            }
        }

        const query = interaction.options.getString("query");
        
        // Check if the query is a URL
        const urlCheck = checkUrl(query);
        if (urlCheck) {
            return interaction.reply({ 
                embeds: [embed.setDescription("\`ℹ️\` | Please use the `/play` command for direct URL playback.")], 
                ephemeral: true 
            });
        }

        await interaction.deferReply();
        await interaction.editReply({ embeds: [embed.setDescription("\`🔎\` | Searching...")] });

        // Search for tracks
        const resolve = await client.riffy.resolve({ query: query, requester: interaction.member });
        const { tracks } = resolve;

        if (!tracks || tracks.length === 0) {
            return interaction.editReply({ 
                embeds: [embed.setDescription("\`❌\` | No results found for your query.")] 
            });
        }

        // Create track selection menu
        const options = tracks.slice(0, 25).map((track, index) => ({
            label: track.info.title.length > 100 ? track.info.title.substring(0, 97) + "..." : track.info.title,
            description: `Duration: ${formatDuration(track.info.length)}`,
            value: index.toString()
        }));

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("track_select")
                .setPlaceholder("🎶 Select a track to play")
                .addOptions(options)
        );

        await interaction.editReply({ 
            embeds: [embed.setDescription(`Found **${tracks.length}** tracks for \`${query}\`\nPlease select a track to play:`)], 
            components: [selectMenu] 
        });

        // Track selection collector
        const collector = interaction.channel.createMessageComponentCollector({
            ComponentType: ComponentType.StringSelect,
            time: 30000,
            filter: i => i.user.id === interaction.user.id && i.customId === "track_select"
        });

        collector.on("collect", async (selectInteraction) => {
            // Double-check voice channel
            if (!selectInteraction.member.voice.channel) {
                return selectInteraction.reply({ 
                    embeds: [embed.setDescription("\`❌\` | You need to join a voice channel first!")], 
                    ephemeral: true 
                });
            }

            // Check if bot can join voice channel
            if (!interaction.guild.members.me.permissionsIn(selectInteraction.member.voice.channel).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])) {
                return selectInteraction.reply({ 
                    embeds: [embed.setDescription("\`❌\` | Bot can't connect to your voice channel. Please check the bot's permissions.")], 
                    ephemeral: true 
                });
            }

            const selectedIndex = parseInt(selectInteraction.values[0]);
            const selectedTrack = tracks[selectedIndex];
            
            // Create player and play the selected track
            let player = client.riffy.players.get(interaction.guildId);
            if (player && player.voiceChannel !== selectInteraction.member.voice.channelId) {
                return selectInteraction.reply({ 
                    embeds: [embed.setDescription("\`❌\` | You must be in the same voice channel as the bot.")], 
                    ephemeral: true 
                });
            } else if (!player) {
                player = client.riffy.createConnection({
                    defaultVolume: 100,
                    guildId: interaction.guildId,
                    voiceChannel: selectInteraction.member.voice.channelId,
                    textChannel: interaction.channelId,
                    deaf: true
                });
            }

            selectedTrack.info.requester = interaction.member;
            player.queue.add(selectedTrack);

            await selectInteraction.update({ 
                embeds: [embed.setDescription(
                    `\`➕\` | Added [${selectedTrack.info.title}](${selectedTrack.info.uri}) to the queue\n` +
                    `Requested by: ${interaction.member}`
                )], 
                components: [] 
            });

            if (!player.playing && !player.paused) player.play();
            collector.stop();
        });

        collector.on("end", () => {
            if (!interaction.message.editable) return;
            interaction.editReply({ components: [] }).catch(() => {});
        });
    },
    
    autocomplete: async ({ interaction, client }) => {
        const focusedValue = interaction.options.getFocused();
        if (focusedValue.length <= 1) return;

        const urlCheck = checkUrl(focusedValue);
        if (urlCheck) {
            return interaction.respond([{ 
                name: `${urlCheck.type.charAt(0).toUpperCase() + urlCheck.type.slice(1)} URL`, 
                value: urlCheck.url 
            }]);
        }

        let spotifyChoices = [];
        try {
            const spotifyResults = await client.spotify.searchTracks(focusedValue, { limit: 10 });
            spotifyChoices = spotifyResults.body.tracks.items.map(track => ({
                name: `${track.name} - ${track.artists.map(artist => artist.name).join(', ')}`,
                value: track.external_urls.spotify
            }));
        } catch (err) {
            logger(`Error fetching Spotify results: ${err}`);
        }

        return interaction.respond(spotifyChoices.slice(0, 10)).catch(() => {});
    }
};

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}