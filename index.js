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

  // Extra 15 from previous batch
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

  // Extra 50 batch
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

  // Extra 12 from previous batch
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

  // Extra 50 batch
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

  // Extra 12 from previous batch
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

  // Extra 50 batch
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

  // 5 Adult/Spicy Compliments
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

// ---- Question of the Day ----
const qotdQuestions = [
  "What's the best movie you've seen recently?",
  "If you could have any superpower, what would it be?",
  "What's your favorite food and why?",
  "What's a hobby you've always wanted to try?",
  "What's the most beautiful place you've ever visited?",
  "What's a book you think everyone should read?",
  "What's your go-to comfort meal?",
  "What's a skill you'd like to learn?",
  "What's the funniest thing that's happened to you this week?",
  "What's your favorite season and why?",
  "What's a small thing that makes you happy?",
  "If you could travel anywhere, where would you go?",
];

// ---- Persistent QOTD State ----
const qotdFile = './qotd.json';
let qotdState = { channelId: null, isRunning: false };

if (fs.existsSync(qotdFile)) {
  qotdState = JSON.parse(fs.readFileSync(qotdFile, 'utf8'));
}

function saveQotdState() {
  fs.writeFileSync(qotdFile, JSON.stringify(qotdState, null, 2));
}

// ---- QOTD Scheduling Logic ----
function startQotd() {
  if (!qotdState.isRunning || !qotdState.channelId) {
    console.log("QOTD is not enabled or channel is not set.");
    return;
  }

  const channel = client.channels.cache.get(qotdState.channelId);
  if (!channel) {
    console.error(`QOTD channel not found: ${qotdState.channelId}`);
    qotdState.isRunning = false;
    qotdState.channelId = null;
    saveQotdState();
    return;
  }

  const sendQuestion = () => {
    const question = qotdQuestions[Math.floor(Math.random() * qotdQuestions.length)];
    channel.send(`**❓ Question of the Day:** ${question}`);
  };

  // Run immediately, then schedule to run every 24 hours.
  sendQuestion();
  setInterval(sendQuestion, 24 * 60 * 60 * 1000);
}


