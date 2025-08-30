require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('✅ Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Keep-alive server running on port ${PORT}`));

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
const blackjackGames = new Map();
const warnings = new Map();

const spookyMessages = [
  '👻 Boo...', '💀 I see you...', '🩸 The shadows are watching...',
  '🔪 Behind you...', '🕷️ Something crawled across your screen...',
];

const spicyTruths = [
  'What is your biggest fear?', 
  'Have you ever lied to your best friend?', 
  'What is your guilty pleasure?', 
  'What is the most embarrassing thing you’ve done?', 
  'Have you ever cheated on a test?'
];

const spicyDares = [
  'Do 20 push-ups.', 
  'Sing a song loudly.', 
  'Do an impression of someone in the room.', 
  'Dance for 1 minute without music.', 
  'Post a funny selfie in chat.'
];

const compliments = [
  'You have a great sense of humor!', 
  'You light up the room!', 
  'Your positivity is infectious.', 
  'You are really talented.', 
  'You make everyone smile!'
];

// ---- Static GIFs for roleplay commands (working Imgur URLs) ----
const hugGifs = ['https://i.imgur.com/9plN1pa.gif','https://i.imgur.com/1Uq6l8W.gif','https://i.imgur.com/8vJbZyC.gif'];
const kissGifs = ['https://i.imgur.com/2FZkbD0.gif','https://i.imgur.com/HQy3aG7.gif','https://i.imgur.com/kjZgDh9.gif'];
const slapGifs = ['https://i.imgur.com/3x0vhCZ.gif','https://i.imgur.com/0w4P7vI.gif','https://i.imgur.com/Gq2sZPo.gif'];
const patGifs = ['https://i.imgur.com/9XGkV9J.gif','https://i.imgur.com/wlYzP8k.gif','https://i.imgur.com/NjC2qRO.gif'];
const cuddleGifs = ['https://i.imgur.com/6yZkLML.gif','https://i.imgur.com/Fe8i5Vz.gif','https://i.imgur.com/LjE8c3Y.gif'];
const pokeGifs = ['https://i.imgur.com/FpDQo5J.gif','https://i.imgur.com/0r6bZyH.gif','https://i.imgur.com/j5Q4E9f.gif'];

// ---- Blackjack Functions ----
function drawCard() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  return { suit: suits[Math.floor(Math.random() * suits.length)], value: values[Math.floor(Math.random() * values.length)] };
}

