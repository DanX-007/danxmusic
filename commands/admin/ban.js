const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { guild } = require('../../schemas/guild'); // Changed to guild for clarity

// Fungsi konversi waktu ke milliseconds
function parseDuration(duration) {
    if (!duration) return null;
    const units = {
        s: 1000,
        m: 1000 * 60,
        h: 1000 * 60 * 60,
        d: 1000 * 60 * 60 * 24,
        w: 1000 * 60 * 60 * 24 * 7
    };
    const match = duration.match(/^(\d+)([smhdw])$/);
    return match ? match[1] * units[match[2]] : null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user (permanent or temporary)')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to ban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Ban duration (e.g. 1d, 2w) - leave empty for permanent')
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for ban')
        )
        .addBooleanOption(option =>
            option.setName('unban')
                .setDescription('Set to true to unban instead')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    options: { admin: true },
    run: async ({ interaction, client }) => {
        const target = interaction.options.getUser('user');
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const unban = interaction.options.getBoolean('unban') || false;

        // Validasi permission bot
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({
                content: '❌ I lack **Ban Members** permission',
                ephemeral: true
            });
        }

        // Validasi permission user
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({
                content: '❌ You lack **Ban Members** permission',
                ephemeral: true
            });
        }

        try {
            if (unban) {
                // Proses unban
                await interaction.guild.bans.remove(target.id, `Unbanned by ${interaction.user.tag} | Reason: ${reason}`);
                
                // Hapus dari database jika ada
                await guild.findOneAndUpdate(
                    { guildId: interaction.guild.id },
                    { $pull: { tempBans: { userId: target.id } } }
                );

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ User Unbanned')
                            .setDescription(`**${target.tag}** has been unbanned`)
                            .addFields(
                                { name: 'Reason', value: reason, inline: false }
                            )
                    ]
                });
            }

            // Validasi target
            const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
            
            if (targetMember) {
                if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                    return interaction.reply({
                        content: '❌ You cannot ban someone with equal/higher role than you',
                        ephemeral: true
                    });
                }

                if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.reply({
                        content: '❌ I cannot ban someone with equal/higher role than me',
                        ephemeral: true
                    });
                }
            }

            // Eksekusi ban
            await interaction.guild.members.ban(target.id, { reason });

            // Jika ada durasi, simpan ke database untuk auto-unban
            if (duration) {
                const durationMs = parseDuration(duration);
                if (!durationMs) {
                    return interaction.reply({
                        content: '❌ Invalid duration format. Use like 1d, 2h, 30m',
                        ephemeral: true
                    });
                }

                const unbanTime = new Date(Date.now() + durationMs);
                
                await guild.findOneAndUpdate(
                    { guildId: interaction.guild.id },
                    { 
                        $push: { 
                            tempBans: {
                                userId: target.id,
                                unbanTime,
                                moderatorId: interaction.user.id,
                                reason
                            }
                        } 
                    },
                    { upsert: true, new: true }
                );

                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('⏳ Temporary Ban')
                            .setDescription(`**${target.tag}** has been banned`)
                            .addFields(
                                { name: 'Duration', value: duration, inline: true },
                                { name: 'Reason', value: reason, inline: true },
                                { name: 'Will be unbanned', value: `<t:${Math.floor(unbanTime.getTime()/1000)}:R>`, inline: false }
                            )
                    ]
                });
            } else {
                // Ban permanen
                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('🔴 Permanent Ban')
                            .setDescription(`**${target.tag}** has been permanently banned`)
                            .addFields(
                                { name: 'Reason', value: reason, inline: false }
                            )
                    ]
                });
            }
        } catch (error) {
            console.error('Ban error:', error);
            await interaction.reply({
                content: `❌ Failed to ${unban ? 'unban' : 'ban'}: ${error.message}`,
                ephemeral: true
            });
        }
    },
    autocomplete: async ({ interaction }) => {  // Fixed parameter destructuring
        const focusedValue = interaction.options.getFocused();
        const choices = ['1h', '6h', '12h', '1d', '3d', '1w', '2w', '1m'];
        const filtered = choices.filter(choice => choice.startsWith(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    }
};