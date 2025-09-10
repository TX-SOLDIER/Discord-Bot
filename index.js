require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Gemini AI

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

// ---- Google Gemini AI Setup ----
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// ---- Owner Immunity ----
const OWNER_ID = '782155864134909952';
function isImmune(user) {
  return user.id === OWNER_ID;
}

// ---- Data ----
const hauntedChannels = new Set();
const hauntIntervals = new Map();
const spookyMessages = [
  '👻 Boo...', '💀 I see you...', '🩸 The shadows are watching...',
  '🔪 Behind you...', '🕷️ Something crawled across your screen...',
];

// ---- Truth Questions ----
const spicyTruths = [
  "What’s your most embarrassing moment?",
  "Who was your first crush?",
  "Have you ever lied to get out of trouble?",
  "What’s the most childish thing you still do?",
  "What’s a secret you’ve never told anyone here?",
  "If you could switch lives with someone for a day, who would it be?",
  "What’s your biggest fear?",
  "What’s the worst thing you’ve ever eaten?",
  "Have you ever stolen something?",
  "What's the most awkward date you've been on?",
  "Have you ever pretended to like a gift you hated?",
  "What's the weirdest habit you have?",
  "Have you ever had a crush on a teacher?",
  "What's your guilty pleasure TV show or movie?",
  "Have you ever broken something and blamed someone else?",
  "What's a lie you told that got out of hand?",
  "Have you ever had a really embarrassing dream?",
  "What's something you regret saying?",
  "What's your weirdest fear?",
  "Have you ever cried in public?",
  "What's the most trouble you've gotten into at school or work?",
  "Have you ever ghosted someone?",
  "What's something that instantly annoys you?",
  "What's the most awkward thing you've said to a crush?",
  "Have you ever pretended to be sick to skip something?",
  "What's the worst date you've ever been on?",
  "Have you ever peeked at someone else's messages?",
  "What's the most embarrassing thing in your search history?",
  "Have you ever lied about your age?",
  "What's the dumbest thing you've argued about?",
  "Have you ever laughed at the wrong moment?",
  "What's a habit you wish you could quit?",
  "Have you ever accidentally insulted someone?",
  "What's the strangest nickname you've had?",
  "Have you ever cheated in a game or test?",
  "What's the most awkward text you've sent?",
  "Have you ever stalked someone online?",
  "What's your most embarrassing social media post?",
  "Have you ever cried over a fictional character?",
  "What's the weirdest dream you've had?",
  "Have you ever been caught doing something embarrassing?",
  "What's a secret talent no one knows about?",
  "Have you ever forgotten someone's name immediately after they told you?",
  "What's the most childish thing you still enjoy?",
  "Have you ever blamed someone else for your mistake?",
  "What's the most embarrassing outfit you've worn?",
  "Have you ever had a crush on a friend's sibling?",
  "What's the silliest argument you've had?",
  "Have you ever sent a message to the wrong person?",
  "What's a fear you think is irrational?",
  "Have you ever laughed at a serious situation?",
  "What's a food you secretly love but are embarrassed to admit?",
  "Have you ever pretended to understand something you didn’t?",
  "What's the weirdest habit you have?",
  "Have you ever cried in public for no reason?",
  "What's the most embarrassing ringtone or alarm you've had?",
  "Have you ever pretended to know a celebrity?",
  "What's a guilty pleasure you’re ashamed to admit?",
  "Have you ever re-gifted a present?",
  "What's the most awkward family moment you've experienced?",
  "Have you ever been caught talking to yourself?",
  "What's a song you secretly love but wouldn't admit?",
  "Have you ever been embarrassed by your own laughter?",
  "What's the weirdest lie you've told to avoid trouble?",
  "Have you ever tripped or fallen in public?",
  "What's the most embarrassing thing you've done for money?",
  "Have you ever accidentally called someone by the wrong name?",
  "What's the most awkward compliment you've received?",
  "Have you ever lied about knowing something you didn't?",
  "What's your most cringe-worthy memory from school?",
  "Have you ever been scared of a harmless animal?",
  "What's the weirdest nickname you’ve given someone?",
  "Have you ever been embarrassed by your own voice?",
  "What's a secret you've never told anyone?"
];
// ---- Spicy Dares ----
const spicyDares = [
  "Change your nickname to something silly for 10 minutes.",
  "Type your next 3 messages in ALL CAPS.",
  "Send a random emoji in the chat every 10 seconds for 1 minute.",
  "Say something nice about the last person who spoke.",
  "Do 10 pushups (or pretend to and tell us how it went).",
  "Put your status to 'I love pineapples on pizza' for 1 hour.",
  "Send a gif that describes your current mood.",
  "Use only memes to communicate for the next 5 minutes.",
  "Post a selfie with your funniest face.",
  "Call a friend and tell them a random joke.",
  "Change your nickname to a movie character for 30 minutes.",
  "Do an impression of someone in the chat.",
  "Send a message only using emojis for the next 5 messages.",
  "Pretend to be a robot for the next 3 messages.",
  "Share your most embarrassing photo.",
  "Act like a celebrity of your choice for 2 minutes.",
  "Do a silly dance on camera (or describe it in chat).",
  "Use a funny voice for your next 3 messages.",
  "Write a short poem about someone in the chat.",
  "Send the last song you listened to in chat.",
  "Send a voice note saying 'I love chocolate' in a funny voice.",
  "Post a random selfie in the chat.",
  "Pretend to be a celebrity for the next 2 messages.",
  "Send a random meme in chat right now.",
  "Act like a robot for the next 3 messages.",
  "Send a GIF that perfectly represents your mood.",
  "Change your nickname to a silly phrase for 30 minutes.",
  "Use only emojis for the next 5 messages.",
  "Do a silly dance on camera or describe it in chat.",
  "Call a friend and tell them a funny joke.",
  "Send a message using only song lyrics.",
  "Pretend to sing everything you say for 3 messages.",
  "Draw something silly and post a picture of it.",
  "Make a funny sound effect for the next 3 messages.",
  "Act like an animal for the next 5 messages.",
  "Send a random emoji every 10 seconds for 1 minute.",
  "Type your next message in a different language.",
  "Pretend you’re a news reporter and report on the chat.",
  "Do 5 pushups and post how it went.",
  "Change your status to something ridiculous for 1 hour.",
  "Send a selfie making a silly face.",
  "Pretend to sing everything you say for 3 messages.",
  "Write a short poem about the last person who spoke.",
  "Post the first thing that comes to your mind right now.",
  "Speak like a robot for the next 3 messages.",
  "Send a GIF that best describes your last meal.",
  "Post a funny animal picture.",
  "Type your next message backward.",
  "Send a message using only your favorite color as emojis.",
  "Pretend to be a teacher for 2 minutes.",
  "Do 10 jumping jacks and tell us how it felt.",
  "Make a silly handshake with the last person who spoke (describe it).",
  "Pretend to be a character from a movie for 3 messages.",
  "Send a GIF of your favorite TV show scene.",
  "Describe your most embarrassing moment in 3 words.",
  "Send a random fact nobody knows.",
  "Make your next message a tongue twister.",
  "Speak like a pirate for the next 3 messages.",
  "Post a meme describing your last 5 minutes.",
  "Send a random emoji combination that makes no sense.",
  "Pretend your keyboard is a piano for the next 2 messages.",
  "Write a haiku about your favorite snack.",
  "Describe your current mood using only emojis.",
  "Send a message like you’re a robot in distress.",
  "Do a dramatic reading of your last message.",
  "Pretend to be a cat for the next 3 messages.",
  "Send a random screenshot from your camera roll.",
  "Use only abbreviations for the next 3 messages.",
  "Post a funny photo of your shoes.",
  "Talk like a news anchor for 2 messages.",
  "Send a message complimenting someone in the chat."
];

