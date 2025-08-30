require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
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

// ---- Persistent Warnings ----
const warningsFile = './warnings.json';
let warnings = {};

if (fs.existsSync(warningsFile)) {
  warnings = JSON.parse(fs.readFileSync(warningsFile, 'utf8'));
}

function saveWarnings() {
  fs.writeFileSync(warningsFile, JSON.stringify(warnings, null, 2));
}

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

  if (command === '$help') {
    const helpText1 = `📖 **Bot Commands — Utility**\n\n` +
      `📌 \`$prefix\` — Show the bot prefix\n` +
      `🏓 \`$ping\` — Check bot response time\n` +
      `📊 \`$stats\` — Server member stats\n` +
      `⏱️ \`$uptime\` — Bot active time\n` +
      `🤖 \`$botinfo\` — Info about the bot\n` +
      `🔗 \`$invite\` — Get bot invite link\n\n` +
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
      `📖 **Moderation Commands**\n\n` +
      `🔨 \`$kick @user [reason]\` — Kick a user\n` +
      `🚫 \`$ban @user [reason]\` — Ban a user\n` +
      `🤐 \`$mute @user [time]\` — Mute a user\n` +
      `🔊 \`$unmute @user\` — Unmute a user\n` +
      `⚠️ \`$warn @user [reason]\` — Warn a user\n` +
      `📄 \`$warnings @user\` — Show warnings\n` +
      `🧹 \`$clear [number]\` — Delete messages\n` +
      `🔒 \`$lock\` — Lock channel\n` +
      `🔓 \`$unlock\` — Unlock channel\n` +
      `🐌 \`$slowmode [seconds]\` — Set slowmode\n` +
      `🏷️ \`$role add @user <role>\` — Add role\n` +
      `🏷️ \`$role remove @user <role>\` — Remove role\n` +
      `❌ \`$unauthorized\` — Unauthorized response\n`;
    message.channel.send(helpText1);
  } else if (command === '$help') {
    const helpText2 = `📖 **Info & Tools**\n\n` +
      `🧑‍💼 \`$userinfo\` — User info\n` +
      `🖼️ \`$avatar @user\` — Avatar\n` +
      `🏠 \`$serverinfo\` — Server info\n` +
      `📢 \`$shout [msg]\` — Shout\n` +
      `🤐 \`$spoiler [msg]\` — Spoiler\n` +
      `📣 \`$say [msg]\` — Echo\n` +
      `✉️ \`$send <channelID> <message>\` — Send to another server/channel`;
    message.channel.send(helpText2);
  }
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
  } else if (command === '$flip') {
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

  // ---- Kick / Ban ----
  else if (command === '$kick') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to kick.');
    if (!member.kickable) return message.reply('❌ I cannot kick this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    member.kick(reason).then(() => message.channel.send(`✅ Kicked ${member.user.tag} | Reason: ${reason}`));
  } else if (command === '$ban') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to ban.');
    if (!member.bannable) return message.reply('❌ I cannot ban this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    member.ban({ reason }).then(() => message.channel.send(`✅ Banned ${member.user.tag} | Reason: ${reason}`));
  }

  // ---- Mute / Unmute ----
  else if (command === '$mute') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to mute.');
    const time = args[1] || '60';
    member.timeout(parseInt(time) * 1000, 'Muted by bot')
      .then(() => message.channel.send(`🤐 ${member.user.tag} has been muted for ${time} seconds.`));
  } else if (command === '$unmute') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to unmute.');
    member.timeout(null, 'Unmuted by bot')
      .then(() => message.channel.send(`🔊 ${member.user.tag} has been unmuted.`));
  }

  // ---- Warn / Warnings ----
  else if (command === '$warn') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to warn.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (!warnings[member.id]) warnings[member.id] = [];
    warnings[member.id].push({ reason, date: new Date().toISOString() });
    saveWarnings();
    message.channel.send(`⚠️ ${member.user.tag} has been warned. Reason: ${reason}`);
  } else if (command === '$warnings') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to check warnings.');
    const userWarnings = warnings[member.id] || [];
    if (!userWarnings.length) return message.channel.send(`📄 ${member.user.tag} has no warnings.`);
    let reply = `📄 Warnings for ${member.user.tag}:\n`;
    userWarnings.forEach((w, i) => {
      reply += `${i + 1}. ${w.reason} | ${new Date(w.date).toLocaleString()}\n`;
    });
    message.channel.send(reply);
  }

  // ---- Clear ----
  else if (command === '$clear') {
    const count = parseInt(args[0]);
    if (!count || isNaN(count)) return message.reply('⚠️ Please provide a valid number of messages to delete.');
    message.channel.bulkDelete(count, true)
      .then(() => message.channel.send(`🧹 Deleted ${count} messages.`).then(msg => setTimeout(() => msg.delete(), 5000)));
  }

  // ---- Lock / Unlock ----
  else if (command === '$lock') {
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false })
      .then(() => message.channel.send('🔒 Channel locked.'));
  } else if (command === '$unlock') {
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true })
      .then(() => message.channel.send('🔓 Channel unlocked.'));
  }

  // ---- Slowmode ----
  else if (command === '$slowmode') {
    const seconds = parseInt(args[0]);
    if (!seconds || isNaN(seconds)) return message.reply('⚠️ Provide a valid number of seconds.');
    message.channel.setRateLimitPerUser(seconds)
      .then(() => message.channel.send(`🐌 Slowmode set to ${seconds} seconds.`));
  }

  // ---- Role management ----
  else if (command === '$role') {
    const subCommand = args[0];
    const member = message.mentions.members.first();
    const roleName = args.slice(2).join(' ');
    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!member || !role) return message.reply('⚠️ User or role not found.');
    if (subCommand === 'add') {
      member.roles.add(role).then(() => message.channel.send(`🏷️ Added role **${role.name}** to ${member.user.tag}`));
    } else if (subCommand === 'remove') {
      member.roles.remove(role).then(() => message.channel.send(`🏷️ Removed role **${role.name}** from ${member.user.tag}`));
    } else {
      message.reply('⚠️ Use `$role add @user <role>` or `$role remove @user <role>`');
    }
  }

  // ---- Unauthorized ----
  else if (command === '$unauthorized') {
    message.channel.send('❌ You are not authorized to do that!');
  }

  // ---- Haunt ----
  else if (command === '$haunt') {
    if (hauntedChannels.has(message.channel.id)) return message.channel.send('👻 Already haunting this channel!');
    hauntedChannels.add(message.channel.id);
    message.channel.send('💀 The haunting has begun...');
    const interval = setInterval(() => {
      if (!hauntedChannels.has(message.channel.id)) return clearInterval(interval);
      message.channel.send(spookyMessages[Math.floor(Math.random() * spookyMessages.length)]);
    }, 30000);
    hauntIntervals.set(message.channel.id, interval);
  } else if (command === '$unhaunt') {
    hauntedChannels.delete(message.channel.id);
    if (hauntIntervals.has(message.channel.id)) {
      clearInterval(hauntIntervals.get(message.channel.id));
      hauntIntervals.delete(message.channel.id);
    }
    message.channel.send('🕯️ The spirits have left...');
  }

  // ---- Info & Tools ----
  else if (command === '$userinfo') {
    const user = message.mentions.users.first() || message.author;
    message.channel.send(`🧑‍💼 Username: ${user.username}\nID: ${user.id}`);
  } else if (command === '$avatar') {
    const user = message.mentions.users.first() || message.author;
    message.channel.send(`🖼️ Avatar for ${user.username}: ${user.displayAvatarURL({ dynamic: true })}`);
  } else if (command === '$serverinfo') {
    message.channel.send(`🏠 Server: ${message.guild.name}\nMembers: ${message.guild.memberCount}`);
  } else if (command === '$shout') {
    const text = args.join(' ');
    if (!text) return message.reply('📢 What should I shout?');
    message.channel.send(`📢 **${text.toUpperCase()}**`);
  } else if (command === '$spoiler') {
    const text = args.join(' ');
    if (!text) return message.reply('🤐 What should I hide?');
    message.channel.send(`||${text}||`);
  } else if (command === '$say') {
    const text = args.join(' ');
    if (!text) return message.reply('📣 What should I say?');
    message.channel.send(text);
  } else if (command === '$send') {
    const channelId = args.shift();
    if (!channelId) return message.reply('⚠️ Provide the channel ID.');
    const text = args.join(' ');
    if (!text) return message.reply('⚠️ Provide a message to send.');
    const channel = client.channels.cache.get(channelId);
    if (!channel || channel.type !== 0) return message.reply('⚠️ Channel not found or not text-based.');
    channel.send(text).then(() => message.reply(`✅ Message sent to <#${channelId}>`));
  } else if (command === '$prefix') {
    message.channel.send(`📌 The current prefix is: \`$\``);
  }

  // ---- Blackjack ----
  else if (command === '$blackjack') {
    if (blackjackGames.has(message.author.id)) return message.reply('⚠️ You already have a game! Use `$hit` or `$stand`.');
    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];
    blackjackGames.set(message.author.id, { playerHand, dealerHand });

    const playerTotal = handValue(playerHand);
    let msg = `🃏 **Blackjack Started!** 🃏\n\n` +
      `**Your hand:** ${formatHand(playerHand)} (Total: ${playerTotal})\n` +
      `**Dealer’s hand:** ${dealerHand[0].value}${dealerHand[0].suit} ??\n\n` +
      `👉 Type \`$hit\` or \`$stand\``;
    message.channel.send(msg);
  } else if (command === '$hit') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply('⚠️ No active game. Start one with `$blackjack`.');
    game.playerHand.push(drawCard());
    const playerTotal = handValue(game.playerHand);

    let msg = `**Your hand:** ${formatHand(game.playerHand)} (Total: ${playerTotal})`;
    if (playerTotal > 21) {
      msg += `\n💥 You busted! Dealer wins.`;
      blackjackGames.delete(message.author.id);
    } else {
      msg += `\n👉 Type \`$hit\` or \`$stand\``;
    }
    message.channel.send(msg);
  } else if (command === '$stand') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply('⚠️ No active game. Start one with `$blackjack`.');

    const dealerHand = game.dealerHand;
    let dealerTotal = handValue(dealerHand);
    while (dealerTotal < 17) {
      dealerHand.push(drawCard());
      dealerTotal = handValue(dealerHand);
    }

    const playerTotal = handValue(game.playerHand);
    let result = `**Your hand:** ${formatHand(game.playerHand)} (Total: ${playerTotal})\n` +
      `**Dealer’s hand:** ${formatHand(dealerHand)} (Total: ${dealerTotal})\n\n`;

    if (playerTotal > 21) result += `💥 You busted! Dealer wins.`;
    else if (dealerTotal > 21) result += `🎉 Dealer busted! You win!`;
    else if (playerTotal > dealerTotal) result += `🎉 You win!`;
    else if (playerTotal < dealerTotal) result += `😢 Dealer wins.`;
    else result += `🤝 It’s a tie!`;

    blackjackGames.delete(message.author.id);
    message.channel.send(result);
  }

  // ---- AI Chat ----
  else if (message.mentions.has(client.user)) {
    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    if (!prompt) return message.reply('❓ What would you like to ask?');

    try {
      await message.channel.sendTyping();
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
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
