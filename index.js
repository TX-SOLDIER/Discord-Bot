require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Gemini import

// ---- Constants & Config ----
const PORT = process.env.PORT || 3000; // Only declare once
const OWNER_ID = '782155864134909952';
const PREFIX = '$';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ---- Google Gemini AI Setup ----
const genAI = new GoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });
async function askGemini(prompt) {
  try {
    const response = await genAI.chat.sendMessage({
      model: 'chat-bison-001',
      messages: [{ role: 'user', content: prompt }],
    });
    return response?.candidates?.[0]?.content || "🤖 I couldn't generate a response.";
  } catch (err) {
    console.error('❌ Gemini AI error:', err);
    return "🚫 Error communicating with Gemini AI.";
  }
}

// ---- Owner Immunity ----
function isImmune(user) { return user.id === OWNER_ID; }

// ---- Express Keep-alive Server ----
const app = express();
app.get('/', (req, res) => res.send('✅ Bot is running!'));

// Safe listen to prevent crash if port is already in use
const server = app.listen(PORT, () => {
  console.log(`✅ Keep-alive server running on port ${PORT}`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ Port ${PORT} in use, keep-alive server could not start.`);
  } else {
    console.error('Server error:', err);
  }
});

// ---- Data Storage & Warnings ----
const warningsFile = './warnings.json';
let warnings = {};
if (fs.existsSync(warningsFile)) warnings = JSON.parse(fs.readFileSync(warningsFile, 'utf8'));
function saveWarnings() { fs.writeFileSync(warningsFile, JSON.stringify(warnings, null, 2)); }

// ---- Haunted & Fun Data ----
const hauntedChannels = new Set();
const hauntIntervals = new Map();

const spookyMessages = [
  '👻 Boo...', '💀 I see you...', '🩸 The shadows are watching...',
  '🔪 Behind you...', '🕷️ Something crawled across your screen...',
];

const spicyTruths = [
  "What’s your most embarrassing moment?",
  "Who was your first crush?",
  "Have you ever lied to get out of trouble?",
  "What’s the most childish thing you still do?",
  "What’s a secret you’ve never told anyone here?",
  "If you could switch lives with someone for a day, who would it be?",
  "What’s your biggest fear?",
  "What’s the worst thing you’ve ever eaten?",
];

const spicyDares = [
  "Change your nickname to something silly for 10 minutes.",
  "Type your next 3 messages in ALL CAPS.",
  "Send a random emoji in the chat every 10 seconds for 1 minute.",
  "Say something nice about the last person who spoke.",
  "Do 10 pushups (or pretend to and tell us how it went).",
  "Put your status to 'I love pineapples on pizza' for 1 hour.",
  "Send a gif that describes your current mood.",
  "Use only memes to communicate for the next 5 minutes.",
];

const compliments = [
  "You have great taste in music.",
  "Your energy makes the chat better.",
  "You’re really funny!",
  "You’re smarter than you give yourself credit for.",
  "You have an amazing vibe.",
  "You’re one of the kindest people I’ve seen here.",
  "I admire how confident you are.",
  "You always make people feel welcome.",
];

// ---- Blackjack Helpers ----
const blackjackGames = new Map();
function drawCard() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  return { suit: suits[Math.floor(Math.random() * suits.length)], value: values[Math.floor(Math.random() * values.length)] };
}
function cardValue(card) { if(['J','Q','K'].includes(card.value)) return 10; if(card.value==='A') return 11; return parseInt(card.value); }
function handValue(hand) {
  let total = hand.reduce((sum,c)=>sum+cardValue(c),0);
  let aces = hand.filter(c=>c.value==='A').length;
  while(total>21 && aces>0){ total-=10; aces--; }
  return total;
}
function formatHand(hand){ return hand.map(c=>`${c.value}${c.suit}`).join(' '); }

// ---- Ready Event ----
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ---- Message Handler ----
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---- Moderation Permission Check ----
  function checkPermission(permission) {
    if (!message.member.permissions.has(permission)) {
      message.reply('❌ You do not have permission to do that!');
      return false;
    }
    return true;
  }

  // ---- Fun & Utility Commands ----
  if (command === 'help') {
    const helpText1 = `📖 **Bot Commands — Utility**\n\n` +
      `📌 \`${PREFIX}prefix\` — Show the bot prefix\n` +
      `🏓 \`${PREFIX}ping\` — Check bot response time\n` +
      `📊 \`${PREFIX}stats\` — Server member stats\n` +
      `⏱️ \`${PREFIX}uptime\` — Bot active time\n` +
      `🤖 \`${PREFIX}botinfo\` — Info about the bot\n` +
      `🔗 \`${PREFIX}invite\` — Get bot invite link\n\n` +
      `📖 **Fun & Games**\n\n` +
      `🪙 \`${PREFIX}flip\` — Flip a coin\n` +
      `🎱 \`${PREFIX}8ball [question]\` — Magic 8-ball\n` +
      `🎲 \`${PREFIX}dice\` — Roll a die\n` +
      `🎯 \`${PREFIX}rate @user\` — Rate someone\n` +
      `🌈 \`${PREFIX}howgay @user\` — Gay meter\n` +
      `🕵️ \`${PREFIX}sus @user\` — Sus meter\n` +
      `💬 \`${PREFIX}truth\` — Truth question\n` +
      `😈 \`${PREFIX}dare\` — Dare\n` +
      `🔥 \`${PREFIX}roast @user\` — Roast\n` +
      `💖 \`${PREFIX}compliment @user\` — Compliment\n` +
      `👻 \`${PREFIX}haunt\` / \`${PREFIX}unhaunt\` — Haunting\n` +
      `🃏 \`${PREFIX}blackjack\`, \`${PREFIX}hit\`, \`${PREFIX}stand\` — Play Blackjack\n\n` +
      `📖 **Moderation Commands**\n\n` +
      `🔨 \`${PREFIX}kick @user [reason]\` — Kick a user\n` +
      `🚫 \`${PREFIX}ban @user [reason]\` — Ban a user\n` +
      `🤐 \`${PREFIX}mute @user [time]\` — Mute a user\n` +
      `🔊 \`${PREFIX}unmute @user\` — Unmute a user\n` +
      `⚠️ \`${PREFIX}warn @user [reason]\` — Warn a user\n` +
      `📄 \`${PREFIX}warnings @user\` — Show warnings\n` +
      `🧹 \`${PREFIX}clear [number]\` — Delete messages\n` +
      `🔒 \`${PREFIX}lock\` — Lock channel\n` +
      `🔓 \`${PREFIX}unlock\` — Unlock channel\n` +
      `🐌 \`${PREFIX}slowmode [seconds]\` — Set slowmode\n` +
      `🏷️ \`${PREFIX}role add @user <role>\` — Add role\n` +
      `🏷️ \`${PREFIX}role remove @user <role>\` — Remove role`;

    const helpText2 = `📖 **Info & Tools**\n\n` +
      `🧑‍💼 \`${PREFIX}userinfo\` — User info\n` +
      `🖼️ \`${PREFIX}avatar @user\` — Avatar\n` +
      `🏠 \`${PREFIX}serverinfo\` — Server info\n` +
      `📢 \`${PREFIX}shout [msg]\` — Shout\n` +
      `🤐 \`${PREFIX}spoiler [msg]\` — Spoiler\n` +
      `📣 \`${PREFIX}say [msg]\` — Echo\n` +
      `✉️ \`${PREFIX}send <channelID> <message>\` — Send to another server/channel`;

    await message.channel.send(helpText1);
    return message.channel.send(helpText2);
  } 
  else if (command === 'ping') {
    const sent = await message.channel.send('Pinging...');
    sent.edit(`🏓 Pong! Latency is ${sent.createdTimestamp - message.createdTimestamp}ms`);
  } 
  else if (command === 'stats') {
    message.channel.send(`📊 Server has ${message.guild.memberCount} members.`);
  } 
  else if (command === 'uptime') {
    const uptime = Math.floor(process.uptime());
    message.channel.send(`⏱️ Bot uptime: ${uptime} seconds.`);
  } 
  else if (command === 'botinfo') {
    message.channel.send(`🤖 I am ${client.user.tag}, your friendly bot helper!`);
  } 
  else if (command === 'invite') {
    message.channel.send('🔗 Invite me: https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands');
  } 
  else if (command === 'prefix') {
    message.channel.send(`📌 The current prefix is: \`${PREFIX}\``);
  } 
  else if (command === 'flip') {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    message.channel.send(`🪙 You flipped **${result}**!`);
  } 
  else if (command === '8ball') {
    const responses = ['Yes.', 'No.', 'Maybe.', 'Ask again later.', 'Definitely!', 'I don’t think so.'];
    if (!args.length) return message.reply('🎱 Ask me a question.');
    message.channel.send(`🎱 ${responses[Math.floor(Math.random() * responses.length)]}`);
  } 
  else if (command === 'dice') {
    const roll = Math.floor(Math.random() * 6) + 1;
    message.channel.send(`🎲 You rolled a **${roll}**!`);
  } 
  else if (command === 'rate') {
    const user = message.mentions.users.first() || message.author;
    const rating = Math.floor(Math.random() * 11);
    message.channel.send(`🎯 I rate ${user.username} a **${rating}/10**!`);
  } 
  else if (command === 'howgay') {
    const user = message.mentions.users.first() || message.author;
    const gayness = Math.floor(Math.random() * 101);
    message.channel.send(`🌈 ${user.username} is **${gayness}%** gay!`);
  } 
  else if (command === 'sus') {
    const user = message.mentions.users.first() || message.author;
    const sus = Math.floor(Math.random() * 101);
    message.channel.send(`🕵️ ${user.username} is **${sus}%** sus!`);
  } 
  else if (command === 'truth') {
    message.channel.send(`💬 Truth: ${spicyTruths[Math.floor(Math.random() * spicyTruths.length)]}`);
  } 
  else if (command === 'dare') {
    message.channel.send(`😈 Dare: ${spicyDares[Math.floor(Math.random() * spicyDares.length)]}`);
  }

// ---- Haunt Commands ----
  else if (command === 'haunt') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('👻 Tag someone to haunt.');
    hauntedChannels.add(user.id);
    message.channel.send(`👻 ${user.username} is now haunted!`);
  } 
  else if (command === 'unhaunt') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('👻 Tag someone to unhaunt.');
    hauntedChannels.delete(user.id);
    message.channel.send(`👻 ${user.username} is no longer haunted.`);
  }

}); // ---- End of messageCreate ----