// ---- Compliments ----
const compliments = [
  "You have great taste in music.",
  "Your energy makes the chat better.",
  "You are so damn fine.",
  "If you were a snack id eat u up.",
  "You have an amazing vibe.",
  "You’re one of the kindest people I’ve seen here.",
  "I admire how confident you are.",
  "You always make people feel welcome.",
  "Your smile is contagious.",
  "You always know how to cheer people up.",
  "You have a great sense of humor.",
  "You're so cute...and yummy.",
  "Your body is....*bites lip*.",
  "You make everyone feel comfortable.",
  "Your positivity is refreshing.",
  "You're incredibly thoughtful.",
  "I wish u were mine.",
  "You have an amazing energy.",
  "You're genuinely kind-hearted.",
  "You make people feel valued.",
  "You have a contagious laugh.",
  "Your positivity is inspiring.",
  "You always know the right thing to say.",
  "You have an amazing sense of humor.",
  "Your creativity is off the charts.",
  "You make everyone feel comfortable.",
  "You’re a great problem solver.",
  "Your kindness is impressive.",
  "You have a fantastic smile.",
  "You are incredibly thoughtful.",
  "Your energy is uplifting.",
  "You’re a natural leader.",
  "You’re always so reliable.",
  "Your confidence is admirable.",
  "You make people feel valued.",
  "You have excellent taste in fashion.",
  "Your advice is always solid.",
  "You’re very charming.",
  "You have a brilliant mind.",
  "You make everything more fun.",
  "Your empathy is remarkable.",
  "You’re an amazing friend.",
  "You’re so patient with others.",
  "You have a great perspective on life.",
  "Your jokes always hit the mark.",
  "You’re very encouraging.",
  "You have a beautiful soul.",
  "You’re incredibly witty.",
  "You’re always full of surprises.",
  "You handle challenges gracefully.",
  "Your enthusiasm is contagious.",
  "You’re genuinely kind.",
  "You inspire others effortlessly.",
  "Your loyalty is admirable.",
  "You’re incredibly talented.",
  "You make me crave u. can u be my snack?.",
  "You bring out the best in people.",
  "You’re extremely thoughtful.",
  "You are hawt.",
  "You always make people feel included.",
  "You are so yummy.",
  "You’re a fantastic listener.",
  "You turn me on.",
  "You have an amazing vibe.",
  "You’re sexy af.",
  "You make the world a better place.",
  "You have a warm heart.",
  "You’re very considerate.",
  "Your presence brightens the room.",
  "You’re unforgettable.",
  "You have a dangerously attractive smile.",
  "There’s something about your voice that makes it impossible to ignore.",
  "You look absolutely irresistible tonight.",
  "Your confidence is incredibly sexy.",
  "You have a presence that makes everyone want to get closer."
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

// ---- Question of the Day (QOTD) ----
const qotdQuestions = [
  "What’s your dream vacation destination?",
  "If you could have any superpower, what would it be?",
  "What’s a small thing that makes you happy?",
  "What’s your favorite childhood memory?",
  "If you could live in any time period, which one would you choose?",
  "What’s the best advice you’ve ever received?",
  "What song always boosts your mood?",
  "If you could instantly master a skill, what would it be?",
  "What’s the weirdest food combination you enjoy?",
  "Who in history would you want to meet?"
];

// Keep track of enabled QOTD channels
const qotdChannels = new Set();
let qotdIndex = 0;

// ---- Discord Client Setup ----
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const prefix = '!'; // Change your bot prefix here

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}!`);

  // Start QOTD loop every 24 hours
  setInterval(() => {
    qotdChannels.forEach(async (channelId) => {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) return;
      const question = qotdQuestions[qotdIndex];
      await channel.send(`🌟 **Question of the Day:** ${question}`);
      qotdIndex = (qotdIndex + 1) % qotdQuestions.length;
    });
  }, 24 * 60 * 60 * 1000); // 24 hours
});

// ---- Message Handler ----
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // QOTD Command
  if (message.content.startsWith(`${prefix}qotd`)) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply("❌ You don't have permission to do that.");
    }

    const args = message.content.split(' ').slice(1);
    if (args[0] === 'enable') {
      qotdChannels.add(message.channel.id);
      return message.channel.send('✅ QOTD enabled in this channel.');
    } else if (args[0] === 'disable') {
      qotdChannels.delete(message.channel.id);
      return message.channel.send('✅ QOTD disabled in this channel.');
    } else {
      return message.channel.send('⚠️ Use `!qotd enable` or `!qotd disable`.');
    }
  }

  // ---- Truth Command ----
  if (message.content.startsWith(`${prefix}truth`)) {
    const truths = [
      "What is your biggest fear?",
      "What is a secret you’ve never told anyone?",
      "Have you ever lied to your best friend?",
      "What is the most embarrassing thing you’ve done?",
      "Who do you have a crush on?",
      "Have you ever cheated on someone?",
      "What is your guilty pleasure?",
      "What is the weirdest dream you’ve ever had?",
      "What is a habit you wish you could quit?",
      "What is your biggest regret?"
    ];
    const truth = truths[Math.floor(Math.random() * truths.length)];
    return message.channel.send(`📝 **Truth:** ${truth}`);
  }

  // ---- Dare Command ----
  if (message.content.startsWith(`${prefix}dare`)) {
    const dare = spicyDares[Math.floor(Math.random() * spicyDares.length)];
    return message.channel.send(`🔥 **Dare:** ${dare}`);
  }

  // ---- Compliment Command ----
  if (message.content.startsWith(`${prefix}compliment`)) {
    const compliment = compliments[Math.floor(Math.random() * compliments.length)];
    return message.channel.send(`💖 **Compliment:** ${compliment}`);
  }

  // ---- Warning Check ----
  if (warnings[message.author.id] && warnings[message.author.id].length >= 3) {
    return message.reply("⚠️ You have reached 3 warnings! Further actions may be taken.");
  }

  // ---- Blackjack Command (Start) ----
  if (message.content.startsWith(`${prefix}blackjack`)) {
    if (blackjackGames.has(message.author.id)) {
      return message.reply("❌ You already have an ongoing game!");
    }
    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];
    blackjackGames.set(message.author.id, { playerHand, dealerHand });
    return message.channel.send(
      `🃏 **Blackjack started!**\nYour hand: ${formatHand(playerHand)} (Total: ${handValue(playerHand)})\nDealer shows: ${dealerHand[0].value}${dealerHand[0].suit}`
    );
  }
});

// ---- Blackjack Hit Command ----
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  // ---- Blackjack Hit ----
  if (command === 'hit') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply("⚠️ No active blackjack game. Start one with `!blackjack`.");
    game.playerHand.push(drawCard());
    const playerTotal = handValue(game.playerHand);
    let reply = `🃏 Your hand: ${formatHand(game.playerHand)} (Total: ${playerTotal})`;

    if (playerTotal > 21) {
      reply += "\n💥 You busted! Dealer wins.";
      blackjackGames.delete(message.author.id);
    } else {
      reply += "\n👉 Type `!hit` or `!stand`";
    }
    return message.channel.send(reply);
  }

  // ---- Blackjack Stand ----
  if (command === 'stand') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply("⚠️ No active blackjack game. Start one with `!blackjack`.");
    const dealerHand = game.dealerHand;
    while (handValue(dealerHand) < 17) dealerHand.push(drawCard());

    const playerTotal = handValue(game.playerHand);
    const dealerTotal = handValue(dealerHand);
    let result = `🃏 Your hand: ${formatHand(game.playerHand)} (Total: ${playerTotal})\n` +
                 `🂡 Dealer's hand: ${formatHand(dealerHand)} (Total: ${dealerTotal})\n`;

    if (playerTotal > 21) result += "💥 You busted! Dealer wins.";
    else if (dealerTotal > 21) result += "🎉 Dealer busted! You win!";
    else if (playerTotal > dealerTotal) result += "🎉 You win!";
    else if (playerTotal < dealerTotal) result += "😢 Dealer wins.";
    else result += "🤝 It's a tie!";

    blackjackGames.delete(message.author.id);
    return message.channel.send(result);
  }

  // ---- Ping ----
  if (command === 'ping') {
    const sent = await message.channel.send("🏓 Pinging...");
    return sent.edit(`🏓 Pong! Latency: ${sent.createdTimestamp - message.createdTimestamp}ms`);
  }

  // ---- Stats ----
  if (command === 'stats') {
    return message.channel.send(`📊 Server members: ${message.guild.memberCount}`);
  }

  // ---- Uptime ----
  if (command === 'uptime') {
    const uptimeSec = Math.floor(process.uptime());
    return message.channel.send(`⏱️ Bot uptime: ${uptimeSec} seconds`);
  }

  // ---- Bot Info ----
  if (command === 'botinfo') {
    return message.channel.send(`🤖 I am ${client.user.tag}, your friendly bot!`);
  }

  // ---- OpenRouter AI (Mention the bot) ----
  if (message.mentions.users.has(client.user.id) && !command) {
    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    if (!prompt) return message.reply("❓ What would you like to ask?");

    try {
      await message.channel.sendTyping();
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      if (data.error) return message.reply(`🚫 OpenRouter Error: ${data.error.message}`);
      const reply = data.choices?.[0]?.message?.content || "⚠️ Could not generate a reply.";
      return message.reply(reply.length > 2000 ? reply.slice(0, 1997) + "..." : reply);

    } catch (err) {
      console.error('❌ OpenRouter request failed:', err);
      return message.reply("🚫 Error talking to the AI. Try again later.");
    }
  }

  // ---- Google Gemini AI ----
  if (command === 'ai') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply("❓ Provide a prompt. Example: `!ai tell me a joke`");

    try {
      await message.channel.sendTyping();
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);

      let reply = result.response?.text?.();
      if (!reply || reply.trim().length === 0) reply = "⚠️ Gemini couldn't answer that. Try rephrasing.";

      return message.reply(reply.length > 2000 ? reply.slice(0, 1997) + "..." : reply);

    } catch (err) {
      console.error('❌ Gemini request failed:', err);
      return message.reply("🚫 Error talking to Gemini AI. Try again later.");
    }
  }
});

