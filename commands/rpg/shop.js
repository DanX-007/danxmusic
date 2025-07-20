const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const items = require('../../data/items.json');
const { economy } = require('../../schemas/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Tampilkan daftar item dan fitur jual/beli')
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('Lihat daftar item')
            .addStringOption(option =>
                option.setName('category')
                    .setDescription('Filter berdasarkan kategori')
                    .addChoices(
                        { name: 'Weapon', value: 'weapon' },
                        { name: 'Armor', value: 'armor' },
                        { name: 'Consumable', value: 'item' }
                    )
            )
        )
        .addSubcommand(sub => sub
            .setName('buy')
            .setDescription('Beli item')
            .addStringOption(opt => opt.setName('id').setDescription('ID item').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('sell')
            .setDescription('Jual item')
            .addStringOption(opt => opt.setName('id').setDescription('ID item').setRequired(true))
        ),

    run: async ({ interaction }) => {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        
        // Only defer for view command which might take longer
        if (sub === 'view') {
            await interaction.deferReply({ ephemeral: true });
        }
        
        const userData = await economy.findOne({ userId });
        if (!userData) {
            return interaction.reply({ content: '❌ Kamu belum punya profil ekonomi!', ephemeral: true });
        }

        if (sub === 'buy') {
            const id = interaction.options.getString('id');
            const item = items.find(i => i.id === id);
            if (!item) return interaction.reply({ content: '❌ Item tidak ditemukan.', ephemeral: true });
            if (userData.balance < item.price) return interaction.reply({ content: '❌ Uang kamu tidak cukup.', ephemeral: true });

            // Convert inventory to Map if it's not already
            if (!(userData.inventory instanceof Map)) {
                userData.inventory = new Map(Object.entries(userData.inventory || {}));
            }

            const currentQty = userData.inventory.get(id) || 0;
            userData.inventory.set(id, currentQty + 1);
            userData.balance -= item.price;

            await economy.updateOne(
                { userId },
                { 
                    $set: { 
                        balance: userData.balance,
                        inventory: Object.fromEntries(userData.inventory)
                    } 
                }
            );

            return interaction.reply({ content: `✅ Kamu membeli **${item.name}** seharga ${item.price} koin.`, ephemeral: true });
        }

        if (sub === 'sell') {
            const id = interaction.options.getString('id');
            const item = items.find(i => i.id === id);
            if (!item || !item.sellPrice) return interaction.reply({ content: '❌ Item tidak bisa dijual.', ephemeral: true });

            // Convert inventory to Map if it's not already
            if (!(userData.inventory instanceof Map)) {
                userData.inventory = new Map(Object.entries(userData.inventory || {}));
            }

            const currentQty = userData.inventory.get(id) || 0;
            if (currentQty < 1) return interaction.reply({ content: '❌ Kamu tidak punya item ini.', ephemeral: true });

            userData.inventory.set(id, currentQty - 1);
            if (userData.inventory.get(id) <= 0) {
                userData.inventory.delete(id);
            }
            userData.balance += item.sellPrice;

            await economy.updateOne(
                { userId },
                { 
                    $set: { 
                        balance: userData.balance,
                        inventory: Object.fromEntries(userData.inventory)
                    } 
                }
            );

            return interaction.reply({ content: `✅ Kamu menjual **${item.name}** seharga ${item.sellPrice} koin.`, ephemeral: true });
        }

        if (sub === 'view') {
            const category = interaction.options.getString('category') || 'all';
            await showShopPagination(interaction, userData, category, 0);
        }
    },
    options: {
    verify: true
    }
};

async function showShopPagination(interaction, userData, category, page) {
    const pageSize = 10;
    const filteredItems = items.filter(item => {
        if (category === 'all') return item.price;
        if (category === 'items') return !['weapon', 'armor', 'item'].includes(item.type);
        return item.type === category;
    });

    const totalPages = Math.ceil(filteredItems.length / pageSize);
    const start = page * pageSize;
    const end = start + pageSize;
    const itemSlice = filteredItems.slice(start, end);

    const embed = new EmbedBuilder()
        .setTitle('🛒 Daftar Item Toko')
        .setColor('#00ff99')
        .setDescription(`Saldo kamu: **${userData.balance}** koin\nKategori: **${category}**\nHalaman ${page + 1}/${totalPages}`)
        .addFields(itemSlice.map(item => ({
            name: `${getRarityEmoji(item.rarity)} ${item.name} (${item.price} coins)`,
            value: `ID: \`${item.id}\`\nType: ${item.type}\n${renderStats(item.stats)}${item.description ? `\n📘 ${item.description}` : ''}`
        })));

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`shop_prev_${page}_${category}`)
            .setLabel('⬅️ Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`shop_next_${page}_${category}`)
            .setLabel('Next ➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages - 1)
    );

    const msg = interaction.deferred || interaction.replied
        ? await interaction.editReply({ embeds: [embed], components: [row] })
        : await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

    // Gunakan collector langsung di `msg`
    const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60_000
    });

    collector.on('collect', async i => {
        const [, direction, oldPageStr, ...categoryParts] = i.customId.split('_');
        const oldPage = parseInt(oldPageStr);
        const cat = categoryParts.join('_'); // jaga-jaga kalau kategori mengandung _
        let newPage = oldPage;

        if (direction === 'prev' && oldPage > 0) newPage--;
        if (direction === 'next' && oldPage < totalPages - 1) newPage++;

        await i.deferUpdate();
        await showShopPagination(i, userData, cat, newPage); // panggil ulang
    });

    collector.on('end', () => {
        msg.edit({ components: [] }).catch(() => {});
    });
}


function renderStats(stats = {}) {
    const lines = Object.entries(stats).map(([key, val]) => `➕ **${key}**: ${val}`);
    return lines.length > 0 ? lines.join('\n') + '\n' : '';
}

function getRarityEmoji(rarity) {
    const emojis = {
        common: '⚪',
        uncommon: '🟢',
        rare: '🔵',
        epic: '🟣',
        legendary: '🟡',
        mythic: '🟠'
    };
    return emojis[rarity?.toLowerCase()] || '⚪';
}