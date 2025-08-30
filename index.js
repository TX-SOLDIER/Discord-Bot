require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('✅ Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot is running on port ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== DATA ARRAYS =====
const spicyTruths = [
  "What's your wildest fantasy?",
  "Who was your first crush?",
  "Have you ever lied to get out of trouble?",
  "What’s the most embarrassing thing you’ve done?",
  "What’s your guilty pleasure?"
];

const spicyDares = [
  "Send a funny meme in the chat.",
  "Compliment the person above you.",
  "Change your nickname for 10 minutes.",
  "Send your last saved image.",
  "Type the next thing you say in all caps."
];

const compliments = [
  "You're awesome!",
  "You have great energy!",
  "You're really talented!",
  "You light up the room!",
  "You're an amazing friend!"
];

// Roleplay GIFs (offline URLs / working Imgur links)
const patGifs = [
  'https://i.imgur.com/5cVxU7l.gif',
  'https://i.imgur.com/t5wIu8v.gif',
  'https://i.imgur.com/f0oJ8z1.gif'
];

const cuddleGifs = [
  'https://i.imgur.com/3jLOZVq.gif',
  'https://i.imgur.com/IVVxN0B.gif',
  'https://i.imgur.com/SQ9GZtC.gif'
];

const pokeGifs = [
  'https://i.imgur.com/AvL8jA2.gif',
  'https://i.imgur.com/4WfwjJ7.gif',
  'https://i.imgur.com/sBoWkUS.gif'
];

// ===== COMMAND HANDLER =====
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith('$')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ==== HELP ====
  if (command === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('📜 Command List')
      .setColor('Blue')
      .setDescription(
        "**Fun:** `$truth`, `$dare`, `$compliment`, `$hug`, `$pat`, `$cuddle`, `$poke`, `$mock`, `$reverse`, `$ship`\n" +
        "**Utility:** `$say`, `$ping`, `$servericon`, `$serverbanner`, `$boosters`, `$prefix`, `$emojis`\n" +
        "**Moderation:** `$kick`, `$ban`, `$mute`, `$warn`, `$warnings`, `$clear [n]`, `$lock`, `$unlock`, `$slowmode`, `$roleadd`, `$roleremove`\n" +
        "**Special:** `$haunt`, `$send`, `$blackjack`"
      )
      .setFooter({ text: "Use $ before each command" });
    return message.channel.send({ embeds: [helpEmbed] });
  }

  // ==== TRUTH ====
  else if (command === 'truth') {
    const truth = spicyTruths[Math.floor(Math.random() * spicyTruths.length)];
    return message.channel.send(`🤔 Truth: ${truth}`);
  }

  // ==== DARE ====
  else if (command === 'dare') {
    const dare = spicyDares[Math.floor(Math.random() * spicyDares.length)];
    return message.channel.send(`🔥 Dare: ${dare}`);
  }

  // ==== COMPLIMENT ====
  else if (command === 'compliment') {
    const comp = compliments[Math.floor(Math.random() * compliments.length)];
    return message.channel.send(`💖 ${comp}`);
  }

  // ==== SAY ====
  else if (command === 'say') {
    const text = args.join(" ");
    if (!text) return message.reply("❌ You need to provide text!");
    return message.channel.send(text);
  }

  // ==== PING ====
  else if (command === 'ping') {
    return message.channel.send(`🏓 Pong! Latency: ${Date.now() - message.createdTimestamp}ms`);
  }

  // ==== SERVER ICON ====
  else if (command === 'servericon') {
    if (!message.guild.iconURL()) return message.reply("❌ This server has no icon!");
    return message.channel.send(message.guild.iconURL({ size: 1024, dynamic: true }));
  }

  // ==== SERVER BANNER ====
  else if (command === 'serverbanner') {
    if (!message.guild.bannerURL()) return message.reply("❌ This server has no banner!");
    return message.channel.send(message.guild.bannerURL({ size: 1024 }));
  }

  // ==== BOOSTERS ====
  else if (command === 'boosters') {
    const boosters = message.guild.members.cache.filter(m => m.premiumSince);
    return message.channel.send(`🚀 Boosters (${boosters.size}): ${boosters.map(m => m.user.tag).join(', ') || 'None'}`);
  }

  // ==== PREFIX ====
  else if (command === 'prefix') {
    return message.channel.send("My prefix is `$`");
  }

  // ==== EMOJIS ====
  else if (command === 'emojis') {
    return message.channel.send(
      message.guild.emojis.cache.map(e => e.toString()).join(' ') || "❌ No emojis in this server"
    );
  }

  // ==== MOCK ====
  else if (command === 'mock') {
    const text = args.join(" ");
    if (!text) return message.reply("❌ You need to provide text!");
    return message.channel.send(
      text.split("").map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join("")
    );
  }

  // ==== REVERSE ====
  else if (command === 'reverse') {
    const text = args.join(" ");
    if (!text) return message.reply("❌ You need to provide text!");
    return message.channel.send(text.split("").reverse().join(""));
  }
  // ==== SHIP ====
  else if (command === 'ship') {
    if (args.length < 2) return message.reply("❌ Usage: `$ship @user1 @user2`");
    const user1 = args[0];
    const user2 = args[1];
    const percentage = Math.floor(Math.random() * 101);
    const bar = "💖".repeat(Math.floor(percentage / 10)) + "💔".repeat(10 - Math.floor(percentage / 10));
    return message.channel.send(`💘 Shipping ${user1} + ${user2} = **${percentage}%**\n${bar}`);
  }

  // ==== ROLEPLAY COMMANDS (Hug, Pat, Cuddle, Poke) ====
  else if (command === 'hug') {
    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ You need to mention someone!");
    const gif = cuddleGifs[Math.floor(Math.random() * cuddleGifs.length)];
    return message.channel.send(`🤗 ${message.author} hugs ${user}!`, { files: [gif] });
  }

  else if (command === 'pat') {
    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ You need to mention someone!");
    const gif = patGifs[Math.floor(Math.random() * patGifs.length)];
    return message.channel.send(`👋 ${message.author} pats ${user}!`, { files: [gif] });
  }

  else if (command === 'cuddle') {
    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ You need to mention someone!");
    const gif = cuddleGifs[Math.floor(Math.random() * cuddleGifs.length)];
    return message.channel.send(`💞 ${message.author} cuddles ${user}!`, { files: [gif] });
  }

  else if (command === 'poke') {
    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ You need to mention someone!");
    const gif = pokeGifs[Math.floor(Math.random() * pokeGifs.length)];
    return message.channel.send(`👉 ${message.author} pokes ${user}!`, { files: [gif] });
  }

  // ==== CLEAR ====
  else if (command === 'clear') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return message.reply("❌ You don’t have permission!");
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) return message.reply("❌ Enter a number between 1 and 100.");
    await message.channel.bulkDelete(amount, true).catch(err => console.error(err));
    return message.channel.send(`✅ Cleared ${amount} messages.`).then(msg => setTimeout(() => msg.delete(), 3000));
  }

  // ==== LOCK / UNLOCK ====
  else if (command === 'lock') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return message.reply("❌ You don’t have permission!");
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
    return message.channel.send("🔒 Channel locked!");
  }

  else if (command === 'unlock') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return message.reply("❌ You don’t have permission!");
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true });
    return message.channel.send("🔓 Channel unlocked!");
  }

  // ==== SLOWMODE ====
  else if (command === 'slowmode') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return message.reply("❌ You don’t have permission!");
    const seconds = parseInt(args[0]);
    if (isNaN(seconds) || seconds < 0 || seconds > 21600) return message.reply("❌ Enter a number between 0 and 21600.");
    await message.channel.setRateLimitPerUser(seconds);
    return message.channel.send(`⏳ Slowmode set to ${seconds} seconds.`);
  }

  // ==== ROLE ADD ====
  else if (command === 'roleadd') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
      return message.reply("❌ You don’t have permission!");
    const user = message.mentions.members.first();
    const role = message.mentions.roles.first();
    if (!user || !role) return message.reply("❌ Usage: `$roleadd @user @role`");
    await user.roles.add(role);
    return message.channel.send(`✅ Added role ${role.name} to ${user.user.tag}`);
  }

  // ==== ROLE REMOVE ====
  else if (command === 'roleremove') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
      return message.reply("❌ You don’t have permission!");
    const user = message.mentions.members.first();
    const role = message.mentions.roles.first();
    if (!user || !role) return message.reply("❌ Usage: `$roleremove @user @role`");
    await user.roles.remove(role);
    return message.channel.send(`✅ Removed role ${role.name} from ${user.user.tag}`);
  }

}); // END messageCreate

// ==== LOGIN ====
client.login(process.env.TOKEN);