// ---- Moderation Commands ----
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = message.content.startsWith(PREFIX) ? args.shift().toLowerCase() : null;

  // ---- Kick ----
  if (command === 'kick') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🔨 Tag a user to kick.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.KickMembers)) return;
    const reason = args.join(' ') || 'No reason provided';
    target.kick(reason)
      .then(() => message.reply(`✅ Kicked ${target.user.tag}. Reason: ${reason}`))
      .catch(() => message.reply('❌ Cannot kick this user.'));
  }

  // ---- Ban ----
  else if (command === 'ban') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🚫 Tag a user to ban.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.BanMembers)) return;
    const reason = args.join(' ') || 'No reason provided';
    target.ban({ reason })
      .then(() => message.reply(`✅ Banned ${target.user.tag}. Reason: ${reason}`))
      .catch(() => message.reply('❌ Cannot ban this user.'));
  }

  // ---- Mute ----
  else if (command === 'mute') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🤐 Tag a user to mute.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.ModerateMembers)) return;
    const time = args[1] ? parseInt(args[1]) * 1000 : 600000;
    target.timeout(time, 'Muted by bot')
      .then(() => message.reply(`✅ Muted ${target.user.tag}${time ? ` for ${args[1]} seconds` : ''}.`))
      .catch(() => message.reply('❌ Cannot mute this user.'));
  }

  // ---- Unmute ----
  else if (command === 'unmute') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🔊 Tag a user to unmute.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.ModerateMembers)) return;
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
  }

  // ---- Show Warnings ----
  else if (command === 'warnings') {
    const target = message.mentions.members.first() || message.member;
    const userWarnings = warnings[target.id] || [];
    if (!userWarnings.length) return message.reply('ℹ️ No warnings found.');
    let text = `⚠️ Warnings for ${target.user.tag}:\n`;
    userWarnings.forEach((w, i) => text += `${i + 1}. [${w.date}] ${w.mod}: ${w.reason}\n`);
    message.channel.send(text);
  }

  // ---- Clear Messages ----
  else if (command === 'clear') {
    if (!checkPermission(PermissionsBitField.Flags.ManageMessages)) return;
    const count = parseInt(args[0]);
    if (!count || count < 1 || count > 100) return message.reply('❌ Enter a number between 1-100.');
    message.channel.bulkDelete(count, true)
      .then(() => message.reply(`🧹 Deleted ${count} messages.`))
      .catch(() => message.reply('❌ Cannot delete messages.'));
  }

  // ---- Lock Channel ----
  else if (command === 'lock') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false })
      .then(() => message.reply('🔒 Channel locked.'))
      .catch(() => message.reply('❌ Cannot lock this channel.'));
  }

  // ---- Unlock Channel ----
  else if (command === 'unlock') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true })
      .then(() => message.reply('🔓 Channel unlocked.'))
      .catch(() => message.reply('❌ Cannot unlock this channel.'));
  }

  // ---- Slowmode ----
  else if (command === 'slowmode') {
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
});

