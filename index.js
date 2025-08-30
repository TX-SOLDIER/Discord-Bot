require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('✅ Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ---- Data ----
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

// ---- Blackjack Game ----
const blackjackGames = new Map();

function drawCard() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  return {
    suit: suits[Math.floor(Math.random() * suits.length)],
    value: values[Math.floor(Math.random() * values.length)],
  };
}

function cardValue(card) {
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return parseInt(card.value);
}

function handValue(hand) {
  let total = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = hand.filter(c => c.value === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function formatHand(hand) {
  return hand.map(c => `${c.value}${c.suit}`).join(' ');
}

// ---- Ready ----
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ---- Commands ----
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---- Help ----
  if (command === '$help') {
    // Help is split in 3 messages to avoid Discord cutoff
    const help1 = `📖 **Bot Commands — Utility**\n\n` +
      `🏓 \`$ping\` — Check bot response time\n` +
      `📊 \`$stats\` — Server member stats\n` +
      `⏱️ \`$uptime\` — Bot active time\n` +
      `🤖 \`$botinfo\` — Info about the bot\n` +
      `🔗 \`$invite\` — Get bot invite link\n` +
      `🖼️ \`$avatar @user\` — Show user avatar\n` +
      `🧑‍💼 \`$userinfo\` — User info\n` +
      `🏠 \`$serverinfo\` — Server info\n` +
      `💠 \`$prefix\` — Show bot prefix\n\n` +
      `📖 **Fun & Games (Part 1)**\n\n` +
      `🪙 \`$flip\` — Flip a coin\n` +
      `🎲 \`$dice\` — Roll a die\n` +
      `🎱 \`$8ball [question]\` — Magic 8-ball\n` +
      `🎯 \`$rate @user\` — Rate someone\n` +
      `🌈 \`$howgay @user\` — Gay meter\n` +
      `🕵️ \`$sus @user\` — Sus meter\n` +
      `💬 \`$truth\` — Truth question\n` +
      `😈 \`$dare\` — Dare\n` +
      `🔥 \`$roast @user\` — Roast someone\n` +
      `💖 \`$compliment @user\` — Compliment someone\n`;

    message.channel.send(help1);
      const help2 = `📖 **Fun & Games (Part 2)**\n\n` +
      `🃏 \`$blackjack\`, \`$hit\`, \`$stand\` — Play Blackjack\n` +
      `👻 \`$haunt\` / \`$unhaunt\` — Haunt a channel\n` +
      `📢 \`$shout [msg]\` — Shout a message\n` +
      `🤐 \`$spoiler [msg]\` — Hide a message\n` +
      `📣 \`$say [msg]\` — Repeat message\n` +
      `💌 \`$send <channelID> <msg>\` — Send to another channel\n` +
      `💞 \`$ship @user1 @user2\` — Love compatibility\n` +
      `🔄 \`$reverse [msg]\` — Reverse text\n` +
      `🗣️ \`$mock [msg]\` — Mock text\n` +
      `🔇 \`$mute @user\` — Mute a user\n` +
      `⚠️ \`$warn @user <reason>\` — Warn user\n` +
      `📝 \`$warnings @user\` — Show warnings\n` +
      `🧹 \`$clear <number>\` — Delete messages\n` +
      `🔒 \`$lock\` — Lock the channel\n` +
      `🔓 \`$unlock\` — Unlock the channel\n` +
      `🐢 \`$slowmode <seconds>\` — Set slow mode\n` +
      `🎭 \`$role add/remove @user <role>\` — Add or remove roles\n`;
      
    message.channel.send(help2);
  }

  // ---- Utility ----
  else if (command === '$ping') {
    const sent = await message.channel.send('Pinging...');
    sent.edit(`🏓 Pong! Latency is ${sent.createdTimestamp - message.createdTimestamp}ms`);
  } else if (command === '$stats') {
    message.channel.send(`📊 Server has ${message.guild.memberCount} members.`);
  } else if (command === '$uptime') {
    const uptime = Math.floor(process.uptime());
    message.channel.send(`⏱️ Bot uptime: ${uptime} seconds.`);
  } else if (command === '$botinfo') {
    message.channel.send(`🤖 I am ${client.user.tag}, your friendly bot helper!`);
  } else if (command === '$invite') {
    message.channel.send('🔗 Invite me: https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands');
  } else if (command === '$prefix') {
    message.channel.send('🟢 My prefix is `$`');
  }

  // ---- Fun & Games ----
  else if (command === '$flip') {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    message.channel.send(`🪙 You flipped **${result}**!`);
  } else if (command === '$dice') {
    const roll = Math.floor(Math.random() * 6) + 1;
    message.channel.send(`🎲 You rolled a **${roll}**!`);
  } else if (command === '$8ball') {
    const responses = ['Yes.', 'No.', 'Maybe.', 'Ask again later.', 'Definitely!', 'I don’t think so.'];
    if (!args.length) return message.reply('🎱 Ask me a question.');
    message.channel.send(`🎱 ${responses[Math.floor(Math.random() * responses.length)]}`);
  } else if (command === '$rate') {
    const user = message.mentions.users.first() || message.author;
    const rating = Math.floor(Math.random() * 11);
    message.channel.send(`🎯 I rate ${user.username} a **${rating}/10**!`);
  } else if (command === '$howgay') {
    const user = message.mentions.users.first() || message.author;
    const gayness = Math.floor(Math.random() * 101);
    message.channel.send(`🌈 ${user.username} is **${gayness}%** gay!`);
  } else if (command === '$sus') {
    const user = message.mentions.users.first() || message.author;
    const sus = Math.floor(Math.random() * 101);
    message.channel.send(`🕵️ ${user.username} is **${sus}%** sus!`);
  } else if (command === '$truth') {
    message.channel.send(`💬 Truth: ${spicyTruths[Math.floor(Math.random() * spicyTruths.length)]}`);
  } else if (command === '$dare') {
    message.channel.send(`😈 Dare: ${spicyDares[Math.floor(Math.random() * spicyDares.length)]}`);
  } else if (command === '$roast') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('🔥 Tag someone to roast.');
    const roasts = [
      'You bring everyone so much joy… when you leave the room.',
      'If I had a face like yours, I’d sue my parents.',
      'You’re as useless as the “ueue” in “queue.”',
      'You have something on your chin... no, the third one down.',
    ];
    message.channel.send(`🔥 ${user.username}, ${roasts[Math.floor(Math.random() * roasts.length)]}`);
  } else if (command === '$compliment') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('💖 Tag someone to compliment.');
    message.channel.send(`💖 ${user.username}, ${compliments[Math.floor(Math.random() * compliments.length)]}`);
  }
    // ---- Kick / Ban ----
  else if (command === '$kick') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to kick.');
    if (!member.kickable) return message.reply('❌ I cannot kick this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    member.kick(reason)
      .then(() => message.channel.send(`✅ Kicked ${member.user.tag} | Reason: ${reason}`))
      .catch(err => message.reply(`❌ Failed to kick: ${err}`));
  } else if (command === '$ban') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to ban.');
    if (!member.bannable) return message.reply('❌ I cannot ban this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    member.ban({ reason })
      .then(() => message.channel.send(`✅ Banned ${member.user.tag} | Reason: ${reason}`))
      .catch(err => message.reply(`❌ Failed to ban: ${err}`));
  }

  // ---- Ship ----
  else if (command === '$ship') {
    const user1 = message.mentions.users.first();
    const user2 = message.mentions.users.last();
    if (!user1 || !user2 || user1.id === user2.id) return message.reply('💞 Mention two different users to ship.');
    const love = Math.floor(Math.random() * 101);
    message.channel.send(`💞 ${user1.username} ❤️ ${user2.username}: ${love}% compatible!`);
  }

  // ---- Reverse / Mock ----
  else if (command === '$reverse') {
    const text = args.join(' ');
    if (!text) return message.reply('🔄 Provide text to reverse.');
    message.channel.send(text.split('').reverse().join(''));
  } else if (command === '$mock') {
    const text = args.join(' ');
    if (!text) return message.reply('🗣️ Provide text to mock.');
    const mocked = text.split('').map((c, i) => i % 2 ? c.toLowerCase() : c.toUpperCase()).join('');
    message.channel.send(mocked);
  }

  // ---- Mute / Warn ----
  else if (command === '$mute') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('🔇 Mention a user to mute.');
    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!role) return message.reply('⚠️ No "Muted" role found.');
    member.roles.add(role).then(() => message.channel.send(`🔇 ${member.user.tag} has been muted.`));
  } else if (command === '$warn') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Mention a user to warn.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    // Store warnings in memory (can be extended to DB)
    if (!member.warnings) member.warnings = [];
    member.warnings.push(reason);
    message.channel.send(`⚠️ ${member.user.tag} has been warned: ${reason}`);
  } else if (command === '$warnings') {
    const member = message.mentions.members.first() || message.member;
    const warns = member.warnings || [];
    message.channel.send(`📝 ${member.user.tag} has ${warns.length} warning(s):\n${warns.join('\n') || 'None'}`);
  }

  // ---- Clear / Lock / Unlock / Slowmode / Role ----
  else if (command === '$clear') {
    const num = parseInt(args[0]);
    if (!num) return message.reply('🧹 Specify number of messages to delete.');
    message.channel.bulkDelete(num, true).catch(() => message.reply('❌ Failed to delete messages.'));
  } else if (command === '$lock') {
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false })
      .then(() => message.channel.send('🔒 Channel locked.'));
  } else if (command === '$unlock') {
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true })
      .then(() => message.channel.send('🔓 Channel unlocked.'));
  } else if (command === '$slowmode') {
    const seconds = parseInt(args[0]);
    if (isNaN(seconds)) return message.reply('🐢 Specify slowmode seconds.');
    message.channel.setRateLimitPerUser(seconds).then(() => message.channel.send(`🐢 Slowmode set to ${seconds} seconds.`));
  } else if (command === '$role') {
    const sub = args[0];
    const member = message.mentions.members.first();
    if (!member) return message.reply('🎭 Mention a user.');
    const roleName = args.slice(2).join(' ');
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (!role) return message.reply('⚠️ Role not found.');
    if (sub === 'add') member.roles.add(role).then(() => message.channel.send(`✅ Added role ${role.name} to ${member.user.tag}`));
    else if (sub === 'remove') member.roles.remove(role).then(() => message.channel.send(`✅ Removed role ${role.name} from ${member.user.tag}`));
    else message.reply('⚠️ Use add or remove.');
  }

  // ---- Haunt (already in part 1) ----
  // ---- AI Chat (already in part 1) ----
});

client.login(process.env.BOT_TOKEN);
