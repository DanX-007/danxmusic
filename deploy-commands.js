const { REST, Routes } = require('discord.js');
//const { clientId, devGuild, clientToken } = require('./config.js');
const config = require("./config");

const rest = new REST({ version: '10' }).setToken(config.clientOptions.clientToken);

// Untuk menghapus semua commands
async function deleteAllCommands() {
    try {
        console.log('Mulai menghapus semua slash commands...');

        // Hapus semua commands di guild tertentu
        await rest.put(
            Routes.applicationGuildCommands(config.clientOptions.clientId, config.clientOptions.devGuild),
            { body: [] },
        );

        console.log('Berhasil menghapus semua slash commands!');
    } catch (error) {
        console.error('Gagal menghapus slash commands:', error);
    }
}

// Untuk menghapus command tertentu
async function deleteCommand(commandId) {
    try {
        console.log(`Menghapus command dengan ID: ${commandId}...`);

        await rest.delete(
            Routes.applicationGuildCommand(config.clientOptions.clientId, config.clientOptions.devGuild, commandId)
        );

        console.log('Command berhasil dihapus!');
    } catch (error) {
        console.error('Gagal menghapus command:', error);
    }
}

// Pilih fungsi yang ingin dijalankan
deleteAllCommands(); // Hapus semua commands
// deleteCommand('command_id_here'); // Hapus command spesifik