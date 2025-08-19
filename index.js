require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
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
    GatewayIntentBits.GuildMembers, // Needed for kick
  ],
});

// ---- Data ----
const hauntedChannels = new Set();
const hauntIntervals = new Map();

const spookyMessages = [
  '👻 Boo...', '💀 I see you...', '🩸 The shadows are watching...',
  '🔪 Behind you...', '🕷️ Something crawled across your screen...',
];

const spicyTruths = [ /* your truth list here */ ];
const spicyDares = [ /* your dare list here */ ];
const compliments = [ /* your compliment list here */ ];

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

  // ---- Moderation ----
  if (command === '$kick') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply('🚫 You do not have permission to use this command.');
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('⚠️ Please mention a user to kick.');
    const member = message.guild.members.cache.get(user.id);
    if (!member) return message.reply('⚠️ That user is not in this server.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    try {
      await member.kick(reason);
      message.channel.send(`👢 ${user.tag} was kicked. Reason: ${reason}`);
    } catch (err) {
      console.error(err);
      message.reply('❌ I was unable to kick that user.');
    }
  }

  else if (command === '$send') {
    const channelArg = args.shift();
    if (!channelArg) return message.reply('⚠️ Please provide a channel (mention or name).');

    // Find channel by mention or name
    let targetChannel =
      message.mentions.channels.first() ||
      message.guild.channels.cache.find(ch => `#${ch.name}` === channelArg || ch.name === channelArg.replace(/^#/, ''));

    if (!targetChannel) return message.reply('⚠️ Channel not found.');
    const text = args.join(' ');
    if (!text) return message.reply('⚠️ Please provide a message to send.');

    try {
      await targetChannel.send(text);
      message.reply(`✅ Sent message to ${targetChannel}`);
    } catch (err) {
      console.error(err);
      message.reply('❌ Could not send message.');
    }
  }

  // ---- Help ----
  else if (command === '$help') {
    const helpText =
    `📖 **Bot Commands — Utility**\n\n` +
    `🏓 \`$ping\` — Check bot response time\n` +
    `📊 \`$stats\` — Server member stats\n` +
    `⏱️ \`$uptime\` — Bot active time\n` +
    `🤖 \`$botinfo\` — Info about the bot\n` +
    `🔗 \`$invite\` — Get bot invite link\n` +
    `👢 \`$kick @user [reason]\` — Kick a member\n` +
    `✉️ \`$send #channel [msg]\` — Send a message to another channel\n\n` +
    `📖 **Fun & Games**\n\n` +
    `🪙 \`$flip\` — Flip a coin\n` +
    `🎱 \`$8ball [question]\` — Magic 8-ball\n` +
    `🎲 \`$dice\` — Roll a die\n` +
    `🎯 \`$rate @user\` — Rate someone\n` +
    `🌈 \`$howgay @user\` — Gay meter\n` +
    `🕵️ \`$sus @user\` — Sus meter\n` +
    `💬 \`$truth\` — Truth question\n` +
    `😈 \`$dare\` — Dare\n` +
    `🔥 \`$roast @user\` — Roast\n` +
    `💖 \`$compliment @user\` — Compliment\n` +
    `👻 \`$haunt\` / \`$unhaunt\` — Haunting\n` +
    `🃏 \`$blackjack\`, \`$hit\`, \`$stand\` — Play Blackjack\n\n` +
    `📖 **Info & Tools**\n\n` +
    `🧑‍💼 \`$userinfo\` — User info\n` +
    `🖼️ \`$avatar @user\` — Avatar\n` +
    `🏠 \`$serverinfo\` — Server info\n` +
    `📢 \`$shout [msg]\` — Shout\n` +
    `🤐 \`$spoiler [msg]\` — Spoiler\n` +
    `📣 \`$say [msg]\` — Echo`;
    message.channel.send(helpText);
  }

  // ---- Existing Utility, Fun, Blackjack, Info, Haunt, AI Chat ----
  // (all the rest of your script remains unchanged below ⬇️)

  // keep everything else you already had...
  // [your big script continues exactly as you pasted, no deletions]
});

// ---- Login ----
client.login(process.env.BOT_TOKEN);
