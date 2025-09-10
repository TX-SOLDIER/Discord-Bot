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

// ---- QOTD (Question of the Day) ----
const qotdChannels = new Set();
const qotdIntervals = new Map();
function getRandomQOTD() {
  return spicyTruths[Math.floor(Math.random() * spicyTruths.length)];
}

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
// ---- Warnings System ----
let warnings = {};
const warningsFile = './warnings.json';

// Load warnings from file if exists
if (fs.existsSync(warningsFile)) {
  warnings = JSON.parse(fs.readFileSync(warningsFile));
}

// Save warnings to file
function saveWarnings() {
  fs.writeFileSync(warningsFile, JSON.stringify(warnings, null, 2));
}

// ---- Blackjack Game ----
function getCard() {
  const cards = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11]; // J,Q,K=10, Ace=11
  return cards[Math.floor(Math.random() * cards.length)];
}

function calculateHand(hand) {
  let sum = hand.reduce((a, b) => a + b, 0);
  let aces = hand.filter(card => card === 11).length;

  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces--;
  }
  return sum;
}

// ---- Command Handling ----
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (!message.content.startsWith('$')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---- Haunt ----
  if (command === 'haunt') {
    if (hauntedChannels.has(message.channel.id)) {
      return message.channel.send('👻 This channel is already haunted!');
    }
    hauntedChannels.add(message.channel.id);
    message.channel.send('👻 The haunting begins...');

    const interval = setInterval(() => {
      if (!hauntedChannels.has(message.channel.id)) return clearInterval(interval);
      message.channel.send(spookyMessages[Math.floor(Math.random() * spookyMessages.length)]);
    }, 60000);

    hauntIntervals.set(message.channel.id, interval);
  }

  else if (command === 'unhaunt') {
    hauntedChannels.delete(message.channel.id);
    if (hauntIntervals.has(message.channel.id)) {
      clearInterval(hauntIntervals.get(message.channel.id));
      hauntIntervals.delete(message.channel.id);
    }
    message.channel.send('🔮 The haunting has been lifted.');
  }

  // ---- QOTD ----
  else if (command === 'qotd') {
    if (qotdChannels.has(message.channel.id)) {
      return message.channel.send('📅 QOTD is already running in this channel!');
    }
    qotdChannels.add(message.channel.id);
    message.channel.send('✅ QOTD started! A new question will be posted every 24 hours.');

    const interval = setInterval(() => {
      if (!qotdChannels.has(message.channel.id)) return clearInterval(interval);
      message.channel.send(`❓ **Question of the Day:** ${getRandomQOTD()}`);
    }, 24 * 60 * 60 * 1000); // every 24 hours

    qotdIntervals.set(message.channel.id, interval);

    // Send the first question immediately
    message.channel.send(`❓ **Question of the Day:** ${getRandomQOTD()}`);
  }

  else if (command === 'stopqotd') {
    qotdChannels.delete(message.channel.id);
    if (qotdIntervals.has(message.channel.id)) {
      clearInterval(qotdIntervals.get(message.channel.id));
      qotdIntervals.delete(message.channel.id);
    }
    message.channel.send('🛑 QOTD has been stopped in this channel.');
  }

  // ---- Truth or Dare ----
  else if (command === 'truth') {
    message.channel.send(`❓ Truth: ${spicyTruths[Math.floor(Math.random() * spicyTruths.length)]}`);
  }

  else if (command === 'dare') {
    message.channel.send(`🔥 Dare: ${spicyDares[Math.floor(Math.random() * spicyDares.length)]}`);
  }

  else if (command === 'compliment') {
    message.channel.send(`💖 Compliment: ${compliments[Math.floor(Math.random() * compliments.length)]}`);
  }

  // ---- AI Chat ----
  else if (command === 'ask') {
    const question = args.join(' ');
    if (!question) return message.channel.send("❌ Please provide a question!");

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(question);
      const response = result.response.text();

      message.channel.send(`🤖 ${response}`);
    } catch (err) {
      console.error(err);
      message.channel.send("⚠️ Error fetching AI response.");
    }
  }

  // ---- Warnings Commands ----
  else if (command === 'warn') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply("❌ You don’t have permission to warn members.");
    }

    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ Please mention a user to warn.");

    if (isImmune(user)) {
      return message.reply("🛡️ This user is immune and cannot be warned.");
    }

    const reason = args.slice(1).join(' ') || "No reason provided.";
    if (!warnings[user.id]) warnings[user.id] = [];

    warnings[user.id].push({ reason, moderator: message.author.id, date: new Date().toISOString() });
    saveWarnings();

    message.channel.send(`⚠️ ${user.tag} has been warned. Reason: ${reason}`);
  }

  else if (command === 'warnings') {
    const user = message.mentions.users.first() || message.author;
    if (!warnings[user.id] || warnings[user.id].length === 0) {
      return message.channel.send(`✅ ${user.tag} has no warnings.`);
    }

    const warningList = warnings[user.id]
      .map((w, i) => `${i + 1}. Reason: ${w.reason} | By: <@${w.moderator}> | Date: ${w.date}`)
      .join('\n');

    message.channel.send(`📋 Warnings for ${user.tag}:\n${warningList}`);
  }

  else if (command === 'clearwarnings') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ You don’t have permission to clear warnings.");
    }

    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ Please mention a user to clear warnings.");

    warnings[user.id] = [];
    saveWarnings();

    message.channel.send(`✅ Cleared all warnings for ${user.tag}.`);
  }

  // ---- Blackjack Commands ----
  else if (command === 'blackjack') {
    let playerHand = [getCard(), getCard()];
    let dealerHand = [getCard(), getCard()];

    let playerTotal = calculateHand(playerHand);
    let dealerTotal = calculateHand(dealerHand);

    message.channel.send(
      `🃏 **Blackjack Game Started!**\nYour hand: [${playerHand.join(', ')}] (Total: ${playerTotal})\nDealer's visible card: ${dealerHand[0]}`
    );

    const filter = (m) => m.author.id === message.author.id;
    const collector = message.channel.createMessageCollector({ filter, time: 30000 });

    collector.on('collect', (m) => {
      const choice = m.content.toLowerCase();

      if (choice === 'hit') {
        playerHand.push(getCard());
        playerTotal = calculateHand(playerHand);

        if (playerTotal > 21) {
          message.channel.send(`💥 You busted with ${playerTotal}! Dealer wins!`);
          return collector.stop();
        }

        message.channel.send(`🃏 Your hand: [${playerHand.join(', ')}] (Total: ${playerTotal})`);
      }

      else if (choice === 'stand') {
        while (dealerTotal < 17) {
          dealerHand.push(getCard());
          dealerTotal = calculateHand(dealerHand);
        }

        message.channel.send(`🏁 Final Hands:\nYour hand: [${playerHand.join(', ')}] (Total: ${playerTotal})\nDealer's hand: [${dealerHand.join(', ')}] (Total: ${dealerTotal})`);

        if (dealerTotal > 21 || playerTotal > dealerTotal) {
          message.channel.send("🎉 You win!");
        } else if (playerTotal < dealerTotal) {
          message.channel.send("😞 Dealer wins!");
        } else {
          message.channel.send("🤝 It's a tie!");
        }

        return collector.stop();
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        message.channel.send("⌛ Game ended due to inactivity.");
      }
    });
  }
});

// ---- Bot Login ----
client.login(process.env.TOKEN);
