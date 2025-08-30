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

// ---- Static GIFs for roleplay commands ----
const hugGifs = ['https://i.imgur.com/1M1M1M1.gif','https://i.imgur.com/2M2M2M2.gif','https://i.imgur.com/3M3M3M3.gif'];
const kissGifs = ['https://i.imgur.com/4K4K4K4.gif','https://i.imgur.com/5K5K5K5.gif','https://i.imgur.com/6K6K6K6.gif'];
const slapGifs = ['https://i.imgur.com/7S7S7S7.gif','https://i.imgur.com/8S8S8S8.gif','https://i.imgur.com/9S9S9S9.gif'];
const patGifs = ['https://i.imgur.com/pat1.gif','https://i.imgur.com/pat2.gif','https://i.imgur.com/pat3.gif'];
const cuddleGifs = ['https://i.imgur.com/cuddle1.gif','https://i.imgur.com/cuddle2.gif','https://i.imgur.com/cuddle3.gif'];
const pokeGifs = ['https://i.imgur.com/poke1.gif','https://i.imgur.com/poke2.gif','https://i.imgur.com/poke3.gif'];

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
  // ---- Roleplay Commands ----
  else if (command === '$hug') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('🤗 Mention someone to hug!');
    const gif = hugGifs[Math.floor(Math.random() * hugGifs.length)];
    message.channel.send({ content: `${message.author} hugs ${user}!`, files: [gif] });
  } 
  else if (command === '$kiss') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('💋 Mention someone to kiss!');
    const gif = kissGifs[Math.floor(Math.random() * kissGifs.length)];
    message.channel.send({ content: `${message.author} kisses ${user}!`, files: [gif] });
  } 
  else if (command === '$slap') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('👋 Mention someone to slap!');
    const gif = slapGifs[Math.floor(Math.random() * slapGifs.length)];
    message.channel.send({ content: `${message.author} slaps ${user}!`, files: [gif] });
  }
  else if (command === '$pat') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('🤲 Mention someone to pat!');
    const gif = patGifs[Math.floor(Math.random() * patGifs.length)];
    message.channel.send({ content: `${message.author} pats ${user}!`, files: [gif] });
  }
  else if (command === '$cuddle') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('🤗 Mention someone to cuddle!');
    const gif = cuddleGifs[Math.floor(Math.random() * cuddleGifs.length)];
    message.channel.send({ content: `${message.author} cuddles ${user}!`, files: [gif] });
  }
  else if (command === '$poke') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('👉 Mention someone to poke!');
    const gif = pokeGifs[Math.floor(Math.random() * pokeGifs.length)];
    message.channel.send({ content: `${message.author} pokes ${user}!`, files: [gif] });
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
  } 
  else if (command === '$ban') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to ban.');
    if (!member.bannable) return message.reply('❌ I cannot ban this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    member.ban({ reason })
      .then(() => message.channel.send(`✅ Banned ${member.user.tag} | Reason: ${reason}`))
      .catch(err => message.reply(`❌ Failed to ban: ${err}`));
  }

  // ---- Blackjack Commands ----
  else if (command === '$blackjack') {
    if (blackjackGames.has(message.author.id)) return message.reply('⚠️ You already have a game! Use `$hit` or `$stand`.');
    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];
    blackjackGames.set(message.author.id, { playerHand, dealerHand });
    const playerTotal = handValue(playerHand);
    message.channel.send(`🃏 **Blackjack Started!** 🃏\n\n**Your hand:** ${formatHand(playerHand)} (Total: ${playerTotal})\n**Dealer’s hand:** ${dealerHand[0].value}${dealerHand[0].suit} ??\n\n👉 Type \`$hit\` or \`$stand\``);
  } 
  else if (command === '$hit') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply('⚠️ No active game. Start one with `$blackjack`.');
    game.playerHand.push(drawCard());
    const playerTotal = handValue(game.playerHand);
    let msg = `**Your hand:** ${formatHand(game.playerHand)} (Total: ${playerTotal})`;
    if (playerTotal > 21) { msg += `\n💥 You busted! Dealer wins.`; blackjackGames.delete(message.author.id); }
    else msg += `\n👉 Type \`$hit\` or \`$stand\``;
    message.channel.send(msg);
  } 
  else if (command === '$stand') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply('⚠️ No active game. Start one with `$blackjack`.');
    const dealerHand = game.dealerHand;
    let dealerTotal = handValue(dealerHand);
    while (dealerTotal < 17) { dealerHand.push(drawCard()); dealerTotal = handValue(dealerHand); }
    const playerTotal = handValue(game.playerHand);
    let result = `**Your hand:** ${formatHand(game.playerHand)} (Total: ${playerTotal})\n**Dealer’s hand:** ${formatHand(dealerHand)} (Total: ${dealerTotal})\n\n`;
    if (playerTotal > 21) result += `💥 You busted! Dealer wins.`;
    else if (dealerTotal > 21) result += `🎉 Dealer busted! You win!`;
    else if (playerTotal > dealerTotal) result += `🎉 You win!`;
    else if (playerTotal < dealerTotal) result += `😢 Dealer wins.`;
    else result += `🤝 It’s a tie!`;
    blackjackGames.delete(message.author.id);
    message.channel.send(result);
  }

  // ---- Haunt Commands ----
  else if (command === '$haunt') {
    if (hauntedChannels.has(message.channel.id)) return message.channel.send('👻 Already haunting this channel!');
    hauntedChannels.add(message.channel.id);
    message.channel.send('💀 The haunting has begun...');
    const interval = setInterval(() => {
      if (!hauntedChannels.has(message.channel.id)) return clearInterval(interval);
      message.channel.send(spookyMessages[Math.floor(Math.random() * spookyMessages.length)]);
    }, 30000);
    hauntIntervals.set(message.channel.id, interval);
  } 
  else if (command === '$unhaunt') {
    hauntedChannels.delete(message.channel.id);
    if (hauntIntervals.has(message.channel.id)) { clearInterval(hauntIntervals.get(message.channel.id)); hauntIntervals.delete(message.channel.id); }
    message.channel.send('🕯️ The spirits have left...');
  }

  // ---- Send Command (unchanged) ----
  else if (command === '$send') {
    const channelId = args.shift();
    if (!channelId) return message.reply('⚠️ Provide the channel ID.');
    const text = args.join(' ');
    if (!text) return message.reply('⚠️ Provide a message to send.');
    const channel = client.channels.cache.get(channelId);
    if (!channel || channel.type !== 0) return message.reply('⚠️ Channel not found or not text-based.');
    channel.send(text).then(() => message.reply(`✅ Message sent to <#${channelId}>`)).catch(err => message.reply('❌ Failed to send message. Check bot permissions.'));
  }

  // ---- AI Chat ----
  else if (message.mentions.has(client.user)) {
    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    if (!prompt) return message.reply('❓ What would you like to ask?');
    try {
      await message.channel.sendTyping();
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openrouter/auto',
          max_tokens: 100,
          messages: [
            { role: 'system', content: 'You are a helpful and fun AI assistant living inside a Discord bot.' },
            { role: 'user', content: prompt }
          ]
        }),
      });
      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (reply) await message.reply(reply);
      else if (data?.error?.message) await message.reply(`⚠️ AI error: ${data.error.message}`);
      else await message.reply('⚠️ Sorry, I couldn’t come up with a reply.');
    } catch (err) {
      console.error('❌ AI request failed:', err);
      await message.reply('🚫 Error talking to the AI. Try again later.');
    }
  }
});

client.login(process.env.BOT_TOKEN);
