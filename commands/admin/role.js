const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { guild } = require('../../schemas/guild');
const { logAction } = require('../../utils/adminUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Role management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a role to a user')
        .addUserOption(option => 
          option.setName('user')
            .setDescription('User to add role to')
            .setRequired(true))
        .addRoleOption(option => 
          option.setName('role')
            .setDescription('Role to add')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a role from a user')
        .addUserOption(option => 
          option.setName('user')
            .setDescription('User to remove role from')
            .setRequired(true))
        .addRoleOption(option => 
          option.setName('role')
            .setDescription('Role to remove')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new role')
        .addStringOption(option => 
          option.setName('name')
            .setDescription('Role name')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('color')
            .setDescription('Hex color (e.g. #FF0000)'))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('autorole')
        .setDescription('Enable/disable auto role for new members')
        .addBooleanOption(option => 
          option.setName('state')
            .setDescription('Enable/disable auto role')
            .setRequired(true))
        .addRoleOption(option => 
          option.setName('role')
            .setDescription('Role to assign')
            .setRequired(false))
    ),
  options: { admin: true },
  run: async ({ interaction, client }) => {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'add': {
          const user = interaction.options.getUser('user');
          const role = interaction.options.getRole('role');
          
          const member = await interaction.guild.members.fetch(user.id);
          await member.roles.add(role);
          
          await interaction.reply(`✅ Added role ${role.name} to ${user.tag}`);
          await logAction(interaction.guild.id, `${interaction.user.tag} added role ${role.name} to ${user.tag}`);
          break;
        }
        
        case 'remove': {
          const user = interaction.options.getUser('user');
          const role = interaction.options.getRole('role');
          
          const member = await interaction.guild.members.fetch(user.id);
          await member.roles.remove(role);
          
          await interaction.reply(`✅ Removed role ${role.name} from ${user.tag}`);
          await logAction(interaction.guild.id, `${interaction.user.tag} removed role ${role.name} from ${user.tag}`);
          break;
        }
        
        case 'create': {
          const name = interaction.options.getString('name');
          const color = interaction.options.getString('color');
          
          const role = await interaction.guild.roles.create({
            name,
            color: color || undefined,
            reason: `Created by ${interaction.user.tag}`
          });
          
          await interaction.reply(`✅ Created role ${role.name}`);
          await logAction(interaction.guild.id, `${interaction.user.tag} created role ${role.name}`);
          break;
        }
        
        case 'autorole': {
          const state = interaction.options.getBoolean('state');
          const role = state ? interaction.options.getRole('role') : null;
          
          await guild.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { autoRole: state ? role?.id : null },
            { upsert: true }
          );
          
          await interaction.reply(`✅ Auto-role ${state ? 'enabled' : 'disabled'}`);
          break;
        }
      }
    } catch (error) {
      let errorMessage = `❌ Failed to execute ${subcommand} command: ${error.message}`;
      
      // More specific error messages for each subcommand
      switch (subcommand) {
        case 'add':
          errorMessage = `❌ Failed to add role: ${error.message}`;
          break;
        case 'remove':
          errorMessage = `❌ Failed to remove role: ${error.message}`;
          break;
        case 'create':
          errorMessage = `❌ Failed to create role: ${error.message}`;
          break;
        case 'autorole':
          errorMessage = `❌ Failed to ${interaction.options.getBoolean('state') ? 'enable' : 'disable'} auto-role: ${error.message}`;
          break;
      }
      
      await interaction.reply(errorMessage);
    }
  }
};