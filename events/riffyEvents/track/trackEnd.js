// events/trackEnd.js
const { logger } = require("../../../utils/logger");
const Discord = require("discord.js");

module.exports = async (client) => {
  // Variabel untuk menyimpan interval rotasi presence
  let presenceInterval = null;

  // Fungsi untuk mengatur rotasi presence
  function startPresenceRotation(client) {
    // Hentikan interval sebelumnya jika ada
    if (presenceInterval) clearInterval(presenceInterval);

    const activities = [
      {
        name: `${client.guilds.cache.size} guilds connected`,
        type: Discord.ActivityType.Watching
      },
      {
        name: "🎵 Use /play to listen",
        type: Discord.ActivityType.Listening
      },
      {
        name: "🗡️ Type /setup to begin RPG",
        type: Discord.ActivityType.Playing
      },
      {
        name: "✨ Powered by DanX",
        type: Discord.ActivityType.Custom
      }
    ];

    let currentIndex = 0;

    // Fungsi untuk update presence
    const updatePresence = () => {
      client.user.setPresence({
        status: "idle",
        activities: [activities[currentIndex]]
      });
      currentIndex = (currentIndex + 1) % activities.length;
    };

    // Jalankan pertama kali
    updatePresence();
    
    // Set interval untuk rotasi setiap 15 detik
    presenceInterval = setInterval(updatePresence, 15000);
  }

  client.riffy.on("trackEnd", async (player, track) => {
    if (!player) return;

    try {
      // Simpan ke history
      if (!player.history) player.history = [];
      if (track && track.info) {
        player.history.push(track);
      }

      // Hapus pesan terakhir
      if (player.message) {
        await player.message.delete().catch(() => {});
      }

      // Jika antrian kosong, kembalikan status default dengan rotasi
      if (!player || player?.queue?.isEmpty()) {
        startPresenceRotation(client);
      }
    } catch (error) {
      logger.error(`Error in trackEnd event: ${error.message}`);
    }
  });

  // Jalankan rotasi presence saat pertama kali load
  startPresenceRotation(client);
};