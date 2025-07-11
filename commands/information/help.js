const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const ITEMS_PER_PAGE = 5;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Display information about all available commands")
        .setDMPermission(true)
        .addStringOption(option =>
            option.setName("category")
                .setDescription("Filter commands by category")
                .setRequired(false)
                .addChoices(
                    { name: '🎧 Music', value: 'music' },
                    { name: '🎛️ Filter', value: 'filter' },
                    { name: '🎵 Playlist', value: 'playlist' },
                    { name: '🗃️ Misc', value: 'misc' },
                    { name: 'ℹ️ Information', value: 'information' },
                    { name: '⚙️ Setting', value: 'setting' },
                    { name: '👨‍💻 Developer', value: 'developer' }
                )
        ),

    run: async ({ interaction, client }) => {
        await interaction.deferReply({ ephemeral: true });

        const categories = fs.readdirSync(path.join(__dirname, "../"))
            .filter(dir => !dir.includes("."));

        const state = {
            mode: interaction.options.getString("category") ? 'commands' : 'home',
            category: interaction.options.getString("category") || null,
            page: 1,
            totalPages: 1,
            themeColor: getRandomColor()
        };

        const { embed, components } = await buildResponse(client, categories, state);
        const message = await interaction.editReply({ embeds: [embed], components });
        createCollector(message, interaction, categories, state);
    }
};

function getRandomColor() {
    const rand = () => Math.floor((Math.random() * 127) + 127);
    return ((rand() << 16) | (rand() << 8) | rand());
}

async function buildResponse(client, categories, state) {
    state.totalPages = await countPages(categories, state);
    return state.mode === 'home'
        ? buildHomeEmbed(client, categories, state)
        : buildCommandsEmbed(client, categories, state);
}

async function countPages(categories, state) {
    if (state.mode === 'home') return 1;
    const files = fs.readdirSync(path.join(__dirname, "../", state.category))
        .filter(f => f.endsWith('.js'));
    return Math.ceil(files.length / ITEMS_PER_PAGE);
}

function buildHomeEmbed(client, categories, state) {
    const embed = new EmbedBuilder()
        .setTitle(`🎨 ${client.user.username} Help Center`)
        .setDescription('Use the select menu below to choose a category.')
        .setColor(state.themeColor)
        .setFooter({ text: 'Navigate with flair! © DanX', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    categories.forEach(cat => {
        const count = fs.readdirSync(path.join(__dirname, '../', cat))
            .filter(f => f.endsWith('.js')).length;
        embed.addFields({ name: `• ${capitalize(cat)}`, value: `\`${count} commands\``, inline: true });
    });

    const components = buildActionRows(categories, state);
    return { embed, components };
}

function buildCommandsEmbed(client, categories, state) {
    const allFiles = fs.readdirSync(path.join(__dirname, '../', state.category))
        .filter(f => f.endsWith('.js'));
    const start = (state.page - 1) * ITEMS_PER_PAGE;
    const pageItems = allFiles.slice(start, start + ITEMS_PER_PAGE)
        .map(f => require(`../${state.category}/${f}`));

    const embed = new EmbedBuilder()
        .setTitle(`📑 ${capitalize(state.category)} Commands`)
        .setColor(state.themeColor)
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: `Page ${state.page}/${state.totalPages} • © DanX` })
        .setTimestamp();

    pageItems.forEach(cmd => {
        embed.addFields({ name: `**/${cmd.data.name}**`, value: cmd.data.description, inline: false });
    });

    const components = buildActionRows(categories, state);
    return { embed, components };
}

function buildActionRows(categories, state) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('help_select')
        .setPlaceholder('Choose a category')
        .addOptions([
            { label: '🏠 Home', value: 'home' },
            ...categories.map(cat => ({
                label: getCategoryLabel(cat),
                value: cat,
                emoji: getCategoryEmoji(cat)
            }))
        ]);

    const rows = [ new ActionRowBuilder().addComponents(menu) ];

    if (state.mode === 'commands') {
        const btns = [
            { id: 'first', emoji: '⏮️' },
            { id: 'prev', emoji: '⬅️' },
            { id: 'next', emoji: '➡️' },
            { id: 'last', emoji: '⏭️' }
        ].map(btn => new ButtonBuilder()
            .setCustomId(`help_${btn.id}`)
            .setEmoji(btn.emoji)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(isDisabled(btn.id, state)));

        rows.push(new ActionRowBuilder().addComponents(btns));
    }

    return rows;
}

function getCategoryLabel(category) {
    const labels = {
        music: '🧬 Music',
        filter: '🎛️ Filter',
        playlist: '🎵 Playlist',
        misc: '🗃️ Misc',
        information: 'ℹ️ Information',
        setting: '⚙️ Setting',
        developer: '👨‍💻 Developer'
    };
    return labels[category] || capitalize(category);
}

function getCategoryEmoji(category) {
    const emojis = {
        music: '🧬',
        filter: '🎛️',
        misc: '🗃️',
        playlist: '🎵',
        information: 'ℹ️',
        setting: '⚙️',
        developer: '👨‍💻'
    };
    return emojis[category] || '📂';
}

function isDisabled(action, state) {
    if (action === 'first' || action === 'prev') return state.page === 1;
    if (action === 'next' || action === 'last') return state.page === state.totalPages;
    return false;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function createCollector(message, interaction, categories, state) {
    const collector = message.createMessageComponentCollector({ time: 3 * 60_000 });

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: 'Not your interaction!', ephemeral: true });
        }
        await i.deferUpdate();

        if (i.customId === 'help_select') {
            const sel = i.values[0];
            state.mode = sel === 'home' ? 'home' : 'commands';
            state.category = sel === 'home' ? null : sel;
            state.page = 1;
            state.themeColor = getRandomColor();
        } else {
            const act = i.customId.split('_')[1];
            switch (act) {
                case 'first': state.page = 1; break;
                case 'prev': state.page = Math.max(1, state.page - 1); break;
                case 'next': state.page = Math.min(state.totalPages, state.page + 1); break;
                case 'last': state.page = state.totalPages; break;
            }
            state.themeColor = getRandomColor();
        }

        const { embed, components } = await buildResponse(interaction.client, categories, state);
        await i.editReply({ embeds: [embed], components });
    });

    collector.on('end', () => {
        message.edit({ components: [] }).catch(() => {});
    });
}