// ---- Blackjack System ----
const blackjackGames = new Map();

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---- Blackjack Commands ----
  if (command === 'blackjack') {
    if (blackjackGames.has(message.author.id)) {
      return message.channel.send('🃏 You are already in a game!');
    }
    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];
    blackjackGames.set(message.author.id, { playerHand, dealerHand, stand: false });
    message.channel.send(`🃏 Game started!\nYour hand: ${playerHand.join(', ')}\nDealer shows: ${dealerHand[0]}\nUse \`${PREFIX}hit\` or \`${PREFIX}stand\``);
  } 
  else if (command === 'hit') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.channel.send('🃏 You are not in a game!');
    if (game.stand) return message.channel.send('🃏 You already stood!');

    game.playerHand.push(drawCard());
    const playerSum = sumHand(game.playerHand);
    if (playerSum > 21) {
      blackjackGames.delete(message.author.id);
      return message.channel.send(`💥 Busted! Your hand: ${game.playerHand.join(', ')} (Total: ${playerSum})`);
    }
    message.channel.send(`🃏 Your hand: ${game.playerHand.join(', ')} (Total: ${playerSum})`);
  } 
  else if (command === 'stand') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.channel.send('🃏 You are not in a game!');
    game.stand = true;

    let dealerSum = sumHand(game.dealerHand);
    while (dealerSum < 17) {
      game.dealerHand.push(drawCard());
      dealerSum = sumHand(game.dealerHand);
    }

    const playerSum = sumHand(game.playerHand);
    let result = '';
    if (dealerSum > 21 || playerSum > dealerSum) result = 'You win! 🎉';
    else if (playerSum < dealerSum) result = 'Dealer wins! 😢';
    else result = 'It\'s a tie! 🤝';

    blackjackGames.delete(message.author.id);
    message.channel.send(`🃏 Dealer hand: ${game.dealerHand.join(', ')} (Total: ${dealerSum})\nYour hand: ${game.playerHand.join(', ')} (Total: ${playerSum})\n**${result}**`);
  }

  // ---- Moderation Commands ----
  if (command === 'kick') {
    if (!checkPermission(PermissionsBitField.Flags.KickMembers)) return;
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mention someone to kick.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    user.kick(reason).then(() => message.channel.send(`✅ Kicked ${user.user.tag}`));
  } 
  else if (command === 'ban') {
    if (!checkPermission(PermissionsBitField.Flags.BanMembers)) return;
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mention someone to ban.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    user.ban({ reason }).then(() => message.channel.send(`✅ Banned ${user.user.tag}`));
  } 
  else if (command === 'mute') {
    if (!checkPermission(PermissionsBitField.Flags.MuteMembers)) return;
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mention someone to mute.');
    const time = parseInt(args[1]) || 10;
    let muteRole = message.guild.roles.cache.find(r => r.name === 'Muted');
    if (!muteRole) {
      muteRole = await message.guild.roles.create({ name: 'Muted', permissions: [] });
      message.guild.channels.cache.forEach(channel => {
        channel.permissionOverwrites.edit(muteRole, { SendMessages: false, AddReactions: false });
      });
    }
    await user.roles.add(muteRole);
    message.channel.send(`🔇 Muted ${user.user.tag} for ${time} minutes`);
    setTimeout(() => user.roles.remove(muteRole), time * 60000);
  } 
  else if (command === 'unmute') {
    if (!checkPermission(PermissionsBitField.Flags.MuteMembers)) return;
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mention someone to unmute.');
    const muteRole = message.guild.roles.cache.find(r => r.name === 'Muted');
    if (muteRole && user.roles.cache.has(muteRole.id)) {
      await user.roles.remove(muteRole);
      message.channel.send(`🔊 Unmuted ${user.user.tag}`);
    }
  } 
  else if (command === 'warn') {
    if (!checkPermission(PermissionsBitField.Flags.KickMembers)) return;
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mention someone to warn.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (!warnings[user.id]) warnings[user.id] = [];
    warnings[user.id].push({ reason, date: new Date().toISOString() });
    fs.writeFileSync('./warnings.json', JSON.stringify(warnings, null, 2));
    message.channel.send(`⚠️ Warned ${user.user.tag} for: ${reason}`);
  } 
  else if (command === 'warnings') {
    const user = message.mentions.members.first() || message.member;
    const userWarnings = warnings[user.id] || [];
    if (!userWarnings.length) return message.channel.send(`✅ ${user.user.tag} has no warnings.`);
    const warnList = userWarnings.map((w, i) => `${i + 1}. ${w.reason} (${w.date})`).join('\n');
    message.channel.send(`⚠️ Warnings for ${user.user.tag}:\n${warnList}`);
  } 
  else if (command === 'clear') {
    if (!checkPermission(PermissionsBitField.Flags.ManageMessages)) return;
    const num = parseInt(args[0]) || 5;
    message.channel.bulkDelete(num, true);
    message.channel.send(`🧹 Deleted ${num} messages`).then(msg => setTimeout(() => msg.delete(), 5000));
  } 
  else if (command === 'lock') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
    message.channel.send('🔒 Channel locked.');
  } 
  else if (command === 'unlock') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true });
    message.channel.send('🔓 Channel unlocked.');
  } 
  else if (command === 'slowmode') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    const seconds = parseInt(args[0]) || 0;
    message.channel.setRateLimitPerUser(seconds);
    message.channel.send(`🐌 Slowmode set to ${seconds} seconds.`);
  }

  // ---- Role Management ----
  else if (command === 'role') {
    if (!checkPermission(PermissionsBitField.Flags.ManageRoles)) return;
    const sub = args[0];
    const user = message.mentions.members.first();
    const roleName = args.slice(1).join(' ');
    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!user || !role) return message.reply('❌ User or role not found.');
    if (sub === 'add') {
      await user.roles.add(role);
      message.channel.send(`✅ Added role ${role.name} to ${user.user.tag}`);
    } else if (sub === 'remove') {
      await user.roles.remove(role);
      message.channel.send(`✅ Removed role ${role.name} from ${user.user.tag}`);
    }
  }

}); // ---- End of messageCreate ----