// ---- Question of the Day (QOTD) ----
const qotdQuestions = [
  "What’s your dream vacation destination?",
  "If you could have any superpower, what would it be?",
  "What’s a small thing that makes you happy?",
  "What’s your favorite childhood memory?",
  "If you could live in any time period, which one would you choose?",
  "What’s the best advice you’ve ever received?",
  "What song always boosts your mood?",
  "If you could instantly master a skill, what would it be?",
  "What’s the weirdest food combination you enjoy?",
  "Who in history would you want to meet?"
];

const qotdChannels = new Set();
let qotdIndex = 0;

// Enable/disable QOTD channels
client.on('messageCreate', (message) => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'qotd') {
    const sub = args[0];
    if (sub === 'enable') {
      qotdChannels.add(message.channel.id);
      message.reply('✅ QOTD enabled in this channel.');
    } else if (sub === 'disable') {
      qotdChannels.delete(message.channel.id);
      message.reply('❌ QOTD disabled in this channel.');
    } else if (sub === 'next') {
      const question = qotdQuestions[qotdIndex % qotdQuestions.length];
      qotdIndex++;
      message.channel.send(`💬 **Question of the Day:** ${question}`);
    }
  }
});

// Automatically send QOTD every 24h in enabled channels
setInterval(() => {
  const question = qotdQuestions[qotdIndex % qotdQuestions.length];
  qotdIndex++;
  qotdChannels.forEach((channelId) => {
    const channel = client.channels.cache.get(channelId);
    if (channel) channel.send(`💬 **Question of the Day:** ${question}`);
  });
}, 24 * 60 * 60 * 1000);

