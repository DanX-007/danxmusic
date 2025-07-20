const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    Collection,
    StringSelectMenuBuilder
} = require("discord.js");
const Discord = require('discord.js');
const { clientOptions } = require("../../../config");
const formatDuration = require("../../../utils/formatDuration");
const { guild } = require("../../../schemas/guild");
const axios = require('axios');
const playlist = require("../../../schemas/playlist");
const { find } = require("llyrics");
const config = require("../../../config");
const { logger } = require("../../../utils/logger");
const { parseTimeString } = require("../../../utils/parseTimeString");
const { getPremiumUsers } = require("../../../utils/premiumManager");

module.exports = async (client) => {
    client.riffy.on('trackStart', async (player, track) => {
        const createButton = (customId, emoji, style) =>
            new ButtonBuilder().setCustomId(customId).setEmoji(emoji).setStyle(style);

        const favoriteCooldown = new Collection();

        const getLoopButtonStyle = (loopMode) => {
            if (loopMode === "track") return ButtonStyle.Primary;
            if (loopMode === "queue") return ButtonStyle.Primary;
            return ButtonStyle.Secondary;
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

        // Save history
        if (!player.queue.previousTracks) player.queue.previousTracks = [];
        if (player.queue.current && !player.queue.previousTracks.includes(player.queue.current)) {
            player.queue.previousTracks.push(player.queue.current);
        }

        // Get user ID from player metadata
        const userId = track.info.requester.id; 
        const isDev = userId === "1373949053414670396";
        const premiumUsers = await getPremiumUsers();
        const isPremium = isDev || premiumUsers.includes(userId);
        const isStream = track.info?.isStream === true;

        // Check if song is already in favorites
        let isFavorite = false;
        try {
            const favoritePlaylist = await playlist.findOne({ 
                userId: userId,
                name: "Favorite"
            });
            if (favoritePlaylist) {
                isFavorite = favoritePlaylist.songs.some(s => s.url === track.info.uri);
            }
        } catch (error) {
            logger(error, "error");
        }

        // Create buttons with proper disabled states
        let bPause = createButton("pause", "1276835192295915623", ButtonStyle.Secondary)
            .setDisabled(isStream);
        const bReplay = createButton("replay", "1276835198893559961", ButtonStyle.Secondary)
            .setDisabled(!(isPremium || isDev) || isStream);
        const bPrevious = createButton("previous", "1276835196628635680", ButtonStyle.Secondary)
            .setDisabled(!(isPremium || isDev) || isStream || player.queue.previousTracks?.length === 0);
        const bSkip = createButton("skip", "1276835203146449031", ButtonStyle.Secondary)
            .setDisabled(player.queue.length === 0);
        const bVDown = createButton("voldown", "1276835205377949737", ButtonStyle.Secondary);
        const bStop = createButton("stop", "⏹️", ButtonStyle.Danger);
        const bVUp = createButton("volup", "1276835207345078293", ButtonStyle.Secondary);
        const bShuffle = createButton("shuffle", "1276835201028198450", ButtonStyle.Secondary)
            .setDisabled(!(isPremium || isDev) || isStream);
        let bLoop = createButton("loop", "1276835185849143367", getLoopButtonStyle(player.loop))
            .setDisabled(isStream);
        const bAddToPlaylist = createButton("addtoplaylist", "📜", ButtonStyle.Secondary)
            .setDisabled(isStream);
        const bLyrics = createButton("lyrics", "🎵", ButtonStyle.Secondary)
            .setDisabled(isStream);
        let bFavorite = createButton("favorite", "❤️", isFavorite ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setDisabled(isStream);

        // Action rows with proper button distribution
        const getActionRows = (pauseBtn, loopBtn, skipBtn, favBtn) => {
            return [
                new ActionRowBuilder().addComponents(bPrevious, pauseBtn, bReplay, skipBtn),
                new ActionRowBuilder().addComponents(bStop, bVDown, bVUp, favBtn),
                new ActionRowBuilder().addComponents(loopBtn, bShuffle, bAddToPlaylist, bLyrics)
            ];
        };

        const channel = client.channels.cache.get(player.textChannel);
        const titles = track.info.title.length > 20 ? track.info.title.substr(0, 20) + "..." : track.info.title;
        const authors = track.info.author.length > 20 ? track.info.author.substr(0, 20) + "..." : track.info.author;
        const trackDuration = track.info.isStream ? "LIVE" : formatDuration(track.info.length);
        const trackAuthor = track.info.author ? authors : "Unknown";
        const trackTitle = track.info.title ? titles : "Unknown";
        const trackThumbnail = await (track.info.thumbnail || client.user.displayAvatarURL());

        const getEmbed = (loopMode = player.loop, volume = player.volume, iconURL = "https://media.tenor.com/dGZNbBlShRIAAAAM/swag-kid.gif") => 
            new EmbedBuilder()
                .setAuthor({ name: `Now Playing`, iconURL: iconURL })
                .setColor(clientOptions.embedColor)
                .setTitle(trackTitle)
                .setThumbnail(trackThumbnail)
                .setURL(track.info.uri)
                .addFields(
                    { name: "Artist", value: `${trackAuthor}`, inline: true },
                    { name: "Duration", value: `\`${trackDuration}\``, inline: true },
                    { name: "Requester", value: `${track.info.requester}`, inline: true },	
                )
                .setFooter({ text: `Loop: ${loopMode.charAt(0).toUpperCase() + loopMode.slice(1)} • Queue: ${player.queue.length} song(s) • Volume: ${volume}%` });

        if (!channel) throw new Error("Channel is undefined or null. Please ensure the channel exists.");

        let buttonState = await guild.findOne({ guildId: player.guildId });

        if (!buttonState) {
            buttonState = new guild({ guildId: player.guildId, buttons: true });
            await buttonState.save();
        }

        let msg;
        if (!buttonState.buttons) {
            msg = await channel.send({ embeds: [getEmbed()] });
            client.user.setPresence({
        activities: [
            {
                name: `🎧 ${track.info.title} • ${track.info.author}`,
            type: Discord.ActivityType.Listening,
            url: track.info.uri
            }
        ],
        status: 'online'
    });
        } else {
            const actionRows = getActionRows(bPause, bLoop, bSkip, bFavorite);
            msg = await channel.send({ 
                embeds: [getEmbed()], 
                components: actionRows
            });
            client.user.setPresence({
        activities: [
            {
                name: `🎧 ${track.info.title} • ${track.info.author}`,
            type: Discord.ActivityType.Listening,
            url: track.info.uri
            }
        ],
        status: 'online'
    });
        }
        player.message = msg;

        const currentTrack = player.queue.current || player._currentTrack || track;
        let statusText = '';
        if (player.paused) {
            statusText = `Paused ${currentTrack.info?.title || currentTrack.title}`;
        } else if (player.radio) {
            statusText = `Playing ${player.radioName} radio`;
        } else if (currentTrack?.info?.title || currentTrack?.title) {
            const title = currentTrack.info?.title || currentTrack.title;
            const author = currentTrack.info?.author || currentTrack.author;
            statusText = `Playing ${title}${author ? ` by ${author}` : ''}`;
        } else {
            statusText = 'Playing music';
        }
        
        await updateVoiceStatus(statusText);

        const filter = (message) => {
            const botVoiceChannel = message.guild.members.me.voice.channel;
            const userVoiceChannel = message.member.voice.channel;
            
            if (botVoiceChannel && botVoiceChannel.id === userVoiceChannel?.id) {
                return true;    
            } else {
                if (!message.deferred && !message.replied) {
                    message.reply({
                        content: `\`❌\` | You must be in the same voice channel as me to use this button.`,
                        ephemeral: true,
                    });
                }
                return false;
            }
        };

        const collector = msg.createMessageComponentCollector({ filter, time: track.info.length * 15 });

        collector.on("collect", async (message) => {
            if (!player) {
                if (!message.deferred && !message.replied) {
                    await message.reply({ content: `\`❌\` | The player doesn't exist`, ephemeral: true });
                }
                return collector.stop();
            }

            let replyEmbed = new EmbedBuilder().setColor(clientOptions.embedColor);
            let ephemeralReply = true;
            let shouldUpdateMsg = false;
            let newRows = getActionRows(bPause, bLoop, bSkip, bFavorite);

            switch (message.customId) {
                case "loop":
                    if (player.loop === "none") {
                        await player.setLoop("track");
                    } else if (player.loop === "track") {
                        await player.setLoop("queue");
                    } else if (player.loop === "queue") {
                        await player.setLoop("none");
                    }
                    bLoop = createButton("loop", player.loop === "track" ? "1286677681882136576" : "1276835185849143367", getLoopButtonStyle(player.loop));
                    replyEmbed.setDescription(`\`✔️\` | Loop mode set to : \`${player.loop}\``);
                    newRows = getActionRows(bPause, bLoop, bSkip, bFavorite);
                    shouldUpdateMsg = true;
                    break;

                case "replay":
                    await player.seek(0);
                    replyEmbed.setDescription('\`✔️\` | The song has been replayed');
                    ephemeralReply = false;
                    break;

                case "stop":
                    if (player.currentTrack?.info?.isStream) {
                        player.currentTrack.info.isStream = false;
                    }
                    player.destroy();
                    if (player.message) await player.message.delete();
                    await updateVoiceStatus('Use /play to start playing music with me');
                    return;

                case "pause":
                    await player.pause(!player.paused);
                    bPause = createButton("pause", player.paused ? "1276835194636337152" : "1276835192295915623", player.paused ? ButtonStyle.Primary : ButtonStyle.Secondary);
                    newRows = getActionRows(bPause, bLoop, bSkip, bFavorite);
                    await message.deferUpdate();
                    await msg.edit({ components: newRows });
                    
                    const current = player.queue.current || player._currentTrack;
                    const currentTitle = current?.info?.title || current?.title || 'Unknown';
                    const currentAuthor = current?.info?.author || current?.author;
                    client.user.setPresence({
        activities: [
            {
                name: player.paused 
                    ? `⏸ Paused: ${track.info.title}`
                    : `🎧 ${track.info.title} • ${track.info.author}`,
                type: Discord.ActivityType.Listening,
                url: track.info.uri
            }
        ],
        status: 'online'
    });
                    await updateVoiceStatus(
                        player.paused 
                            ? `Paused ${currentTitle}` 
                            : `Playing ${currentTitle}${currentAuthor ? ` by ${currentAuthor}` : ''}`
                    );
                    
                    return;

                case "skip":
                    if (player.queue.size == 0) {
                        replyEmbed.setDescription(`\`❌\` | Queue is: \`Empty\``);
                    } else {
                        if (player.queue.current && player.queue.previousTracks) {
                            player.queue.previousTracks.push(player.queue.current);
                            console.log("menyimpan musik ke previous");
                        }
                        await player.stop();
                        ephemeralReply = false; 
                    }
                    break;
                 
                case "previous":
                    try {
                        if (!Array.isArray(player.queue.previousTracks)) {
                            player.queue.previousTracks = [];
                        }

                        if (player.queue.previousTracks.length === 0) {
                            replyEmbed.setDescription("`❌` | No previous tracks available");
                        } else {
                            const previousTrack = player.queue.previousTracks.pop();
                            player.queue.unshift(previousTrack);
                            await player.stop();
                            replyEmbed.setDescription(`\`⏮\` | Replaying previous track: **${previousTrack.info.title}**`);
                            ephemeralReply = false;
                        }
                    } catch (error) {
                        logger(error, "error");
                        replyEmbed.setDescription("`❌` | Failed to play previous track");
                    }
                    break;

                case "voldown":
                    if (player.volume <= 10) {
                        await player.setVolume(10);
                        replyEmbed.setDescription(`\`❌\` | Volume can't be lower than: \`10%\``);
                    } else {
                        await player.setVolume(player.volume - 10);
                        replyEmbed.setDescription(`\`✔️\` | Volume decreased to : \`${player.volume}%\``);
                        shouldUpdateMsg = true;
                    }
                    break;

                case "volup":
                    if (player.volume >= 150) {
                        await player.setVolume(150);
                        replyEmbed.setDescription(`\`❌\` | Volume can't be higher than: \`150%\``);
                    } else {
                        await player.setVolume(player.volume + 10);
                        replyEmbed.setDescription(`\`✔️\` | Volume increased to : \`${player.volume}%\``);
                        shouldUpdateMsg = true;
                    }
                    break;

                case "lyrics":
                    try {
                        if (!track) {
                            if (!message.deferred && !message.replied) {
                                return message.reply({
                                    embeds: [replyEmbed.setDescription("`❌` | No track is currently playing.")],
                                    ephemeral: true
                                });
                            }
                            return;
                        }

                        const query = `${track.info.title} ${track.info.author || ""}`;
                        if (!message.deferred && !message.replied) {
                            await message.deferReply({ ephemeral: true });
                        }

                        const lyricsData = await searchLyrics(query);

                        if (!lyricsData || !lyricsData.syncedLyrics) {
                            if (message.deferred || message.replied) {
                                return message.editReply({
                                    embeds: [replyEmbed.setDescription(`\`❌\` | Could not find synced lyrics for **${track.info.title}**.`)],
                                    ephemeral: true
                                });
                            }
                            return message.reply({
                                embeds: [replyEmbed.setDescription(`\`❌\` | Could not find synced lyrics for **${track.info.title}**.`)],
                                ephemeral: true
                            });
                        }

                        const lines = lyricsData.syncedLyrics
                            .split("\n")
                            .map((line) => {
                                const match = line.match(/(\d+:\d{2}\.\d+)\s*(.*)/);
                                if (match) {
                                    return { time: parseTimestamp(match[1]), text: cleanLyrics(match[2]) };
                                }
                                return null;
                            })
                            .filter((line) => line && line.text);

                        if (!lines.length) {
                            if (message.deferred || message.replied) {
                                return message.editReply({
                                    embeds: [replyEmbed.setDescription("\`❌\` | No valid lines found in synced lyrics.")],
                                    ephemeral: true
                                });
                            }
                            return message.reply({
                                embeds: [replyEmbed.setDescription("\`❌\` | No valid lines found in synced lyrics.")],
                                ephemeral: true
                            });
                        }

                        let currentIndex = 0;
                        let isActive = true;

                        const updateSync = async () => {
                            if (!isActive || !player || !player.current) return;

                            const currentTime = (typeof player.position === "number" ? player.position / 1000 : 0);
                            while (currentIndex < lines.length && lines[currentIndex].time <= currentTime) {
                                currentIndex++;
                            }

                            const halfWindow = 2;
                            const startIndex = Math.max(0, currentIndex - halfWindow);
                            const endIndex = Math.min(lines.length, currentIndex + halfWindow);
                            const visibleLines = lines.slice(startIndex, endIndex);

                            const lyricsDisplay = visibleLines
                                .map((line, i) => {
                                    const globalIndex = startIndex + i;
                                    return globalIndex === currentIndex ? `🎤 **${line.text}**` : `♫ ${line.text}`;
                                })
                                .join("\n");

                            const embed = new EmbedBuilder()
                                .setColor(clientOptions.embedColor || "Purple")
                                .setTitle(`🎵 ${lyricsData.title || track.info.title} - ${lyricsData.artist || track.info.author || "Unknown Artist"}`)
                                .setDescription(lyricsDisplay)
                                .setFooter({ text: `Syncing... Line ${currentIndex + 1}/${lines.length}` });

                            if (message.deferred || message.replied) {
                                await message.editReply({ embeds: [embed], components: [] });
                            } else {
                                await message.reply({ embeds: [embed], components: [], ephemeral: true });
                            }

                            if (isActive && currentIndex < lines.length) {
                                setTimeout(updateSync, 870);
                            }
                        };

                        updateSync();

                    } catch (err) {
                        logger(err, "error");
                        if (message.deferred || message.replied) {
                            await message.editReply({
                                embeds: [replyEmbed.setDescription("`❌` | An error occurred while loading lyrics.")],
                                ephemeral: true
                            });
                        } else {
                            await message.reply({
                                embeds: [replyEmbed.setDescription("`❌` | An error occurred while loading lyrics.")],
                                ephemeral: true
                            });
                        }
                    }
                    break;

                case "shuffle":
                    if (player.queue.length < 2) {
                        replyEmbed.setDescription("`❌` | Not enough songs in queue to shuffle (need at least 2)");
                    } else {
                        for (let i = player.queue.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [player.queue[i], player.queue[j]] = [player.queue[j], player.queue[i]];
                        }
                        replyEmbed.setDescription("`🔀` | Queue has been shuffled!");
                        ephemeralReply = false;
                    }
                    break;
                
                case "favorite":
    try {
        // Pastikan interaksi belum di-defer atau di-reply
        if (!message.deferred && !message.replied) {
            await message.deferReply({ ephemeral: true });
        }

        // Cooldown check
        if (favoriteCooldown.has(message.user.id)) {
            return await handleReply(message, {
                content: "⏳ | Please wait before favoriting again!",
                ephemeral: true
            });
        }

        // Set cooldown
        favoriteCooldown.set(message.user.id, true);
        setTimeout(() => favoriteCooldown.delete(message.user.id), 5000);
        
        // Validasi track info
        if (!track?.info?.uri) {
            return await handleReply(message, {
                content: "❌ | Invalid track information",
                ephemeral: true
            });
        }

        const song = {
            url: track.info.uri,
            title: track.info.title || "Unknown Title",
            artist: track.info.author || "Unknown Artist",
            time: track.info.length || 0,
            thumbnail: validURL(track.info.thumbnail) ? track.info.thumbnail : null
        };

        // Find or create favorite playlist
        let favoritePlaylist = await playlist.findOne({ 
            userId: message.user.id,
            name: "Favorite"
        });

        if (!favoritePlaylist) {
            favoritePlaylist = new playlist({
                userId: message.user.id,
                name: "Favorite",
                description: `${message.user.username}'s favorite songs`,
                isPrivate: true,
                songs: [],
                created: new Date().toISOString()
            });
            await favoritePlaylist.save();
        }

        // Check if song already exists
        const songExists = favoritePlaylist.songs.some(s => s.url === song.url);
        
        // Toggle favorite status
        if (songExists) {
            await playlist.updateOne(
                { _id: favoritePlaylist._id },
                { $pull: { songs: { url: song.url } } }
            );
            
            isFavorite = false;
            bFavorite = createButton("favorite", "❤️", ButtonStyle.Secondary)
                .setDisabled(isStream);
            
            await handleReply(message, {
                embeds: [new EmbedBuilder()
                    .setColor(clientOptions.embedColor)
                    .setDescription(`💔 **Removed from Favorites**\n[${song.title}](${song.url})`)
                    .setThumbnail(song.thumbnail || null)],
                ephemeral: true
            });
        } else {
            await playlist.updateOne(
                { _id: favoritePlaylist._id },
                { $push: { songs: song } }
            );
            
            isFavorite = true;
            bFavorite = createButton("favorite", "❤️", ButtonStyle.Danger)
                .setDisabled(isStream);

            await handleReply(message, {
                embeds: [new EmbedBuilder()
                    .setColor(clientOptions.embedColor)
                    .setDescription(`❤️ **Added to Favorites**\n[${song.title}](${song.url})`)
                    .setThumbnail(song.thumbnail || null)],
                ephemeral: true
            });
        }

        // Update message components
        newRows = getActionRows(bPause, bLoop, bSkip, bFavorite);
        if (msg.editable) {
            await msg.edit({ 
                components: newRows 
            });
        }

    } catch (error) {
        logger(error, "error");
        await handleReply(message, {
            content: "❌ | Failed to update favorites. Please try again later.",
            ephemeral: true
        });
    }
    break;

                case "addtoplaylist":
                    try {
                        if (!message.deferred && !message.replied) {
                            await message.deferReply({ ephemeral: true });
                        }

                        const song = {
                            url: track.info.uri,
                            title: track.info.title,
                            artist: track.info.author,
                            time: track.info.length,
                            thumbnail: track.info.thumbnail || null
                        };

                        const userPlaylists = await playlist.find({ userId: message.user.id });
                        if (!userPlaylists.length) {
                            if (message.deferred || message.replied) {
                                return message.editReply({ content: "❌ | You don't have any playlists." });
                            }
                            return message.reply({ content: "❌ | You don't have any playlists." });
                        }

                        const selectMenu = new StringSelectMenuBuilder()
                            .setCustomId('select_playlist_add')
                            .setPlaceholder('Select playlist')
                            .addOptions(userPlaylists.map(pl => ({
                                label: pl.name.length > 25 ? pl.name.substring(0, 22) + '...' : pl.name,
                                value: pl._id.toString(),
                                description: `${pl.songs.length} songs` || undefined
                            })));

                        const playlistEmbed = new EmbedBuilder()
                            .setColor(clientOptions.embedColor)
                            .setDescription(`**Select a playlist to add [${song.title}](${song.url})**`);

                        const reply = await (message.deferred || message.replied 
                            ? message.editReply({
                                embeds: [playlistEmbed],
                                components: [new ActionRowBuilder().addComponents(selectMenu)]
                            })
                            : message.reply({
                                embeds: [playlistEmbed],
                                components: [new ActionRowBuilder().addComponents(selectMenu)],
                                ephemeral: true
                            }));

                        const menuCollector = reply.createMessageComponentCollector({ 
                            filter: i => i.user.id === message.user.id, 
                            time: 60000 
                        });

                        menuCollector.on('collect', async i => {
                            try {
                                await i.deferUpdate();
                                
                                const selectedPlaylist = await playlist.findOne({ 
                                    _id: i.values[0], 
                                    userId: i.user.id 
                                });

                                if (!selectedPlaylist) {
                                    return i.followUp({ 
                                        content: "❌ | Playlist not found.",
                                        ephemeral: true 
                                    });
                                }

                                const songExists = selectedPlaylist.songs.some(s => s.url === song.url);
                                if (songExists) {
                                    return i.followUp({ 
                                        content: `❌ | This song is already in **${selectedPlaylist.name}**.`,
                                        ephemeral: true
                                    });
                                }

                                await playlist.updateOne(
                                    { _id: selectedPlaylist._id },
                                    { $push: { songs: song } }
                                );

                                const successEmbed = new EmbedBuilder()
                                    .setColor(clientOptions.embedColor)
                                    .setDescription(`✅ **Added to ${selectedPlaylist.name}**\n[${song.title}](${song.url})`);

                                await i.editReply({ 
                                    embeds: [successEmbed],
                                    components: [] 
                                });
                                
                                // If added to Favorite playlist, update favorite button
                                if (selectedPlaylist.name === "Favorite") {
                                    isFavorite = true;
                                    bFavorite = createButton("favorite", "❤️", ButtonStyle.Danger)
                                        .setDisabled(isStream);
                                    newRows = getActionRows(bPause, bLoop, bSkip, bFavorite);
                                    await msg.edit({ 
                                        embeds: [getEmbed(player.loop, player.volume)],
                                        components: newRows 
                                    });
                                }
                                
                            } catch (error) {
                                logger(error, "error");
                                await i.followUp({ 
                                    content: "❌ | An error occurred while adding to playlist.",
                                    ephemeral: true
                                });
                            }
                        });

                        menuCollector.on('end', () => {
                            try {
                                reply.edit({ 
                                    content: "⌛ | Playlist selection timed out.", 
                                    components: [] 
                                });
                            } catch (e) {
                                logger("Failed to edit expired playlist menu: " + e, "warn");
                            }
                        });

                    } catch (error) {
                        logger(error, "error");
                        if (message.deferred || message.replied) {
                            await message.editReply({ 
                                content: "❌ | An error occurred while processing your request."
                            });
                        } else {
                            await message.reply({ 
                                content: "❌ | An error occurred while processing your request.",
                                ephemeral: true
                            });
                        }
                    }
                    break;
            }

            if (message.customId !== "addtoplaylist") {
                if (message.deferred || message.replied) {
                    await message.editReply({ embeds: [replyEmbed] });
                } else {
                    await message.reply({ embeds: [replyEmbed], ephemeral: ephemeralReply });
                }
                
                if (shouldUpdateMsg) {
                    await msg.edit({ 
                        embeds: [getEmbed(player.loop, player.volume, trackThumbnail, "https://media1.tenor.com/m/9eqmLLJJwGcAAAAd/mood-dance.gif")], 
                        components: newRows 
                    });
                }
            }
        });
    });
};

function parseTimestamp(timestamp) {
    const match = timestamp.match(/(\d+):(\d{2})\.(\d+)/);
    if (!match) return 0;
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const milliseconds = parseInt(match[3], 10) / Math.pow(10, match[3].length);
    return minutes * 60 + seconds + milliseconds;
}

function cleanLyrics(lyrics) {
    if (!lyrics) return '';
    return lyrics.replace(/\]/g, '').trim();
}

async function searchLyrics(query) {
    try {
        const res = await axios.get("https://lrclib.net/api/search", {
            params: { q: query },
            timeout: 5000
        });
        const result = res.data[0];
        if (result) {
            return {
                title: result.trackName || result.name,
                artist: result.artistName || result.artist,
                lyrics: cleanLyrics(result.plainLyrics || result.lyrics),
                syncedLyrics: result.syncedLyrics
            };
        }
        return null;
    } catch (err) {
        logger(`Lyrics search error: ${err.message}`, "warn");
        return null;
    }
}

// Fungsi untuk validasi URL
function validURL(str) {
    try {
        new URL(str);
        return true;
    } catch (_) {
        return false;
    }
}

// Fungsi untuk handle reply yang aman
async function handleReply(interaction, options) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(options);
        }
        return await interaction.reply(options);
    } catch (err) {
        logger(`Failed to handle reply: ${err.message}`, "warn");
    }
}