function cardValue(card) {
  if (['J','Q','K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return parseInt(card.value);
}

function handValue(hand) {
  let total = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = hand.filter(c => c.value === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function formatHand(hand) { return hand.map(c => `${c.value}${c.suit}`).join(' '); }

// ---- Ready ----
client.once('ready', () => { console.log(`✅ Logged in as ${client.user.tag}`); });

// ---- Message Commands ----
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---- Help ----
  if (command === '$help') {
    const helpText = `📖 **Bot Commands — Utility**\n\n` +
    `🏓 $ping — Check bot response time\n` +
    `📊 $stats — Server member stats\n` +
    `⏱️ $uptime — Bot active time\n` +
    `🤖 $botinfo — Info about the bot\n` +
    `🔗 $invite — Get bot invite link\n` +
    `📝 $roles @user — Show roles\n` +
    `🏰 $servericon — Server icon\n` +
    `🏳️ $serverbanner — Server banner\n` +
    `✨ $boosters — List boosters\n` +
    `ℹ️ $prefix — Show bot prefix\n` +
    `😃 $emojis — List server emojis\n\n` +
    `📖 **Fun & Games**\n\n` +
    `🪙 $flip — Flip a coin\n` +
    `🎱 $8ball [question] — Magic 8-ball\n` +
    `🎲 $dice — Roll a die\n` +
    `🎯 $rate @user — Rate someone\n` +
    `🌈 $howgay @user — Gay meter\n` +
    `🕵️ $sus @user — Sus meter\n` +
    `💬 $truth — Truth question\n` +
    `😈 $dare — Dare\n` +
    `🔥 $roast @user — Roast\n` +
    `💖 $compliment @user — Compliment\n` +
    `💞 $ship @user1 @user2 — Ship users\n` +
    `📝 $mock [text] — Mock text\n` +
    `🔁 $reverse [text] — Reverse text\n` +
    `👻 $haunt / $unhaunt — Haunting\n` +
    `🃏 $blackjack, $hit, $stand — Play Blackjack\n\n` +
    `⚙️ **Moderation / Role**\n\n` +
    `🔇 $mute @user — Mute user\n` +
    `🔊 $unmute @user — Unmute user\n` +
    `⚠️ $warn @user [reason] — Warn user\n` +
    `⚠️ $warnings @user — Show warnings\n` +
    `🧹 $clear [number] — Delete messages\n` +
    `🔒 $lock — Lock channel\n` +
    `🔓 $unlock — Unlock channel\n` +
    `⏱️ $slowmode [seconds] — Set slowmode\n` +
    `✅ $roleadd @user <role> — Add role\n` +
    `✅ $roleremove @user <role> — Remove role\n\n` +
    `❤️ **Roleplay Commands**\n\n` +
    `$hug @user — Hug someone\n` +
    `$kiss @user — Kiss someone\n` +
    `$slap @user — Slap someone\n` +
    `$pat @user — Pat someone\n` +
    `$cuddle @user — Cuddle someone\n` +
    `$poke @user — Poke someone`;
    message.channel.send(helpText);
  }
  // ---- Utility Commands ----
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
  }

  // ---- Fun & Games ----
  else if (command === '$flip') {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    message.channel.send(`🪙 You flipped **${result}**!`);
  } else if (command === '$8ball') {
    const responses = ['Yes.', 'No.', 'Maybe.', 'Ask again later.', 'Definitely!', 'I don’t think so.'];
    if (!args.length) return message.reply('🎱 Ask me a question.');
    message.channel.send(`🎱 ${responses[Math.floor(Math.random() * responses.length)]}`);
  } else if (command === '$dice') {
    const roll = Math.floor(Math.random() * 6) + 1;
    message.channel.send(`🎲 You rolled a **${roll}**!`);
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

  // ---- Roleplay Commands ----
  else if (command === '$hug') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('🤗 Mention someone to hug!');
    const gif = hugGifs[Math.floor(Math.random() * hugGifs.length)];
    message.channel.send({ content: `${message.author} hugs ${user}!`, files: [gif] });
  } else if (command === '$kiss') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('💋 Mention someone to kiss!');
    const gif = kissGifs[Math.floor(Math.random() * kissGifs.length)];
    message.channel.send({ content: `${message.author} kisses ${user}!`, files: [gif] });
  } else if (command === '$slap') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('👋 Mention someone to slap!');
    const gif = slapGifs[Math.floor(Math.random() * slapGifs.length)];
    message.channel.send({ content: `${message.author} slaps ${user}!`, files: [gif] });
  } else if (command === '$pat') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('🤲 Mention someone to pat!');
    const gif = patGifs[Math.floor(Math.random() * patGifs.length)];
    message.channel.send({ content: `${message.author} pats ${user}!`, files: [gif] });
  } else if (command === '$cuddle') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('🤗 Mention someone to cuddle!');
    const gif = cuddleGifs[Math.floor(Math.random() * cuddleGifs.length)];
    message.channel.send({ content: `${message.author} cuddles ${user}!`, files: [gif] });
  } else if (command === '$poke') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('👉 Mention someone to poke!');
    const gif = pokeGifs[Math.floor(Math.random() * pokeGifs.length)];
    message.channel.send({ content: `${message.author} pokes ${user}!`, files: [gif] });
  }

  // ---- Kick / Ban / Haunt / Blackjack / Send / AI Chat ----
  // ...keep all previous logic from Part 1 here, unchanged...

});

client.login(process.env.BOT_TOKEN);
