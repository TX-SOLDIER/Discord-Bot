require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Gemini import

// ---- Keep-alive Server ----
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
function isImmune(user) { return user.id === OWNER_ID; }

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
if (fs.existsSync(warningsFile)) { warnings = JSON.parse(fs.readFileSync(warningsFile, 'utf8')); }
function saveWarnings() { fs.writeFileSync(warningsFile, JSON.stringify(warnings, null, 2)); }

// ---- Blackjack Game Helpers ----
const blackjackGames = new Map();
function drawCard() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  return { suit: suits[Math.floor(Math.random() * suits.length)], value: values[Math.floor(Math.random() * values.length)] };
}
function cardValue(card) { 
  if(['J','Q','K'].includes(card.value)) return 10; 
  if(card.value==='A') return 11; 
  return parseInt(card.value); 
}
function handValue(hand) {
  let total = hand.reduce((sum,c)=>sum+cardValue(c),0);
  let aces = hand.filter(c=>c.value==='A').length;
  while(total>21 && aces>0){ total-=10; aces--; }
  return total;
}
function formatHand(hand){ return hand.map(c=>`${c.value}${c.suit}`).join(' '); }

// ---- Ready Event ----
client.once('ready', ()=>{ console.log(`✅ Logged in as ${client.user.tag}`); });

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

  // ---- Fun & Utility Commands ----
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
  } else if (command === 'flip') {
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

   // ---- Haunt Command ----
  else if (command === 'haunt') {
    if (hauntedUsers.has(message.author.id)) {
      return message.reply('👻 You are already haunting someone!');
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply('👻 Mention someone to haunt.');
    hauntedUsers.set(message.author.id, user.id);
    message.channel.send(`👻 ${message.author.username} is now haunting ${user.username}!`);
  } else if (command === 'unhaunt') {
    if (!hauntedUsers.has(message.author.id)) {
      return message.reply('❌ You are not haunting anyone.');
    }
    hauntedUsers.delete(message.author.id);
    message.channel.send(`✅ ${message.author.username} has stopped haunting.`);
  }

  // ---- Blackjack ----
  else if (command === 'blackjack') {
    if (blackjackGames.has(message.author.id)) {
      return message.reply('🃏 You already have a game in progress! Use `!hit` or `!stand`.');
    }

    const deck = createDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    blackjackGames.set(message.author.id, { deck, playerHand, dealerHand });

    message.channel.send(
      `🃏 Blackjack started!\nYour hand: ${handToString(playerHand)}\nDealer shows: ${dealerHand[0]}`
    );
  } else if (command === 'hit') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply('❌ You don’t have a game in progress.');

    game.playerHand.push(game.deck.pop());

    const playerValue = handValue(game.playerHand);
    if (playerValue > 21) {
      blackjackGames.delete(message.author.id);
      return message.channel.send(
        `💥 You busted with ${handToString(game.playerHand)} (value ${playerValue})! Dealer wins.`
      );
    }

    message.channel.send(
      `👉 You hit: ${handToString(game.playerHand)} (value ${playerValue})`
    );
  } else if (command === 'stand') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply('❌ You don’t have a game in progress.');

    let dealerValue = handValue(game.dealerHand);
    while (dealerValue < 17) {
      game.dealerHand.push(game.deck.pop());
      dealerValue = handValue(game.dealerHand);
    }

    const playerValue = handValue(game.playerHand);
    blackjackGames.delete(message.author.id);

    message.channel.send(
      `🏁 Final Hands:\n` +
      `You: ${handToString(game.playerHand)} (value ${playerValue})\n` +
      `Dealer: ${handToString(game.dealerHand)} (value ${dealerValue})`
    );

    if (dealerValue > 21 || playerValue > dealerValue) {
      message.channel.send('🎉 You win!');
    } else if (playerValue < dealerValue) {
      message.channel.send('😢 Dealer wins!');
    } else {
      message.channel.send('🤝 It’s a tie!');
    }
  }

  // ---- Moderation ----
  else if (command === 'kick') {
    if (!checkPermission(PermissionsBitField.Flags.KickMembers)) return;
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mention a user to kick.');
    await user.kick(args.slice(1).join(' ') || 'No reason provided');
    message.channel.send(`👢 ${user.user.username} was kicked.`);
  } else if (command === 'ban') {
    if (!checkPermission(PermissionsBitField.Flags.BanMembers)) return;
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mention a user to ban.');
    await user.ban({ reason: args.slice(1).join(' ') || 'No reason provided' });
    message.channel.send(`⛔ ${user.user.username} was banned.`);
  } else if (command === 'mute') {
    if (!checkPermission(PermissionsBitField.Flags.ModerateMembers)) return;
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mention a user to mute.');
    const time = parseInt(args[1]) || 10;
    await user.timeout(time * 1000, 'Muted by command');
    message.channel.send(`🤐 ${user.user.username} was muted for ${time} seconds.`);
  } else if (command === 'unmute') {
    if (!checkPermission(PermissionsBitField.Flags.ModerateMembers)) return;
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mention a user to unmute.');
    await user.timeout(null);
    message.channel.send(`🔊 ${user.user.username} was unmuted.`);
  } else if (command === 'warn') {
    if (!checkPermission(PermissionsBitField.Flags.ModerateMembers)) return;
    const user = message.mentions.users.first();
    if (!user) return message.reply('❌ Mention a user to warn.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (!warnings[user.id]) warnings[user.id] = [];
    warnings[user.id].push(reason);
    fs.writeFileSync('./warnings.json', JSON.stringify(warnings, null, 2));
    message.channel.send(`⚠️ ${user.username} was warned: ${reason}`);
  } else if (command === 'warnings') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('❌ Mention a user to check warnings.');
    const userWarnings = warnings[user.id] || [];
    if (userWarnings.length === 0) {
      return message.channel.send(`✅ ${user.username} has no warnings.`);
    }
    message.channel.send(`⚠️ ${user.username} has warnings:\n- ${userWarnings.join('\n- ')}`);
  } else if (command === 'clear') {
    if (!checkPermission(PermissionsBitField.Flags.ManageMessages)) return;
    const amount = parseInt(args[0]);
    if (!amount || isNaN(amount)) return message.reply('❌ Enter a number of messages to delete.');
    await message.channel.bulkDelete(amount, true);
    message.channel.send(`🧹 Deleted ${amount} messages.`);
  } else if (command === 'lock') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
    message.channel.send('🔒 Channel locked.');
  } else if (command === 'unlock') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: true });
    message.channel.send('🔓 Channel unlocked.');
  } else if (command === 'slowmode') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    const time = parseInt(args[0]) || 0;
    await message.channel.setRateLimitPerUser(time);
    message.channel.send(`🐌 Slowmode set to ${time} seconds.`);
  } else if (command === 'role') {
    if (!checkPermission(PermissionsBitField.Flags.ManageRoles)) return;
    const action = args[0];
    const member = message.mentions.members.first();
    const roleName = args.slice(2).join(' ');
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (!member || !role) return message.reply('❌ Usage: `!role add/remove @user <role name>`');

    if (action === 'add') {
      await member.roles.add(role);
      message.channel.send(`🏷️ Added role ${role.name} to ${member.user.username}`);
    } else if (action === 'remove') {
      await member.roles.remove(role);
      message.channel.send(`🏷️ Removed role ${role.name} from ${member.user.username}`);
    } else {
      message.reply('❌ Use `add` or `remove`.');
    }
  }       

  // ---- Info & Tools ----
  else if (command === 'userinfo') {
    const user = message.mentions.users.first() || message.author;
    const member = message.guild.members.cache.get(user.id);
    message.channel.send(
      `🧑‍💼 **User Info**\n` +
      `Username: ${user.tag}\nID: ${user.id}\nJoined: ${member.joinedAt}`
    );
  } else if (command === 'avatar') {
    const user = message.mentions.users.first() || message.author;
    message.channel.send(user.displayAvatarURL({ size: 512 }));
  } else if (command === 'serverinfo') {
    message.channel.send(
      `🏠 **Server Info**\nName: ${message.guild.name}\nID: ${message.guild.id}\nMembers: ${message.guild.memberCount}`
    );
  } else if (command === 'shout') {
    if (!args.length) return message.reply('📢 Provide a message.');
    message.channel.send(`📢 **${args.join(' ').toUpperCase()}**`);
  } else if (command === 'spoiler') {
    if (!args.length) return message.reply('🤐 Provide a message.');
    message.channel.send(`||${args.join(' ')}||`);
  } else if (command === 'say') {
    if (!args.length) return message.reply('💬 Provide a message.');
    message.channel.send(args.join(' '));
  } else if (command === 'send') {
    if (!checkPermission(PermissionsBitField.Flags.Administrator)) return;
    const channelId = args[0];
    const text = args.slice(1).join(' ');
    const targetChannel = client.channels.cache.get(channelId);
    if (!targetChannel) return message.reply('❌ Invalid channel ID.');
    targetChannel.send(text);
    message.reply(`✅ Message sent to <#${channelId}>`);
  }
});

// ---- AI Chat (OpenRouter + Gemini) ----
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.mentions.has(client.user)) return;

  const prompt = message.content.replace(`<@!${client.user.id}>`, '').trim();
  if (!prompt) return message.reply('💬 Ask me something!');

  try {
    // ---- OpenRouter API ----
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      return message.reply(data.choices[0].message.content);
    }

    // ---- Gemini Fallback ----
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return message.reply(result.response.text());
  } catch (err) {
    console.error('AI Error:', err);
    message.reply('❌ AI chat failed.');
  }
});

// ---- Keep-alive server (only once, no duplicates) ----
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Bot is running!'));
app.listen(PORT, () => console.log(`✅ Keep-alive server running on port ${PORT}`));

// ---- Bot Login ----
client.login(process.env.TOKEN);