// ---- Haunt Commands ----
let hauntEnabled = false;
let hauntMessage = '';

client.on('messageCreate', (message) => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'haunt') {
    hauntEnabled = true;
    hauntMessage = args.join(' ') || '👻 You are haunted!';
    message.reply('✅ Haunt enabled.');
  } else if (command === 'unhaunt') {
    hauntEnabled = false;
    message.reply('❌ Haunt disabled.');
  }
});

client.on('messageCreate', (message) => {
  if (hauntEnabled && !message.author.bot) {
    message.channel.send(hauntMessage);
  }
});

// ---- Truth / Dare / Compliment ----
const truths = [
  "What is your biggest fear?",
  "Have you ever lied to your best friend?",
  "What's your most embarrassing moment?",
  "What's a secret you've never told anyone?",
  "Who was your first crush?",
  "What's the worst habit you have?",
  "Have you ever cheated in a game?",
  "What's a childhood secret?",
  "What's the last lie you told?",
  "What's your guilty pleasure?"
];

const dares = [
  "Do 20 pushups.",
  "Sing a song loudly.",
  "Do a silly dance for 1 minute.",
  "Post a funny selfie in chat.",
  "Speak in a different accent for 5 minutes.",
  "Imitate a celebrity.",
  "Do an impression of a teacher.",
  "Draw a random doodle and share it.",
  "Send a voice message saying 'I love coding'.",
  "Wear socks on your hands for 10 minutes."
];

const compliments = [
  "You have a great sense of humor!",
  "Your positivity is contagious.",
  "You are really kind and thoughtful.",
  "You have amazing creativity!",
  "Your smile lights up the room.",
  "You are incredibly intelligent.",
  "You have a fantastic taste in music.",
  "You are a great listener.",
  "You inspire those around you.",
  "You have an awesome style!"
];

client.on('messageCreate', (message) => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'truth') {
    const question = truths[Math.floor(Math.random() * truths.length)];
    message.reply(`🗣️ Truth: ${question}`);
  } else if (command === 'dare') {
    const dare = dares[Math.floor(Math.random() * dares.length)];
    message.reply(`🎲 Dare: ${dare}`);
  } else if (command === 'compliment') {
    const comp = compliments[Math.floor(Math.random() * compliments.length)];
    message.reply(`🌸 Compliment: ${comp}`);
  }
});

// ---- Client Login ----
client.login(process.env.BOT_TOKEN);
