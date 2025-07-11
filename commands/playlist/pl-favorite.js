const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const { logger } = require("../../utils/logger");
const playlist = require("../../schemas/playlist");
const config = require('../../config');

function checkUrl(link) {
    const urlPatterns = {
        youtube: /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/gi,
        spotify: /^(?:https:\/\/open\.spotify\.com\/(?:user\/[A-Za-z0-9]+\/)?|spotify:)(album|playlist|track|artist)(?:[/:])([A-Za-z0-9]+).*$/gi,
        appleMusic: /(?:https:\/\/music\.apple\.com\/)(?:.+)?(artist|album|music-video|playlist)\/([\w\-\.]+(\/)+[\w\-\.]+|[^&]+)\/([\w\-\.]+(\/)+[\w\-\.]+|[^&]+)/gi,
        deezer: /^(?:https?:\/\/|)?(?:www\.)?deezer\.com\/(?:\w{2}\/)?(track|album|playlist|artist)\/(\d+)/gi,
        soundCloud: /^https?:\/\/(soundcloud\.com|snd\.sc)\/(.*)$/
    };

    for (const [key, pattern] of Object.entries(urlPatterns)) {
        if (pattern.test(link)) {
            return { type: key, url: link };
        }
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pl-favorite')
        .setDescription('Add a song to your favorite playlist')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Song name or URL to add to favorites')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    run: async ({ interaction, client }) => {
        const embed = new EmbedBuilder().setColor(config.clientOptions.embedColor);
        const query = interaction.options.getString('query');
        const userId = interaction.user.id;
        const userName = interaction.user.username;

        try {
            await interaction.deferReply();

            // Cari atau buat playlist "Favorite"
            let favoritePlaylist = await playlist.findOne({
                userId: userId,
                name: "Favorite"
            });

            const now = new Date();
            const formattedDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

            if (!favoritePlaylist) {
                favoritePlaylist = new playlist({
                    userId: userId,
                    name: "Favorite",
                    description: `${userName}'s favorite songs`,
                    songs: [],
                    isPrivate: true,
                    created: formattedDate,
                });
                await favoritePlaylist.save();
            }

            await interaction.editReply({ embeds: [embed.setDescription("\`🔎\` | Adding to favorites...")] });

            // Resolve track/link
            const resolve = await client.riffy.resolve({ query: query });
            const { loadType, tracks } = resolve;

            let addedSongs = [];

            // Proses berdasarkan tipe hasil
            if (loadType === "playlist") {
                for (const track of resolve.tracks) {
                    const song = {
                        url: track.info.uri,
                        title: track.info.title,
                        artist: track.info.author,
                        time: track.info.length,
                        thumbnail: track.info.thumbnail || null
                    };
                    if (!favoritePlaylist.songs.some(s => s.url === song.url)) {
                        favoritePlaylist.songs.push(song);
                        addedSongs.push(song);
                    }
                }
            } else if (loadType === "search" || loadType === "track") {
                const track = tracks[0];
                const song = {
                    url: track.info.uri,
                    title: track.info.title,
                    artist: track.info.author,
                    time: track.info.length
                };
                if (!favoritePlaylist.songs.some(s => s.url === song.url)) {
                    favoritePlaylist.songs.push(song);
                    addedSongs.push(song);
                }
            } else {
                return interaction.editReply({
                    embeds: [embed.setDescription("\`❌\` | Song not found or failed to load.")]
                });
            }

            // Simpan perubahan
            await favoritePlaylist.save();

            // Beri respons berdasarkan hasil
            if (addedSongs.length === 0) {
                return interaction.editReply({
                    embeds: [embed.setDescription("\`⚠️\` | All songs already exist in your favorites!")]
                });
            }

            const songList = addedSongs.slice(0, 5).map((song, i) =>
                `${i + 1}. [${song.title}](${song.url})`
            ).join('\n');

            const moreText = addedSongs.length > 5 ?
                `\n+ ${addedSongs.length - 5} more songs...` : '';

            embed.setDescription(
                `\`❤️\` | Added **${addedSongs.length} songs** to your favorites!\n${songList}${moreText}`
            );

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            logger(err, "error");
            await interaction.editReply({
                embeds: [embed.setDescription("\`❌\` | Failed to add to favorites. Please try again later.")]
            });
        }
    },

    autocomplete: async ({ interaction, client }) => {
    const focusedValue = interaction.options.getFocused();
    
    // Return early if input is too short (but respond with empty array)
    if (focusedValue.length <= 1) {
        return interaction.respond([]).catch(() => {});
    }

    // Check if input is URL
    const urlCheck = checkUrl(focusedValue);
    if (urlCheck) {
        return interaction.respond([{
            name: `${urlCheck.type.charAt(0).toUpperCase() + urlCheck.type.slice(1)} URL`,
            value: urlCheck.url
        }]).catch(() => {});
    }

    // Search Spotify
    let spotifyChoices = [];
    try {
        const spotifyResults = await client.spotify.searchTracks(focusedValue, { limit: 10 });
        spotifyChoices = spotifyResults.body.tracks.items.map(track => ({
            name: `${track.name} - ${track.artists.map(artist => artist.name).join(', ')}`,
            value: track.external_urls.spotify
        }));
    } catch (err) {
        logger(`Spotify search error: ${err.message}`);
    }

    // Always respond, even if empty, and catch any errors
    return interaction.respond(spotifyChoices.slice(0, 10)).catch(() => {});
}

};