// ---- Ready ----
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  // Start the QOTD scheduler if it was active
  if (qotdState.isRunning) {
    startQotd();
  }
});
const PREFIX = '$';
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX) && !message.mentions.users.has(client.user.id)) return; // ✅ Allow prefix OR mention

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = message.content.startsWith(PREFIX) ? args.shift().toLowerCase() : null;

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
    `🃏 \`${PREFIX}blackjack\`, \`${PREFIX}hit\`, \`${PREFIX}stand\` — Play Blackjack\n` +
    `❓ \`${PREFIX}qotd on\` / \`${PREFIX}qotd off\` — Manage Question of the Day\n\n` +
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
    `✉️ \`${PREFIX}send <channelID> <message>\` — Send to another server/channel\n\n` +
    `★ **Google Gemini AI**: \`${PREFIX}<prompt>\` — Ask Gemini AI a prompt\n` +
    `☆ **OpenRouter AI**: \`@bot <prompt>\` — Ask OpenRouter AI a prompt`;

  await message.channel.send(helpText2);
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
    message.channel.send(`🔗 Invite me: https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);
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

  // ---- Haunt ----
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

  // ---- Blackjack ----
  else if (command === 'blackjack') {
    if (blackjackGames.has(message.author.id)) return message.reply('⚠️ You already have a game! Use `$hit` or `$stand`');
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
    if (!game) return message.reply('⚠️ No active game. Start one with `$blackjack`');
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
    if (!game) return message.reply('⚠️ No active game. Start one with `$blackjack`');
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
// ---- AI Chat with OpenRouter (Bot Mention) ----
else if (!command && message.mentions.users.has(client.user.id)) {
  const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  if (!prompt) return message.reply('❓ What would you like to ask?');

  try {
    await message.channel.sendTyping();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo", // 🔧 Fixed model for now
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    // 🔎 Error handling
    if (data.error) {
      return message.reply(`🚫 OpenRouter Error: ${data.error.message}`);
    }

    const reply = data.choices?.[0]?.message?.content || "⚠️ Sorry, I couldn’t generate a reply.";

    if (reply.length > 2000) {
      await message.reply(reply.slice(0, 1997) + '...');
    } else {
      await message.reply(reply);
    }

  } catch (err) {
    console.error('❌ OpenRouter request failed:', err);
    await message.reply('🚫 Error talking to the AI. Try again later.');
  }
}

// ---- AI Chat with Google Gemini ----
else if (command === 'ai') {
  const prompt = args.join(' ');
  if (!prompt) return message.reply('❓ Please provide a prompt. Example: `$ai tell me a story`');

  try {
    await message.channel.sendTyping();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    // 🔎 Check if Gemini returned text
    let reply = result.response?.text?.();
    if (!reply || reply.trim().length === 0) {
      console.warn("⚠️ Gemini refusal details:", JSON.stringify(result.response, null, 2));
      reply = "⚠️ Gemini couldn’t answer that. Try rephrasing your question.";
    }

    if (reply.length > 2000) {
      await message.reply(reply.slice(0, 1997) + '...');
    } else {
      await message.reply(reply);
    }

  } catch (err) {
    console.error('❌ Gemini AI request failed:', err);
    await message.reply('🚫 Error talking to the AI. Try again later.');
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
    if (!checkPermission(PermissionsBitField.Flags.ModerateMembers)) return;
    const time = args[1] ? parseInt(args[1]) * 1000 : 600000;
    target.timeout(time, 'Muted by bot')
      .then(() => message.reply(`✅ Muted ${target.user.tag}${time ? ` for ${args[1]} seconds` : ''}.`))
      .catch(() => message.reply('❌ Cannot mute this user.'));
  } else if (command === 'unmute') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🔊 Tag a user to unmute.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.ModerateMembers)) return;
    target.timeout(null, 'Unmuted by bot')
      .then(() => message.reply(`✅ Unmuted ${target.user.tag}.`))
      .catch(() => message.reply('❌ Cannot unmute this user.'));
  }

  // ---- Info & Tools ----
  else if (command === 'userinfo') {
    const user = message.mentions.users.first() || message.author;
    const member = message.guild.members.cache.get(user.id);
    message.channel.send(`🧑 User Info:
Username: ${user.username}
Tag: ${user.tag}
ID: ${user.id}
Joined Server: ${member.joinedAt.toDateString()}
Account Created: ${user.createdAt.toDateString()}`);
  }
  else if (command === 'avatar') {
    const user = message.mentions.users.first() || message.author;
    message.channel.send(`${user.username}'s Avatar: ${user.displayAvatarURL({ dynamic: true, size: 1024 })}`);
  }
  else if (command === 'serverinfo') {
    const guild = message.guild;
    message.channel.send(`🏠 Server Info:
Name: ${guild.name}
ID: ${guild.id}
Members: ${guild.memberCount}
Created: ${guild.createdAt.toDateString()}`);
  }
  else if (command === 'shout') {
    if (!args.length) return message.reply('📢 Provide a message to shout.');
    message.channel.send(args.join(' ').toUpperCase());
  }
  else if (command === 'spoiler') {
    if (!args.length) return message.reply('🤐 Provide a message to hide as spoiler.');
    message.channel.send(`||${args.join(' ')}||`);
  }
  else if (command === 'say') {
    if (!args.length) return message.reply('📣 Provide a message to echo.');
    message.channel.send(args.join(' '));
  }
  else if (command === 'send') {
    if (args.length < 2) return message.reply('✉️ Usage: $send <channelID> <message>');
    const channel = client.channels.cache.get(args[0]);
    if (!channel) return message.reply('❌ Channel not found or I do not have access.');
    if (!channel.isTextBased()) return message.reply('❌ That channel is not a text channel.');
    const botMember = channel.guild.members.me;
    if (!channel.permissionsFor(botMember)?.has('SendMessages')) return message.reply('❌ I do not have permission to send messages in that channel.');
    channel.send(args.slice(1).join(' '))
      .then(() => message.reply(`✅ Message sent to #${channel.name} in ${channel.guild.name}.`))
      .catch(err => message.reply(`❌ Failed to send message. Error: ${err.message}`));
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
  else if (command === 'warnings') {
    const target = message.mentions.members.first() || message.member;
    const userWarnings = warnings[target.id] || [];
    if (!userWarnings.length) return message.reply('ℹ️ No warnings found.');
    let text = `⚠️ Warnings for ${target.user.tag}:\n`;
    userWarnings.forEach((w, i) => text += `${i + 1}. [${w.date}] ${w.mod}: ${w.reason}\n`);
    message.channel.send(text);
  }

  // ---- Clear, Lock, Unlock, Slowmode, Role ----
  else if (command === 'clear') {
    if (!checkPermission(PermissionsBitField.Flags.ManageMessages)) return;
    const count = parseInt(args[0]);
    if (!count || count < 1 || count > 100) return message.reply('❌ Enter a number between 1-100.');
    message.channel.bulkDelete(count, true)
      .then(() => message.reply(`🧹 Deleted ${count} messages.`))
      .catch(() => message.reply('❌ Cannot delete messages.'));
  }
  else if (command === 'lock') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false })
      .then(() => message.reply('🔒 Channel locked.'))
      .catch(() => message.reply('❌ Cannot lock this channel.'));
  }
  else if (command === 'unlock') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true })
      .then(() => message.reply('🔓 Channel unlocked.'))
      .catch(() => message.reply('❌ Cannot unlock this channel.'));
  }
  else if (command === 'slowmode') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    const time = parseInt(args[0]);
    if (isNaN(time) || time < 0 || time > 21600) return message.reply('❌ Enter a valid number (0-21600 seconds).');
    message.channel.setRateLimitPerUser(time)
      .then(() => message.reply(`🐌 Slowmode set to ${time} seconds.`))
      .catch(() => message.reply('❌ Cannot set slowmode.'));
  }
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

  // ---- QOTD Command ----
  else if (command === 'qotd') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    const subcommand = args[0];
    if (subcommand === 'on') {
      if (qotdState.isRunning) {
        return message.reply(`❓ QOTD is already active in <#${qotdState.channelId}>.`);
      }
      qotdState.channelId = message.channel.id;
      qotdState.isRunning = true;
      saveQotdState();
      message.reply('✅ Question of the Day has been enabled in this channel!');
      startQotd();
    } else if (subcommand === 'off') {
      if (!qotdState.isRunning) {
        return message.reply('❌ QOTD is not currently active.');
      }
      qotdState.channelId = null;
      qotdState.isRunning = false;
      saveQotdState();
      message.reply('✅ Question of the Day has been disabled.');
      // The startQotd function will now exit gracefully.
    } else {
      message.reply('❌ Usage: `$qotd on` or `$qotd off`.');
    }
  }
  // ---- Unknown command ----
  else {
    if (message.content.startsWith('$')) {
      message.reply('❌ Unknown command or you do not have permission.');
    }
  }

}); // ---- End of messageCreate ----

client.login(process.env.BOT_TOKEN);

