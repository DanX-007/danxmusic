const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fetch = require("node-fetch");
const { stripIndents } = require("common-tags");

const EMBED_COLORS = {
  GITHUB: 0x6e5494,
  ERROR: 0xff0000
};

async function fetchGithubUser(username, requester) {
  const response = await fetch(`https://api.github.com/users/${username}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`GitHub user '${username}' not found`);
    }
    throw new Error(`API request failed with status ${response.status}`);
  }

  const data = await response.json();
  
  let website = "Not Provided";
  if (data.blog) {
    website = data.blog.startsWith("http") 
      ? `[Visit Site](${data.blog})` 
      : data.blog;
  }

  return new EmbedBuilder()
    .setAuthor({
      name: `GitHub: ${data.login}`,
      url: data.html_url,
      iconURL: data.avatar_url
    })
    .setColor(EMBED_COLORS.GITHUB)
    .setDescription(data.bio || "No bio provided")
    .setThumbnail(data.avatar_url)
    .addFields(
      {
        name: "User Information",
        value: stripIndents`
        **Name**: ${data.name || "Not provided"}
        **Location**: ${data.location || "Not provided"}
        **GitHub ID**: ${data.id}
        **Website**: ${website}
        `,
        inline: true
      },
      {
        name: "Statistics",
        value: stripIndents`
        **Followers**: ${data.followers}
        **Following**: ${data.following}
        **Public Repos**: ${data.public_repos}
        **Public Gists**: ${data.public_gists}
        `,
        inline: true
      }
    )
    .setFooter({ 
      text: `Requested by ${requester.username}`,
      iconURL: requester.displayAvatarURL() 
    });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("github")
    .setDescription("Show GitHub statistics of a user")
    .addStringOption(option =>
      option
        .setName("username")
        .setDescription("GitHub username to lookup")
        .setRequired(true)
    ),
  cooldown: 10,
  run: async ({ interaction }) => {
    await interaction.deferReply();
    const username = interaction.options.getString("username");

    try {
      const embed = await fetchGithubUser(username, interaction.user);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("GitHub command error:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor(EMBED_COLORS.ERROR)
        .setDescription("Failed to fetch GitHub user data. Please try again later.");
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};