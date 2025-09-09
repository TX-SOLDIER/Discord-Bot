require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Gemini AI

// ---- Express Keep-Alive ----
const app = express();
app.get('/', (req, res) => res.send('✅ Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Keep-alive server running on port ${PORT}`));

// ---- Discord Client ----
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
const OWNER_ID = '782155864134909952';
function isImmune(user) {
  return user.id === OWNER_ID;
}

// ---- Haunted Channels & Messages ----
const hauntedChannels = new Set();
const hauntIntervals = new Map();
const spookyMessages = [
  '👻 Boo...', '💀 I see you...', '🩸 The shadows are watching...',
  '🔪 Behind you...', '🕷️ Something crawled across your screen...',
];

// ---- Spicy Truths, Dares, Compliments ----
const spicyTruths = [
  "What’s your most embarrassing moment?", "Who was your first crush?",
  "Have you ever lied to get out of trouble?", "What’s the most childish thing you still do?",
  "What’s a secret you’ve never told anyone here?", "If you could switch lives with someone for a day, who would it be?",
  "What’s your biggest fear?", "What’s the worst thing you’ve ever eaten?",
];
const spicyDares = [
  "Change your nickname to something silly for 10 minutes.",
  "Type your next 3 messages in ALL CAPS.", "Send a random emoji in the chat every 10 seconds for 1 minute.",
  "Say something nice about the last person who spoke.", "Do 10 pushups (or pretend to and tell us how it went).",
  "Put your status to 'I love pineapples on pizza' for 1 hour.", "Send a gif that describes your current mood.",
  "Use only memes to communicate for the next 5 minutes.",
];
const compliments = [
  "You have great taste in music.", "Your energy makes the chat better.", "You’re really funny!",
  "You’re smarter than you give yourself credit for.", "You have an amazing vibe.", "You’re one of the kindest people I’ve seen here.",
  "I admire how confident you are.", "You always make people feel welcome.",
];

// ---- Persistent Warnings ----
const warningsFile = './warnings.json';
let warnings = {};
if (fs.existsSync(warningsFile)) warnings = JSON.parse(fs.readFileSync(warningsFile, 'utf8'));
function saveWarnings() { fs.writeFileSync(warningsFile, JSON.stringify(warnings, null, 2)); }

// ---- Blackjack Helpers ----
const blackjackGames = new Map();
function drawCard() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  return { suit: suits[Math.floor(Math.random()*suits.length)], value: values[Math.floor(Math.random()*values.length)] };
}
function cardValue(card) { if (['J','Q','K'].includes(card.value)) return 10; if(card.value==='A') return 11; return parseInt(card.value); }
function handValue(hand) { let total=hand.reduce((s,c)=>s+cardValue(c),0), aces=hand.filter(c=>c.value==='A').length; while(total>21 && aces>0){total-=10; aces--;} return total; }
function formatHand(hand){return hand.map(c=>`${c.value}${c.suit}`).join(' ');}
// ---- Ready Event ----
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

const PREFIX = '$';

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---- Moderation Permissions Helper ----
  function checkPermission(permission) {
    if (!message.member.permissions.has(permission)) {
      message.reply('❌ You do not have permission to do that!');
      return false;
    }
    return true;
  }

  // ---- Help Command ----
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
      `🏷️ \`${PREFIX}role remove @user <role>\` — Remove role\n` +
      `❌ \`${PREFIX}unauthorized\` — Unauthorized response`;

    await message.channel.send(helpText1);

    const helpText2 = `📖 **Info & Tools**\n\n` +
      `🧑‍💼 \`${PREFIX}userinfo\` — User info\n` +
      `🖼️ \`${PREFIX}avatar @user\` — Avatar\n` +
      `🏠 \`${PREFIX}serverinfo\` — Server info\n` +
      `📢 \`${PREFIX}shout [msg]\` — Shout\n` +
      `🤐 \`${PREFIX}spoiler [msg]\` — Spoiler\n` +
      `📣 \`${PREFIX}say [msg]\` — Echo\n` +
      `✉️ \`${PREFIX}send <channelID> <message>\` — Send to another server/channel`;
    return message.channel.send(helpText2);
  }

  // ---- Utility Commands ----
  else if (command === 'ping') {
    const sent = await message.channel.send('Pinging...');
    sent.edit(`🏓 Pong! Latency is ${sent.createdTimestamp - message.createdTimestamp}ms`);
  } else if (command === 'stats') {
    message.channel.send(`📊 Server has ${message.guild.memberCount} members.`);
  } else if (command === 'uptime') {
    const uptime = Math.floor(process.uptime());
    message.channel.send(`⏱️ Bot uptime: ${uptime} seconds.`);
  } else if (command === 'botinfo') {
    message.channel.send(`🤖 I am ${client.user.tag}, your friendly bot helper!`);
  } else if (command === 'invite') {
    message.channel.send('🔗 Invite me: https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands');
  } else if (command === 'prefix') {
    message.channel.send(`📌 The current prefix is: \`${PREFIX}\``);
  }

  // ---- Fun & Games Commands ----
  else if (command === 'flip') {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    message.channel.send(`🪙 You flipped **${result}**!`);
  } else if (command === '8ball') {
    const responses = ['Yes.', 'No.', 'Maybe.', 'Ask again later.', 'Definitely!', 'I don’t think so.'];
    if (!args.length) return message.reply('🎱 Ask me a question.');
    message.channel.send(`🎱 ${responses[Math.floor(Math.random() * responses.length)]}`);
  } else if (command === 'dice') {
    const roll = Math.floor(Math.random() * 6) + 1;
    message.channel.send(`🎲 You rolled a **${roll}**!`);
  } else if (command === 'rate') {
    const user = message.mentions.users.first() || message.author;
    const rating = Math.floor(Math.random() * 11);
    message.channel.send(`🎯 I rate ${user.username} a **${rating}/10**!`);
  } else if (command === 'howgay') {
    const user = message.mentions.users.first() || message.author;
    const gayness = Math.floor(Math.random() * 101);
    message.channel.send(`🌈 ${user.username} is **${gayness}%** gay!`);
  } else if (command === 'sus') {
    const user = message.mentions.users.first() || message.author;
    const sus = Math.floor(Math.random() * 101);
    message.channel.send(`🕵️ ${user.username} is **${sus}%** sus!`);
  } else if (command === 'truth') {
    message.channel.send(`💬 Truth: ${spicyTruths[Math.floor(Math.random() * spicyTruths.length)]}`);
  } else if (command === 'dare') {
    message.channel.send(`😈 Dare: ${spicyDares[Math.floor(Math.random() * spicyDares.length)]}`);
  } else if (command === 'roast') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('🔥 Tag someone to roast.');
    const roasts = [
      'You bring everyone so much joy… when you leave the room.',
      'If I had a face like yours, I’d sue my parents.',
      'You’re as useless as the “ueue” in “queue.”',
      'You have something on your chin... no, the third one down.',
    ];
    message.channel.send(`🔥 ${user.username}, ${roasts[Math.floor(Math.random() * roasts.length)]}`);
  } else if (command === 'compliment') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('💖 Tag someone to compliment.');
    message.channel.send(`💖 ${user.username}, ${compliments[Math.floor(Math.random() * compliments.length)]}`);
                                                                       }

          // ---- Haunt Commands ----
  else if (command === 'haunt') {
    if (hauntedChannels.has(message.channel.id)) return message.channel.send('👻 Already haunting this channel!');
    hauntedChannels.add(message.channel.id);
    message.channel.send('💀 The haunting has begun...');
    const interval = setInterval(() => {
      if (!hauntedChannels.has(message.channel.id)) return clearInterval(interval);
      message.channel.send(spookyMessages[Math.floor(Math.random() * spookyMessages.length)]);
    }, 30000);
    hauntIntervals.set(message.channel.id, interval);
  } else if (command === 'unhaunt') {
    hauntedChannels.delete(message.channel.id);
    if (hauntIntervals.has(message.channel.id)) {
      clearInterval(hauntIntervals.get(message.channel.id));
      hauntIntervals.delete(message.channel.id);
    }
    message.channel.send('🕯️ The spirits have left...');
  }

  // ---- Blackjack Commands ----
  else if (command === 'blackjack') {
    if (blackjackGames.has(message.author.id)) return message.reply('⚠️ You already have a game! Use `$hit` or `$stand`.');
    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];
    blackjackGames.set(message.author.id, { playerHand, dealerHand });
    const playerTotal = handValue(playerHand);
    const msg = `🃏 **Blackjack Started!** 🃏\n\n` +
      `**Your hand:** ${formatHand(playerHand)} (Total: ${playerTotal})\n` +
      `**Dealer’s hand:** ${dealerHand[0].value}${dealerHand[0].suit} ??\n\n` +
      `👉 Type \`$hit\` or \`$stand\``;
    message.channel.send(msg);
  } else if (command === 'hit') {
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
  } else if (command === 'stand') {
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

  // ---- AI Chat with Google Gemini ----
  else if (message.mentions.has(client.user.id)) {
    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    if (!prompt) return message.reply('❓ What would you like to ask?');

    try {
      await message.channel.sendTyping();
      const reply = await askGemini(prompt);
      await message.reply(reply);
    } catch (err) {
      console.error('❌ Error sending Gemini reply:', err);
      message.reply('🚫 Something went wrong with the AI.');
    }
  }

  // ---- Moderation Commands ----
  else if (command === 'kick') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🔨 Tag a user to kick.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.KickMembers)) return;
    const reason = args.join(' ') || 'No reason provided';
    target.kick(reason)
      .then(() => message.reply(`✅ Kicked ${target.user.tag}. Reason: ${reason}`))
      .catch(() => message.reply('❌ Cannot kick this user.'));
  } else if (command === 'ban') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🚫 Tag a user to ban.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.BanMembers)) return;
    const reason = args.join(' ') || 'No reason provided';
    target.ban({ reason })
      .then(() => message.reply(`✅ Banned ${target.user.tag}. Reason: ${reason}`))
      .catch(() => message.reply('❌ Cannot ban this user.'));
  } else if (command === 'mute') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🤐 Tag a user to mute.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.MuteMembers)) return;
    const time = args[1] ? parseInt(args[1]) * 1000 : 600000; // default 10 minutes
    target.timeout(time, 'Muted by bot')
      .then(() => message.reply(`✅ Muted ${target.user.tag}${time ? ` for ${args[1]} seconds` : ''}.`))
      .catch(() => message.reply('❌ Cannot mute this user.'));
  } else if (command === 'unmute') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🔊 Tag a user to unmute.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.MuteMembers)) return;
    target.timeout(null, 'Unmuted by bot')
      .then(() => message.reply(`✅ Unmuted ${target.user.tag}.`))
      .catch(() => message.reply('❌ Cannot unmute this user.'));
  }

  // ---- Persistent Warnings ----
  else if (command === 'warn') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Tag a user to warn.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.KickMembers)) return;
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (!warnings[target.id]) warnings[target.id] = [];
    warnings[target.id].push({ reason, date: new Date().toISOString(), mod: message.author.tag });
    saveWarnings();
    message.reply(`⚠️ Warned ${target.user.tag}. Reason: ${reason}`);
  } else if (command === 'warnings') {
    const target = message.mentions.members.first() || message.member;
    const userWarnings = warnings[target.id] || [];
    if (!userWarnings.length) return message.reply('ℹ️ No warnings found.');
    let text = `⚠️ Warnings for ${target.user.tag}:\n`;
    userWarnings.forEach((w, i) => text += `${i + 1}. [${w.date}] ${w.mod}: ${w.reason}\n`);
    message.channel.send(text);
  }

  // ---- Clear, Lock, Unlock, Slowmode ----
  else if (command === 'clear') {
    if (!checkPermission(PermissionsBitField.Flags.ManageMessages)) return;
    const count = parseInt(args[0]);
    if (!count || count < 1 || count > 100) return message.reply('❌ Enter a number between 1-100.');
    message.channel.bulkDelete(count, true)
      .then(() => message.reply(`🧹 Deleted ${count} messages.`))
      .catch(() => message.reply('❌ Cannot delete messages.'));
  } else if (command === 'lock') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false })
      .then(() => message.reply('🔒 Channel locked.'))
      .catch(() => message.reply('❌ Cannot lock this channel.'));
  } else if (command === 'unlock') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true })
      .then(() => message.reply('🔓 Channel unlocked.'))
      .catch(() => message.reply('❌ Cannot unlock this channel.'));
  } else if (command === 'slowmode') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    const time = parseInt(args[0]);
    if (isNaN(time) || time < 0 || time > 21600) return message.reply('❌ Enter a valid number (0-21600 seconds).');
    message.channel.setRateLimitPerUser(time)
      .then(() => message.reply(`🐌 Slowmode set to ${time} seconds.`))
      .catch(() => message.reply('❌ Cannot set slowmode.'));
  }

  // ---- Role Management ----
  else if (command === 'role') {
    const subcommand = args.shift();
    const target = message.mentions.members.first();
    if (!target) return message.reply('🏷️ Tag a user.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    const roleName = args.join(' ');
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (!role) return message.reply('❌ Role not found.');
    if (!checkPermission(PermissionsBitField.Flags.ManageRoles)) return;
    if (subcommand === 'add') {
      target.roles.add(role)
        .then(() => message.reply(`✅ Added role ${role.name} to ${target.user.tag}.`))
        .catch(() => message.reply('❌ Cannot add role.'));
    } else if (subcommand === 'remove') {
      target.roles.remove(role)
        .then(() => message.reply(`✅ Removed role ${role.name} from ${target.user.tag}.`))
        .catch(() => message.reply('❌ Cannot remove role.'));
    } else {
      message.reply('❌ Use `$role add @user <role>` or `$role remove @user <role>`');
    }
  }

  // ---- Unknown Command ----
  else {
    if (!message.content.startsWith(PREFIX)) return;
    message.reply('❌ Unknown command or you do not have permission.');
  }

}); // ---- End of messageCreate ----

// ---- Bot Login ----
client.login(process.env.BOT_TOKEN);