// ---- Helper Functions ----
function drawCard() {
  const cards = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  return cards[Math.floor(Math.random() * cards.length)];
}

function sumHand(hand) {
  let sum = 0;
  let aceCount = 0;
  hand.forEach(c => {
    if (['J', 'Q', 'K'].includes(c)) sum += 10;
    else if (c === 'A') { sum += 11; aceCount++; }
    else sum += parseInt(c);
  });
  while (sum > 21 && aceCount > 0) { sum -= 10; aceCount--; }
  return sum;
}

// ---- Info Commands ----
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'userinfo') {
    const user = message.mentions.users.first() || message.author;
    const member = message.guild.members.cache.get(user.id);
    message.channel.send({
      embeds: [{
        color: 0x00ff00,
        title: `${user.tag} Info`,
        thumbnail: { url: user.displayAvatarURL({ dynamic: true }) },
        fields: [
          { name: 'ID', value: user.id, inline: true },
          { name: 'Nickname', value: member.nickname || 'None', inline: true },
          { name: 'Joined Server', value: new Date(member.joinedTimestamp).toLocaleString(), inline: false },
          { name: 'Account Created', value: new Date(user.createdTimestamp).toLocaleString(), inline: false }
        ]
      }]
    });
  } 
  else if (command === 'serverinfo') {
    const guild = message.guild;
    message.channel.send({
      embeds: [{
        color: 0x00ff00,
        title: `${guild.name} Info`,
        thumbnail: { url: guild.iconURL({ dynamic: true }) },
        fields: [
          { name: 'ID', value: guild.id, inline: true },
          { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
          { name: 'Members', value: guild.memberCount.toString(), inline: true },
          { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
          { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
          { name: 'Boost Level', value: guild.premiumTier.toString(), inline: true }
        ]
      }]
    });
  }

  // ---- Avatar Command ----
  else if (command === 'avatar') {
    const user = message.mentions.users.first() || message.author;
    message.channel.send({ content: user.displayAvatarURL({ dynamic: true, size: 1024 }) });
  }

  // ---- Say / Shout / Send ----
  else if (command === 'say') {
    if (!checkPermission(PermissionsBitField.Flags.ManageMessages)) return;
    const text = args.join(' ');
    if (!text) return message.reply('❌ Provide text to say.');
    message.channel.send(text);
  } 
  else if (command === 'shout') {
    if (!checkPermission(PermissionsBitField.Flags.ManageMessages)) return;
    const text = args.join(' ').toUpperCase();
    if (!text) return message.reply('❌ Provide text to shout.');
    message.channel.send(text);
  } 
  else if (command === 'send') {
    if (!checkPermission(PermissionsBitField.Flags.Administrator)) return;
    const channel = message.mentions.channels.first();
    const text = args.slice(1).join(' ');
    if (!channel || !text) return message.reply('❌ Mention a channel and provide a message.');
    channel.send(text);
    message.channel.send(`✅ Sent message to ${channel}`);
  }
});

// ---- Final Bot Login  ----
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`✅ Web server running on port ${PORT}`));

client.login(process.env.TOKEN).then(() => {
  console.log(`✅ Logged in as ${client.user.tag}`);
}).catch(err => console.error('❌ Login failed:', err));
