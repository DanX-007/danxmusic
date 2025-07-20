const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { format, differenceInCalendarDays, addYears, parse, isBefore } = require('date-fns');
const { id: localeId } = require('date-fns/locale/id');
const { birthday } = require('../../schemas/birthday');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Kelola data ulang tahun')
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set ulang tahun kamu')
        .addStringOption(option =>
          option.setName('tanggal')
            .setDescription('Format: DD-MM-YYYY (contoh: 15-04-1990)')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('check')
        .setDescription('Cek ulang tahun member')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Pilih member')
            .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lihat daftar ulang tahun server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Hapus data ulang tahun kamu')
    ),

  run: async ({ interaction }) => {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'set': {
          const dateString = interaction.options.getString('tanggal');
          const parsedDate = parse(dateString, 'dd-MM-yyyy', new Date());

          if (isNaN(parsedDate.getTime())) {
            return interaction.reply({ 
              content: '❌ Format tanggal invalid! Contoh: `15-04-1990`', 
              ephemeral: true 
            });
          }

          if (isBefore(new Date(), parsedDate)) {
            return interaction.reply({ 
              content: '❌ Tanggal tidak boleh di masa depan!', 
              ephemeral: true 
            });
          }

          const existing = await birthday.findOne({ userId: interaction.user.id });
          if (existing) {
            return interaction.reply({
              content: `⚠️ Kamu sudah punya ulang tahun terdaftar (${format(existing.birthday, 'dd MMMM yyyy', { locale: localeId })})`,
              ephemeral: true
            });
          }

          await birthday.create({
            userId: interaction.user.id,
            username: interaction.user.username,
            birthday: parsedDate
          });

          await interaction.reply({
            content: `🎉 Berhasil set ulang tahun: ${format(parsedDate, 'dd MMMM yyyy', { locale: localeId })}`,
            ephemeral: true
          });
          break;
        }

        case 'check': {
          const user = interaction.options.getUser('user') || interaction.user;
          const data = await birthday.findOne({ userId: user.id });

          if (!data) {
            return interaction.reply({ 
              content: user.id === interaction.user.id 
                ? '❌ Kamu belum set ulang tahun!' 
                : `❌ ${user.username} belum set ulang tahun`,
              ephemeral: true 
            });
          }

          const nextBday = addYears(
            new Date(new Date().getFullYear(), data.birthday.getMonth(), data.birthday.getDate()),
            new Date() > new Date(new Date().getFullYear(), data.birthday.getMonth(), data.birthday.getDate()) ? 1 : 0
          );

          const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle(`🎂 Ulang Tahun ${user.username}`)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
              { name: 'Tanggal', value: format(data.birthday, 'dd MMMM yyyy', { locale: localeId }) },
              { name: 'Hari Lagi', value: differenceInCalendarDays(nextBday, new Date()).toString() }
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'list': {
          const birthdays = await birthday.find().sort({ birthday: 1 });

          if (birthdays.length === 0) {
            return interaction.reply({ 
              content: '❌ Belum ada ulang tahun terdaftar!', 
              ephemeral: true 
            });
          }

          const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('🎂 Daftar Ulang Tahun')
            .setDescription(
              birthdays.map(b => {
                const nextBday = addYears(
                  new Date(new Date().getFullYear(), b.birthday.getMonth(), b.birthday.getDate()),
                  new Date() > new Date(new Date().getFullYear(), b.birthday.getMonth(), b.birthday.getDate()) ? 1 : 0
                );
                return `**${b.username}**: ${format(b.birthday, 'dd MMMM', { locale: localeId })} (${differenceInCalendarDays(nextBday, new Date())} hari lagi)`;
              }).join('\n')
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'delete': {
          const result = await birthday.deleteOne({ userId: interaction.user.id });
          
          await interaction.reply({
            content: result.deletedCount > 0 
              ? '✅ Data ulang tahun berhasil dihapus!' 
              : '❌ Tidak ada data yang bisa dihapus',
            ephemeral: true
          });
          break;
        }
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({ 
        content: `❌ Terjadi error saat menjalankan command: ${error.message}`,
        ephemeral: true 
      });
    }
  }
};