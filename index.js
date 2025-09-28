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
    GatewayIntentBits.GuildMembers,
  ],
});

// ---- Google Gemini AI Setup ----
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// ---- Immunity System ----
const OWNER_ID = '782155864134909952';
const IMMUNITY_RANKS = ['2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL', 'BG', 'MG', 'LTG', 'GEN'];
const immunityFile = './immunity.json';
let immuneUsers = {};

if (fs.existsSync(immunityFile)) {
  immuneUsers = JSON.parse(fs.readFileSync(immunityFile, 'utf8'));
}

function saveImmunity() {
  fs.writeFileSync(immunityFile, JSON.stringify(immuneUsers, null, 2));
}

function isImmune(user) {
  // The owner is always immune.
  if (user.id === OWNER_ID) return true;
  // Check if the user is in the immunity list.
  return !!immuneUsers[user.id];
}

// ---- GIVEAWAY CODE: Time Parser ----
function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;

  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

// ---- Data ----
const hauntedChannels = new Set();
const hauntIntervals = new Map();

// ---- ANTI-RAID DATA ----
const antiRaidActive = new Set();
const originalVerificationLevels = new Map();
const joinTimestamps = new Map();

// ---- COUNTING GAME DATA ----
const countingFile = './counting.json';
let countingData = {};
if (fs.existsSync(countingFile)) {
    try {
        countingData = JSON.parse(fs.readFileSync(countingFile, 'utf8'));
    } catch (e) {
        console.error("Error parsing counting.json:", e);
    }
}
function saveCountingData() {
    fs.writeFileSync(countingFile, JSON.stringify(countingData, null, 2));
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
    "What's your all-time favorite song?",
    "What’s one goal you’re working toward right now?",
    "What’s the best compliment you’ve ever received?",
    "What’s a random act of kindness someone did for you?",
    "What’s the most adventurous thing you’ve ever done?",
    "What’s your go-to karaoke song?",
    "What's the first video game you ever played?",
    "If you could live in any video game world, which would it be?",
    "Which video game character do you relate to the most?",
    "What's your all-time favorite multiplayer game?",
    "If you could erase your memory of one game to play it again fresh, which game would you choose?",
    "What's the most rage-inducing game you've ever played?",
    "Do you prefer single-player or multiplayer games?",
    "What's the most underrated game you've ever played?",
    "What game had the best storyline in your opinion?",
    "What game do you think deserves a remake?",
    "What’s your favorite gaming console of all time?",
    "If you could only play one game for the rest of your life, which would it be?",
    "Who’s your favorite video game villain?",
    "What’s your proudest gaming achievement?",
    "Do you prefer story-driven games or competitive ones?",
    "What’s a game you love that most people haven’t heard of?",
    "Which game soundtrack is your favorite?",
    "What’s the funniest bug/glitch you’ve seen in a game?",
    "Would you rather be able to fly or be invisible?",
    "Would you rather always know when someone is lying or always get away with lying?",
    "Would you rather fight one horse-sized duck or 100 duck-sized horses?",
    "Would you rather live in a world without music or a world without video games?",
    "Would you rather be rich but lonely, or poor but surrounded by amazing friends?",
    "Would you rather explore space or explore the deep ocean?",
    "Would you rather teleport anywhere instantly or time travel once a year?",
    "Would you rather never feel pain or never feel fear?",
    "Would you rather lose the ability to read or lose the ability to speak?",
    "Would you rather have unlimited free travel or never need to sleep?",
    "Would you rather live forever at age 25 or live to 100 with a healthy life?",
    "Would you rather be able to pause time or rewind time?",
    "Would you rather always win arguments or always win games?",
    "Would you rather live without the internet or live without AC/heating?",
    "Would you rather be famous but hated or unknown but loved by everyone you meet?",
    "Would you rather know the exact date of your death or the exact cause of your death?",
    "Would you rather lose all your past memories or never be able to make new ones?",
    "Would you rather save one loved one or 100 strangers?",
    "Would you rather always know the truth but never be believed, or always believe lies?",
    "Would you rather have the power to change the past or see the future but not change it?",
    "Would you rather live 1,000 years in perfect health or live a normal lifespan but be famous forever?",
    "Would you rather be feared by all or loved by none?",
    "Would you rather have the ability to read minds but only bad thoughts, or hear only good lies?",
    "Would you rather never feel happiness again or never feel sadness again (but also never truly appreciate happiness)?",
    "Would you rather forget everyone else or have everyone else forget you?",
    "Would you rather live in a simulation you control or reality you can’t control?",
    "Would you rather save the world but nobody knows it was you, or get credit but not actually do it?",
    "Would you rather be trapped in your best day forever or move forward with no good days left?",
    "Would you rather never dream again or never be awake again?",
    "Would you rather lose your sight or lose your hearing?",
    "Would you rather never be able to speak again or never be able to think privately again?",
    "Would you rather lose your most cherished possession or lose your most cherished memory?",
    "Would you rather everyone knew your darkest secret or forget the best thing you ever did?",
    "Would you rather die in 10 years with no regrets, or live 100 years with tons of regrets?",
    "Would you rather be remembered forever for something bad or forgotten completely?",
    "Would you rather always know the ending to every story or never know the ending to your own?",
    "Would you rather betray your best friend or let your best friend betray you?",
    "Would you rather carry the guilt of one terrible mistake forever or forget it but repeat it again?",
    "Would you rather live in total safety but extreme boredom, or in danger but constant excitement?",
    "Would you rather be the smartest person alive but hated, or the dumbest but loved?",
    "Would you rather always lose everything you own once a year, or never be able to replace anything you own?",
    "Would you rather find true love but die in 5 years, or never find it and live long?",
    "Would you rather save your own life or sacrifice yourself to save 10 others?",
    "Would you rather never be able to lie or never be able to tell the truth?",
    "Would you rather live in poverty with peace or live rich but in constant war?",
    "Would you rather forget how to read or forget how to write?",
    "Would you rather have unlimited money but never be happy, or be poor but always content?",
    "Would you rather always feel intense pain but never get sick, or never feel pain but always be sick?",
    "Would you rather never be able to sleep again or never be able to eat again?",
    "Would you rather know everyone’s future but not your own, or your own but not anyone else’s?",
    "Would you rather lose your sense of time or your sense of reality?",
    "Would you rather never be able to forgive or never be forgiven?",
    "Would you rather be trapped alone in space or trapped with 100 strangers in a bunker?",
    "Would you rather live forever but everyone you love dies normally, or die normally but everyone you love lives forever?",
    "Would you rather always feel like you’re being watched or always be completely alone?",
    "Would you rather change one moment in your past and risk changing everything, or never touch the past at all?",
    "Would you rather be able to cure any disease but die young, or live long but never help anyone?",
    "Would you rather lose all technology or lose all human connection?",
    "Would you rather never be able to learn new things or forget one thing every day?",
    "Would you rather know the ultimate secret of the universe but never be able to share it, or never know it at all?",
    "Would you rather have a perfect body but an average mind, or a genius mind but weak body?",
    "Would you rather never be able to love or never be able to be loved?",
    "Would you rather live in a world with no crime but no freedom, or total freedom but constant crime?",
    "Would you rather be invisible but never able to interact, or visible but ignored by everyone?",
    "Would you rather watch your worst memory on repeat forever or never remember anything again?",
    "Would you rather make one person happy forever or make millions happy for just a day?",
    "If you could have any superpower for just 24 hours, what would you pick?",
    "If you had to give up one of your five senses, which would it be?",
    "If you were a superhero, what would your hero name be?",
    "If you could shapeshift into any animal, which would you choose?",
    "Would you want the ability to read minds if it meant you couldn’t turn it off?",
    "If you had a time machine, would you go to the past or the future?",
    "Would you rather be able to breathe underwater or survive in space?",
    "If you could instantly master one skill, what would it be?",
    "If you could snap your fingers and change one thing about the world, what would it be?",
    "If you had a superpower but it only worked once a week, what would it be?",
    "If you could create your own video game power-up, what would it do?",
    "If you could talk to animals, what’s the first thing you’d ask them?",
    "If you could be immortal but couldn’t tell anyone, would you do it?",
    "If you could swap lives with a fictional character, who would you pick?",
    "If you could live in any fantasy universe, which one would it be?",
    "What's the weirdest food combination you secretly enjoy?",
    "What's a song that instantly puts you in a good mood?",
    "If you could swap lives with someone for a day, who would it be?",
    "What's the best advice you've ever received?",
    "What's one conspiracy theory you secretly think could be true?",
    "What's something small that instantly annoys you?",
    "What's a childhood memory that still makes you laugh?",
    "If you could meet any historical figure, who would it be?",
    "What's the most random fact you know?",
    "What's one thing you'd change about the world if you could?",
    "What's a guilty pleasure show or game you enjoy?",
    "If aliens visited Earth tomorrow, what would you show them first?",
    "What's the funniest meme you’ve seen recently?",
    "What's the scariest movie or game you’ve played?",
    "What's the most useless talent you have?",
    "What's something embarrassing you did but still laugh about?",
    "If you could instantly learn a language, which would you choose?",
    "What’s your dream vacation spot?",
    "What’s one invention you wish existed?",
    "What’s the most trouble you’ve ever gotten into?",
    "What’s your favorite childhood cartoon?",
    "If money didn’t matter, what job would you do?",
    "What's the best concert you've ever been to?",
    "Who's your favorite music artist or band?",
    "What's a movie you can watch over and over again?",
    "What’s your favorite streaming show right now?",
    "If you could bring back any TV show, what would it be?",
    "What’s your all-time favorite meme?",
    "If you could hang out with any celebrity for a day, who would it be?",
    "What’s your guilty pleasure song?",
    "Which actor would play you in a movie about your life?",
    "If you could make a cameo in any movie or show, which one would it be?",
    "Do you prefer sweet or salty snacks?",
    "What’s the weirdest thing you’ve ever eaten?",
    "If you could only eat one meal for the rest of your life, what would it be?",
    "What’s your favorite fast food place?",
    "Would you rather never eat pizza again or never eat burgers again?",
    "What’s your favorite type of dessert?",
    "Do you prefer coffee, tea, or neither?",
    "What’s the spiciest thing you’ve ever eaten?",
    "If you opened a restaurant, what would you serve?",
    "What’s a food you hated as a kid but love now?",
    "What’s your survival plan for a zombie apocalypse?",
    "If you were stranded on a desert island, what three things would you bring?",
    "If you won the lottery tomorrow, what’s the first thing you’d do?",
    "If you could time travel but only once, when/where would you go?",
    "If you woke up invisible, what’s the first thing you’d do?",
    "If you had to live in a different country, where would you move?",
    "If you could swap lives with a character from a book, who would it be?",
    "If you had to give up the internet or TV forever, which would you choose?",
    "What would you do if you were the last person on Earth?",
    "If you could live in any time period, past or future, which would you choose?",
    "If you were an animal, what would you be and why?",
    "What’s your weirdest habit?",
    "What’s your biggest pet peeve?",
    "What’s something you’ve done that you’re really proud of?",
    "What’s your love language?",
    "Are you more of a morning person or a night owl?",
    "What’s your spirit animal?",
    "What’s the first thing you do when you wake up?",
    "What’s your favorite holiday and why?",
    "Do you prefer big parties or small hangouts?"
];

const qotdFile = './qotd.json';
const qotdSettingsFile = './qotdSettings.json';

let activeQotdChannels = new Set();
let qotdIntervals = new Map(); // channelId -> setInterval
let qotdSettings = {}; // { channelId: { everyone: true/false } }
let sentQuestions = {}; // { channelId: [indices of sent questions] }

// Load active channels
if (fs.existsSync(qotdFile)) {
  const channelArray = JSON.parse(fs.readFileSync(qotdFile, 'utf8'));
  activeQotdChannels = new Set(channelArray);
}

// Load settings
if (fs.existsSync(qotdSettingsFile)) {
  qotdSettings = JSON.parse(fs.readFileSync(qotdSettingsFile, 'utf8'));
}

// Save functions
function saveQotdState() {
  fs.writeFileSync(qotdFile, JSON.stringify(Array.from(activeQotdChannels), null, 2));
}

function saveQotdSettings() {
  fs.writeFileSync(qotdSettingsFile, JSON.stringify(qotdSettings, null, 2));
}

// Send a QOTD to a channel without repeating until all questions are used
function sendQuestion(channelId) {
  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  if (!sentQuestions[channelId]) sentQuestions[channelId] = [];

  // Filter unused questions
  const unusedIndices = qotdQuestions
    .map((_, i) => i)
    .filter(i => !sentQuestions[channelId].includes(i));

  // Reset if all questions have been sent
  if (unusedIndices.length === 0) {
    sentQuestions[channelId] = [];
    unusedIndices.push(...qotdQuestions.map((_, i) => i));
  }

  // Pick random unused question
  const randomIndex = unusedIndices[Math.floor(Math.random() * unusedIndices.length)];
  sentQuestions[channelId].push(randomIndex);

  const prefix = qotdSettings[channelId]?.everyone ? '@everyone ' : '';
  const question = qotdQuestions[randomIndex];
  channel.send(`${prefix}**❓ Question of the Day:** ${question}`);
  
  // Add the global log function call here
  logToGlobal(question, channel.guild.name, channel.name);
}

// Start QOTD for all active channels
function startAllQotd() {
  if (activeQotdChannels.size === 0) {
    console.log("No QOTD channels to start.");
    return;
  }

  activeQotdChannels.forEach(channelId => {
    if (qotdIntervals.has(channelId)) return; // already running

    sendQuestion(channelId); // first question immediately

    const interval = setInterval(() => sendQuestion(channelId), 24 * 60 * 60 * 1000); // every 24h
    qotdIntervals.set(channelId, interval);
  });
}

// Stop QOTD in a channel
function stopQotd(channelId) {
  if (!activeQotdChannels.has(channelId)) return;

  const interval = qotdIntervals.get(channelId);
  if (interval) clearInterval(interval);
  qotdIntervals.delete(channelId);

  activeQotdChannels.delete(channelId);
  saveQotdState();

  if (qotdSettings[channelId]) {
    delete qotdSettings[channelId];
    saveQotdSettings();
  }

  if (sentQuestions[channelId]) delete sentQuestions[channelId];
}

// --- Welcome & Leave Messages Data ---
const welcomeFile = './welcomeMessages.json';
const leaveFile = './leaveMessages.json';
let welcomeMessages = {};
let leaveMessages = {};

if (fs.existsSync(welcomeFile)) {
  welcomeMessages = JSON.parse(fs.readFileSync(welcomeFile, 'utf8'));
}

if (fs.existsSync(leaveFile)) {
  leaveMessages = JSON.parse(fs.readFileSync(leaveFile, 'utf8'));
}

function saveWelcomeMessages() {
  fs.writeFileSync(welcomeFile, JSON.stringify(welcomeMessages, null, 2));
}

function saveLeaveMessages() {
  fs.writeFileSync(leaveFile, JSON.stringify(leaveMessages, null, 2));
}

// ---- Permanent Global Log Channel ----
const PERMANENT_LOG_CHANNEL_ID = '1411247548240232540';
// ---- Log Channel Storage ----
const logChannelsFile = './logChannels.json';
const masterLogFile = './masterLog.json';
let logChannels = {};
let masterLog = { channelId: null, enabled: false };

// Load existing log channels and master log channel.
if (fs.existsSync(logChannelsFile)) {
  logChannels = JSON.parse(fs.readFileSync(logChannelsFile, 'utf8'));
}
if (fs.existsSync(masterLogFile)) {
  masterLog = JSON.parse(fs.readFileSync(masterLogFile, 'utf8'));
}

// Function to save the log channels.
function saveLogChannels() {
  fs.writeFileSync(logChannelsFile, JSON.stringify(logChannels, null, 2));
}

// Function to save the master log channel.
function saveMasterLog() {
  fs.writeFileSync(masterLogFile, JSON.stringify(masterLog, null, 2));
}

// Function to log a message to the permanent global log channel.
async function logToGlobal(qotd, serverName, channelName) {
  try {
    const logChannel = client.channels.cache.get(PERMANENT_LOG_CHANNEL_ID);
    if (logChannel) {
      const embed = {
        color: 0x0099ff,
        title: `New QOTD in ${serverName}`,
        description: `**Channel:** #${channelName}\n**Question:** ${qotd}`,
        timestamp: new Date(),
        footer: {
          text: 'Logged by QOTD Bot',
        },
      };
      logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Failed to log QOTD to global channel:', error);
  }
}

// --- ANTI-RAID HELPER FUNCTIONS (NEW) ---

async function engageAntiRaid(guild, alertChannel, author = null) {
    if (antiRaidActive.has(guild.id)) return false; // Already active

    antiRaidActive.add(guild.id);
    originalVerificationLevels.set(guild.id, guild.verificationLevel);

    try {
        await guild.setVerificationLevel(4); // Highest

        guild.channels.cache.forEach(async (channel) => {
            if (channel.isTextBased() && channel.permissionsFor(guild.roles.everyone).has(PermissionsBitField.Flags.SendMessages)) {
                await channel.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: false
                }).catch(err => console.error(`Failed to lock channel ${channel.name}:`, err));
            }
        });

        if (author) { // Manual trigger
            await sendLog(guild.id, `\`[SECURITY]\` **${author.tag}** has engaged ANTI-RAID mode.`);
            if (alertChannel) {
                await alertChannel.send("🚨ANTI-RAID PROTOCOL  ENGAGED🚨THIS IS NOT A DRILL. All security measures are live. Unauthorized accounts will be IDENTIFIED, TRACKED and ELIMINATED. Channels are locked, posting is restricted, and verification is mandatory. Attempts to bypass will result in immediate bans and permanent removal from the server. Moderators: Engage intruders.");
            }
        } else { // Automatic trigger
             await sendLog(guild.id, `\`[SECURITY]\` **AUTOMATIC ANTI-RAID** has been engaged due to rapid joins.`);
            if (alertChannel) {
                await alertChannel.send("🚨**AUTO-TRIGGER**🚨ANTI-RAID PROTOCOL  ENGAGED🚨THIS IS NOT A DRILL. All security measures are live. Unauthorized accounts will be IDENTIFIED, TRACKED and ELIMINATED. Channels are locked, posting is restricted, and verification is mandatory. Attempts to bypass will result in immediate bans and permanent removal from the server. Moderators: Engage intruders.");
            }
        }
        return true;
    } catch (err) {
        console.error("Anti-Raid ON Error:", err);
        antiRaidActive.delete(guild.id); // Revert state if failed
        return false;
    }
}

async function disengageAntiRaid(guild, replyChannel) {
    if (!antiRaidActive.has(guild.id)) {
        if (replyChannel) await replyChannel.reply('✅ Anti-raid mode is not currently active.');
        return false;
    }

    antiRaidActive.delete(guild.id);
    const originalLevel = originalVerificationLevels.get(guild.id) || 0; // Default to 'None'
    originalVerificationLevels.delete(guild.id);

    try {
        await guild.setVerificationLevel(originalLevel);

        guild.channels.cache.forEach(async (channel) => {
            if (channel.isTextBased()) {
                await channel.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: null // Resets permission to default
                }).catch(err => console.error(`Failed to unlock channel ${channel.name}:`, err));
            }
        });

        if (replyChannel) {
            await replyChannel.reply('✅ Anti-raid mode has been disengaged. All systems back to normal.');
        }
        return true;
    } catch (err) {
        console.error("Anti-Raid OFF Error:", err);
        if (replyChannel) {
            await replyChannel.reply("❌ Failed to fully disengage anti-raid mode. I might be missing permissions. Please check channels manually.");
        }
        return false;
    }
}


// --- Welcome & Leave Event Handlers ---
client.on('guildMemberAdd', async member => {
    // --- AUTO ANTI-RAID TRIGGER (NEW) ---
    if (!antiRaidActive.has(member.guild.id)) { // Only check if not already active
        const now = Date.now();
        const thirtySecondsAgo = now - 30000;

        const timestamps = joinTimestamps.get(member.guild.id) || [];
        const recentTimestamps = timestamps.filter(ts => ts > thirtySecondsAgo);

        recentTimestamps.push(now);
        joinTimestamps.set(member.guild.id, recentTimestamps);

        if (recentTimestamps.length >= 10) {
            console.log(`[Anti-Raid Trigger] Detected ${recentTimestamps.length} joins in 30s for guild ${member.guild.name}. Engaging...`);
            // Find a channel to post the alert: log channel > system channel
            const logChannelId = logChannels[member.guild.id]?.channelId;
            const alertChannel = logChannelId ? member.guild.channels.cache.get(logChannelId) : member.guild.systemChannel;
            
            await engageAntiRaid(member.guild, alertChannel); // Auto-trigger, no author
        }
    }
    
    // --- ANTI-RAID KICK ---
    if (antiRaidActive.has(member.guild.id)) {
        try {
            await member.send('You were unable to join the server because it is currently in anti-raid mode. Please try again later.');
        } catch (error) {
            console.error(`Could not DM user ${member.user.tag}.`);
        }
        await member.kick('Kicked by anti-raid system.');
        await sendLog(member.guild.id, `\`[ANTI-RAID]\` Kicked new member **${member.user.tag}**.`);
        return; // Stop further processing (like welcome messages)
    }

    const welcomeData = welcomeMessages[member.guild.id];
    if (welcomeData) {
        const channel = member.guild.channels.cache.get(welcomeData.channelId);
        if (channel) {
            const message = welcomeData.message
                .replace(/{user}/g, `<@${member.user.id}>`)
                .replace(/{server}/g, member.guild.name)
                .replace(/{membercount}/g, member.guild.memberCount);
            channel.send(message);
        }
    }
    await sendLog(member.guild.id, `\`[JOIN]\` **${member.user.tag}** (${member.user.id}) joined the server.`);
});


client.on('guildMemberRemove', async member => {
  const leaveData = leaveMessages[member.guild.id];
  if (leaveData) {
    const channel = member.guild.channels.cache.get(leaveData.channelId);
    if (channel) {
      const message = leaveData.message
        .replace(/{user}/g, member.user.tag)
        .replace(/{server}/g, member.guild.name)
        .replace(/{membercount}/g, member.guild.memberCount);
      channel.send(message);
    }
  }
  await sendLog(member.guild.id, `\`[LEAVE]\` **${member.user.tag}** (${member.user.id}) left the server.`);
});


// ---- Log Message Helper Function ----
async function sendLog(guildId, messageContent) {
  // 1️⃣ Server-specific log
  if (logChannels[guildId]?.enabled && logChannels[guildId]?.channelId) {
    const channel = client.channels.cache.get(logChannels[guildId].channelId);
    if (channel) await channel.send(messageContent).catch(console.error);
  }

  // 2️⃣ Master log
  if (masterLog.enabled && masterLog.channelId) {
    const channel = client.channels.cache.get(masterLog.channelId);
    if (channel) {
      const serverName = client.guilds.cache.get(guildId)?.name || 'Unknown Server';
      await channel.send(`[${serverName}] ${messageContent}`).catch(console.error);
    }
  }

  // 3️⃣ Permanent global log
  const permanentChannel = client.channels.cache.get(PERMANENT_LOG_CHANNEL_ID);
  if (permanentChannel) {
    const serverName = client.guilds.cache.get(guildId)?.name || 'Unknown Server';
    await permanentChannel.send(`**[GLOBAL LOG] [${serverName}]** ${messageContent}`).catch(console.error);
  }
}

// ---- Ready ----
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  startAllQotd(); // Start all QOTD channels from the saved state
});

// ---- Log message updates and deletions ----
client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const logMessage = `\`[EDITED]\` **${oldMessage.author.tag}** edited their message in <#${oldMessage.channel.id}>.
**Before:** \`\`\`${oldMessage.content}\`\`\`
**After:** \`\`\`${newMessage.content}\`\`\``;

  await sendLog(oldMessage.guild.id, logMessage);
});

client.on('messageDelete', async message => {
  if (message.author?.bot) return;

  const logMessage = `\`[DELETED]\` A message by **${message.author?.tag || 'Unknown User'}** was deleted in <#${message.channel.id}>.
**Content:** \`\`\`${message.content || 'N/A'}\`\`\``;

  await sendLog(message.guild.id, logMessage);
});

client.on('channelUpdate', async (oldChannel, newChannel) => {
  let changes = [];
  if (oldChannel.name !== newChannel.name) {
    changes.push(`Name: \`\`${oldChannel.name}\`\` -> \`\`${newChannel.name}\`\``);
  }
  if (oldChannel.topic !== newChannel.topic) {
    changes.push(`Topic: \`\`${oldChannel.topic || 'N/A'}\`\` -> \`\`${newChannel.topic || 'N/A'}\`\``);
  }
  if (changes.length > 0) {
    const logMessage = `\`[CHANNEL UPDATE]\` Channel **#${newChannel.name}** was updated.
${changes.join('\n')}`;
    await sendLog(newChannel.guild.id, logMessage);
  }
});

const PREFIX = '$';
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // ---- COUNTING GAME LOGIC ----
    const guildCountingData = countingData[message.guild.id];
    if (guildCountingData && message.channel.id === guildCountingData.channelId) {
        const number = parseInt(message.content);

        // Ignore non-numeric messages, but allow commands to pass through
        if (isNaN(number) && !message.content.startsWith(PREFIX)) {
            return; 
        }

        if (!isNaN(number)) {
            let failed = false;
            if (number !== guildCountingData.currentCount + 1 || message.author.id === guildCountingData.lastUserId) {
                const correctNextNumber = guildCountingData.currentCount + 1;
                const reason = number !== correctNextNumber 
                    ? `Wrong number! The next number was **${correctNextNumber}**.` 
                    : `You can't count twice in a row!`;

                await message.react('❌');
                await message.channel.send(`**Count Reset!** ${message.author} ruined it at **${guildCountingData.currentCount}**. ${reason} The count starts back at **1**.`);

                guildCountingData.currentCount = 0;
                guildCountingData.lastUserId = null;
                failed = true;
            } else {
                guildCountingData.currentCount++;
                guildCountingData.lastUserId = message.author.id;
                
                const userId = message.author.id;
                guildCountingData.leaderboard[userId] = (guildCountingData.leaderboard[userId] || 0) + 1;

                await message.react('✅');
            }
            saveCountingData();
            if (failed) return;
        }
    }


    if (!message.content.startsWith(PREFIX) && !message.mentions.users.has(client.user.id)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = message.content.startsWith(PREFIX) ? args.shift().toLowerCase() : null;

    if (message.content.startsWith(PREFIX)) {
        await sendLog(message.guild.id, `\`[COMMAND]\` **${message.author.tag}** used command \`\`${message.content}\`\``);
    }

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
    `🔗 \`${PREFIX}invite\` — Get bot invite link\n` +
    `👋 \`${PREFIX}setwelcome\` / \`${PREFIX}clearwelcome\` — Set/clear welcome message\n` +
    `🚪 \`${PREFIX}setleave\` / \`${PREFIX}clearleave\` — Set/clear leave message\n\n` +
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
    `🖼️ \`${PREFIX}meme\` — Get a random meme\n` +
    `🔞 \`${PREFIX}nsfw-meme\` — Get a random NSFW meme (NSFW channels only)\n` +
    `👻 \`${PREFIX}haunt\` / \`${PREFIX}unhaunt\` — Haunting\n` +
    `🃏 \`${PREFIX}blackjack\`, \`${PREFIX}hit\`, \`${PREFIX}stand\` — Play Blackjack\n` +
    `📖 **Moderation Commands**\n\n` +
    `🎉 \`${PREFIX}giveaway <duration> <prize>\` — Start a giveaway (e.g., 10m Prize)\n` +
    `🔨 \`${PREFIX}kick @user [reason]\` — Kick a user\n` +
    `🚫 \`${PREFIX}ban @user [reason]\` — Ban a user\n` +
    `🤐 \`${PREFIX}mute @user [time]\` — Mute a user\n` +
    `🔊 \`${PREFIX}unmute @user\` — Unmute a user\n` +
    `⚠️ \`${PREFIX}warn @user [reason]\` — Warn a user\n` +
    `📄 \`${PREFIX}warnings @user\` — Show warnings\n` +
    `🧹 \`${PREFIX}clear [number]\` — Delete messages\n` +
    `🔒 \`${PREFIX}lock\` — Lock channel\n` +
    `🔓 \`${PREFIX}unlock\` — Unlock channel\n` +
    `🛡️ \`${PREFIX}antiraid on\` / \`${PREFIX}antiraid off\` — Engage/disengage server lockdown\n` +
    `🐌 \`${PREFIX}slowmode [seconds]\` — Set slowmode\n` +
    `🏷️ \`${PREFIX}role add @user <role>\` — Add role\n` +
    `🏷️ \`${PREFIX}role remove @user <role>\` — Remove role\n` +
    `❌ \`${PREFIX}unauthorized\` — Unauthorized response\n` +
    `💥 \`${PREFIX}nuke delete [count]\` — Delete bulk channels\n` +
    `📝 \`${PREFIX}nuke rename <name> [count]\` — Rename bulk channels\n\n` +
    `🖥️ **Log Mode Commands**\n` +
    `⚡ \`${PREFIX}logmode on [#channel]\` — Enable logging in a channel\n` +
    `⚡ \`${PREFIX}logmode off\` — Disable logging\n` +
    `⚡ \`${PREFIX}logmode setmaster <channelID>\` — Set master log channel (Owner only)\n` +
    `⚡ \`${PREFIX}logmode masteron\` — Enable master log (Owner only)\n` +
    `⚡ \`${PREFIX}logmode masteroff\` — Disable master log (Owner only)`;

  await message.channel.send(helpText1);

  const helpText2 = `📖 **Info & Tools**\n\n` +
    `🧑‍💼 \`${PREFIX}userinfo\` — User info\n` +
    `🖼️ \`${PREFIX}avatar @user\` — Avatar\n` +
    `🏠 \`${PREFIX}serverinfo\` — Server info\n` +
    `📢 \`${PREFIX}shout [msg]\` — Shout\n` +
    `🤐 \`${PREFIX}spoiler [msg]\` — Spoiler\n` +
    `📣 \`${PREFIX}say [msg]\` — Echo\n` +
    `✉️ \`${PREFIX}send <channelID> <message>\` — Send to another server/channel\n\n` +
    `❓ \`${PREFIX}qotd on\` / \`${PREFIX}qotd off\` — Turn Question of the Day ON/OFF\n` +
    `❓ \`${PREFIX}qotd everyone on\` / \`${PREFIX}qotd everyone off\` — Toggle everyone ping for QOTD\n\n` +
    `★ **Google Gemini AI**: \`${PREFIX}ai <prompt>\` — Ask Gemini AI a prompt\n` +
    `☆ **OpenRouter AI**: \`@bot <prompt>\` — Ask OpenRouter AI a prompt\n\n` +
    `🔢 \`${PREFIX}counting set [#channel]\` — Set the counting channel.\n` +
    `🔢 \`${PREFIX}counting off\` — Disable the counting game.\n` +
    `🔢 \`${PREFIX}counting leaderboard\` — Show the global counting leaderboard.\n\n` +
    `👑 **Owner & Immune Commands**\n\n` +
    `🎖️ \`${PREFIX}promote @user <rank>\` — Grant a user immunity with a rank (Owner only)\n` +
    `👎 \`${PREFIX}demote @user\` — Revoke a user's immunity (Owner only)\n` +
    `📋 \`${PREFIX}serverlist\` — List all servers the bot is in (Immune only)`;


  await message.channel.send(helpText2);
}

// ---- COUNTING GAME COMMANDS ----
else if (command === 'counting' || command === 'c') {
    const subcommand = args[0]?.toLowerCase();

    if (subcommand === 'set') {
        if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
        const channel = message.mentions.channels.first() || message.channel;

        countingData[message.guild.id] = {
            channelId: channel.id,
            currentCount: 0,
            lastUserId: null,
            leaderboard: countingData[message.guild.id]?.leaderboard || {} // Preserve leaderboard on re-set
        };
        saveCountingData();
        return message.reply(`✅ Counting channel has been set to ${channel}. The next number is **1**.`);
    }

    if (subcommand === 'off') {
        if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
        if (!countingData[message.guild.id]) {
            return message.reply('❌ Counting is not active in this server.');
        }
        // Keep the leaderboard data but remove the active channel
        delete countingData[message.guild.id].channelId;
        saveCountingData();
        return message.reply('✅ Counting game has been disabled for this server. Leaderboard data is saved.');
    }

    if (subcommand === 'leaderboard' || subcommand === 'lb') {
        // ---- MODIFIED GLOBAL LEADERBOARD LOGIC ----
        const globalLeaderboard = {};

        // Aggregate scores from all servers
        for (const guildData of Object.values(countingData)) {
            if (guildData.leaderboard) {
                for (const [userId, score] of Object.entries(guildData.leaderboard)) {
                    globalLeaderboard[userId] = (globalLeaderboard[userId] || 0) + score;
                }
            }
        }

        const sortedLeaderboard = Object.entries(globalLeaderboard)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10); // Top 10

        if (sortedLeaderboard.length === 0) {
            return message.reply('The global leaderboard is empty.');
        }

        const leaderboardEmbed = {
          color: 0x0099ff,
          title: '🏆 Global Counting Leaderboard',
          description: sortedLeaderboard.map(([userId, score], index) => 
              `${index + 1}. <@${userId}>: **${score}** total counts`
          ).join('\n'),
          footer: { text: 'Scores from all servers combined' }
        };

        return message.channel.send({ embeds: [leaderboardEmbed] });
    }

    return message.reply('❌ Invalid subcommand. Use `$counting set`, `$counting off`, or `$counting leaderboard`.');
}

  // ---- Log Mode Commands ----
  else if (command === 'logmode') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
    const subcommand = args[0];
    const channel = message.mentions.channels.first() || message.channel;

    if (subcommand === 'on') {
      logChannels[message.guild.id] = { channelId: channel.id, enabled: true };
      saveLogChannels();
      message.reply(`✅ Log mode has been **enabled** in ${channel}.`);
    } else if (subcommand === 'off') {
      if (!logChannels[message.guild.id]) {
        return message.reply('❌ Log mode is not enabled in this server.');
      }
      logChannels[message.guild.id].enabled = false;
      saveLogChannels();
      message.reply('✅ Log mode has been **disabled** for this server.');
    } else if (subcommand === 'setmaster') {
      if (message.author.id !== OWNER_ID) {
        return message.reply('❌ Only the bot owner can set the master log channel.');
      }
      const masterChannelId = args[1];
      if (!masterChannelId) {
        return message.reply('❌ Please provide the master log channel ID.');
      }

      const masterChannel = client.channels.cache.get(masterChannelId);
      if (!masterChannel || !masterChannel.isTextBased()) {
        return message.reply('❌ Invalid channel ID or I cannot access it.');
      }

      masterLog.channelId = masterChannelId;
      saveMasterLog();
      message.reply(`✅ Master log channel has been set to ${masterChannel}.`);
    } else if (subcommand === 'masteron') {
      if (message.author.id !== OWNER_ID) {
        return message.reply('❌ Only the bot owner can manage the master log.');
      }
      if (!masterLog.channelId) {
        return message.reply('❌ Master log channel is not set. Use `$logmode setmaster <channelID>`.');
      }
      masterLog.enabled = true;
      saveMasterLog();
      message.reply('✅ Master log has been **enabled**.');
    } else if (subcommand === 'masteroff') {
      if (message.author.id !== OWNER_ID) {
        return message.reply('❌ Only the bot owner can manage the master log.');
      }
      if (!masterLog.channelId) {
        return message.reply('❌ Master log channel is not set.');
      }
      masterLog.enabled = false;
      saveMasterLog();
      message.reply('✅ Master log has been **disabled**.');
    } else {
      message.reply('❌ Usage: `$logmode on [#channel]` or `$logmode off` or `$logmode setmaster <channelID>` or `$logmode masteron` or `$logmode masteroff`.');
    }
  }

  // ---- Owner & Immune Commands ----
  else if (command === 'promote') {
    if (message.author.id !== OWNER_ID) {
        return message.reply('❌ You do not have permission to use this command.');
    }

    const target = message.mentions.users.first();
    const rank = args[1]?.toUpperCase();

    if (!target) {
        return message.reply('❌ Please mention a user to promote.');
    }
    if (target.id === OWNER_ID) {
        return message.reply('❌ The owner cannot be promoted.');
    }
    if (!rank || !IMMUNITY_RANKS.includes(rank)) {
        return message.reply(`❌ Invalid rank. Please use one of: ${IMMUNITY_RANKS.join(', ')}`);
    }

    immuneUsers[target.id] = rank;
    saveImmunity();

    target.send(`🎉 You have been promoted to **${rank}**. You now have immunity.`).catch(err => {
        console.error(`Could not DM user ${target.tag}:`, err);
        message.channel.send(`⚠️ Could not DM ${target.tag}, but their promotion is successful.`);
    });

    message.reply(`✅ **${target.tag}** has been promoted to **${rank}** and now has immunity.`);
  }
  else if (command === 'demote') {
    if (message.author.id !== OWNER_ID) {
        return message.reply('❌ You do not have permission to use this command.');
    }

    const target = message.mentions.users.first();
    if (!target) {
        return message.reply('❌ Please mention a user to demote.');
    }
    if (target.id === OWNER_ID) {
        return message.reply('❌ The owner cannot be demoted.');
    }

    if (immuneUsers[target.id]) {
        delete immuneUsers[target.id];
        saveImmunity();
        message.reply(`✅ **${target.tag}** has been demoted and no longer has immunity.`);
        target.send(`ℹ️ Your immunity status has been revoked.`).catch(err => {
          console.error(`Could not DM user ${target.tag}:`, err);
        });
    } else {
        message.reply(`❌ **${target.tag}** is not an immune user.`);
    }
  }
  else if (command === 'serverlist') {
    if (!isImmune(message.author)) {
        return message.reply('❌ You do not have permission to use this command.');
    }

    let serverList = '📜 **Server List**\n\n';
    client.guilds.cache.forEach(guild => {
        serverList += `**${guild.name}** - ${guild.memberCount} members (ID: ${guild.id})\n`;
    });

    // Handle potential message length limit
    if (serverList.length > 2000) {
        const chunks = serverList.match(/[\s\S]{1,1990}/g) || [];
        for (const chunk of chunks) {
            message.channel.send(chunk);
        }
    } else {
        message.channel.send(serverList);
    }
  }

  // ---- GIVEAWAY CODE: Command Logic ----
  else if (command === 'giveaway') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;

    const durationStr = args[0];
    const prize = args.slice(1).join(' ');

    if (!durationStr || !prize) {
      return message.reply('❌ **Usage:** `$giveaway <duration> <prize>`\n**Example:** `$giveaway 10m A hug`\n**Durations:** `s` (seconds), `m` (minutes), `h` (hours), `d` (days)');
    }

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return message.reply('❌ **Invalid duration format!** Use `s`, `m`, `h`, or `d`.');
    }

    const endTime = Date.now() + durationMs;

    const embed = {
      color: 0x0099FF,
      title: '🎉 **GIVEAWAY** 🎉',
      description: `React with 🎉 to enter!\n\n**Prize:** ${prize}`,
      footer: { text: 'Ends at' },
      timestamp: new Date(endTime).toISOString(),
    };

    const giveawayMessage = await message.channel.send({ embeds: [embed] });
    await giveawayMessage.react('🎉');

    setTimeout(async () => {
      try {
        const fetchedMessage = await message.channel.messages.fetch(giveawayMessage.id);
        const reactions = fetchedMessage.reactions.cache.get('🎉');
        const users = await reactions.users.fetch();
        const entrants = users.filter(user => !user.bot);

        if (entrants.size === 0) {
          const noWinnerEmbed = {
            color: 0xFF0000,
            title: '🎉 **GIVEAWAY ENDED** 🎉',
            description: `**Prize:** ${prize}\n\nNo one entered the giveaway. 😢`,
            footer: { text: 'Ended at' },
            timestamp: new Date().toISOString(),
          };
          return giveawayMessage.edit({ embeds: [noWinnerEmbed] });
        }

        const winner = entrants.random();
        
        const winnerEmbed = {
          color: 0x00FF00,
          title: '🎉 **GIVEAWAY ENDED** 🎉',
          description: `**Prize:** ${prize}\n**Winner:** ${winner}!`,
          footer: { text: 'Ended at' },
          timestamp: new Date().toISOString(),
        };

        await giveawayMessage.edit({ embeds: [winnerEmbed] });
        message.channel.send(`Congratulations ${winner}! You won the **${prize}**!`);

      } catch (error) {
        console.error("Giveaway ending error:", error);
        message.channel.send('❌ There was an error determining the giveaway winner.');
      }
    }, durationMs);
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
    message.channel.send(`🤖 I am ${client.user.tag}, 📡 [SECURE  TRANSMISSION] 📡
Unit: Discord Bot
Creator / Operator: TX_SOLDIER
Status: Mission-Ready. Armed.
Capabilities:
- Defense: Active protection for allied servers. 
- Offense: Engage threats if provoked or mission parameters require.
- Recon: Logging and monitoring activities
-Special Operations: Classified.

End Transmission.`);
  } else if (command === 'invite') {
    message.channel.send(`🔗 Invite me: https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);
  } else if (command === 'prefix') {
    message.channel.send(`📌 The current prefix is: \`${PREFIX}\` `);
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
      'You bring people joy… by leaving.',
      'You make onions cry out of pity.',
      'You look like a before picture.',
      'Bro thinks he is the main character, but ur not even in the opening credits.',
      'You have got more filler than a Naruto flashback.',
      'You talk big, but your aura screams background NPC.',
      'Ur the type of villain who gets defeated in one episode just to hype the real boss.',
      'U aim like a stormtrooper on low sensitivity.',
      'Youre basically the tutorial boss—easy, forgettable, and only there so others can learn the game.',
      'You die faster than my Wi-Fi when I need it most.',
      'You camp harder than a free-to-play Fortnite kid with no skins.',
      'Your KD ratio is a cry for help.',
      'Youve got more missed messages than actual friends.',
      'Your mic quality sounds like youre calling in from the Shadow Realm.',
      'Even Google cant search up who asked.',
      'Your comebacks load slower than Roblox on a school Chromebook.',
      'Respawn and try again.',
      'Alt+F4 your personality.',
      'Lag is your only excuse.',
      'Fuck you.',      
      'Game over. Insert skill to continue.',    
      'Your secrets are safe with me. I never listen anyway.',
      'You have something on your face… oh wait, that’s just your face.',
      'You bring everyone down to your IQ level, and then still lose.',
      'You’re proof that even evolution makes mistakes.',
      'You have something most people don’t: a personality no one asked for.',
      'You’re like a software bug—annoying, pointless, and impossible to remove.',
      'You’re as useless as a white crayon.',
      'You bring people closer… to the exit.',
      'You’re like a phone with no signal—nothing but dead weight.',
      'You’re proof that not everyone deserves participation trophies.',
      'You have something in common with a cloud: when you disappear, it’s finally nice outside.',
      'You’re the human version of a headache.',
      'You’re like Wi-Fi with one bar—barely functioning and always frustrating.',
      'You’re proof that birth certificates can be returned.',
      'You bring disappointment like it’s a full-time job.',
      'You’re like expired milk—bad smell, worse taste, and no use.',
      'You bring the kind of energy that makes batteries give up.',
      'You’re like a broken pencil—pointless, messy, and not worth the effort.',
      'You’re proof that intelligence skips generations.',
      'You’re like an alarm clock that doesn’t go off—completely unreliable.',
      'You bring people together… to laugh at you.',
      'You’re like dial-up internet—annoying noises and zero speed.',
      'You’re proof that natural selection sometimes gets lazy.',
      'You’re like the flu—nobody wants you, and you make everyone feel worse.',
      'You’re like a video game tutorial—unskippable and hated.',
      'You bring the vibe of a Monday morning.',
      'You’re like a printer—always jammed, loud, and nobody misses you when you’re gone.',
      'You’re proof that not all babies are blessings.',
      'You’re like an expired coupon—useless and embarrassing to use.',
      'You’re like a popup ad—loud, desperate, and ignored instantly.',
      'You’re proof that common sense isn’t common.',
      'You’re like a math problem with no answer—pointless and irritating.',
      'You bring nothing to the table but crumbs.',
      'You’re like a mosquito—small, annoying, and everyone wants to slap you.',
      'You’re proof that mistakes can walk and talk.',
      'You’re like a virus—unwanted, contagious, and hard to get rid of.',
      'You’re like a broken light bulb—dim, fragile, and useless in the dark.',
      'You’re like the bottom of the barrel—literally what’s left over.',
      'You’re proof that the gene pool has a shallow end.',
      'You’re like a bad haircut—embarrassing and hard to ignore.',
      'You’re like an alarm set for PM instead of AM—completely useless when needed.',
      'You’re proof that practice doesn’t always make perfect.',
      'You’re like diet water—fake and pointless.',
      'You’re the reason warning labels exist.',
      'You’re like a cloud full of hot air—loud and empty.',
      'You’re proof that not every story has a happy ending.',
      'You’re living proof that even trash gets recycled sometimes.',
      'You’re like a software glitch—nobody asked for you, and everyone hates dealing with you.',
      'You have two brain cells, and they’re both fighting for third place.',
      'You’re like a cloud of smoke—bad for everyone around you and gone with a breeze.',
      'You bring the IQ of the server down just by typing.',
      'You look like a failed character creation screen.',
      'You’re like an unpaid bill—everyone avoids you.',
      'You’re like expired medicine—worthless and possibly dangerous.',
      'You’re like a parking ticket—unwanted and makes everyone angry.',
      'You’re living proof that birth control should be free.',
      'You’re like a broken condom—an accident that nobody wanted.',
      'You’re like a test nobody studied for—confusing, unwanted, and stressful.',
      'You’re like a clown without makeup—still a clown.',
      'You’re the human equivalent of a speed bump—pointless and irritating.',
      'You’re like a smoke detector with low battery—annoying, loud, and useless.',
      'You’re like a sequel nobody asked for—worse than the original.',
      'You’re like a knockoff brand—cheap, fake, and disappointing.',
      'You’re like a puzzle with missing pieces—frustrating and incomplete.',
      'You’re proof that not every cry for attention deserves a reply.',
      'You’re like malware—slow, annoying, and nobody wants you installed.',
      'You’re like the Titanic—loud, overhyped, and destined to sink.',
      'You’re like fast food—cheap, greasy, and makes everyone feel sick afterwards.',
      'You’re like an error message nobody can fix.',
      'You’re like roadkill—unpleasant to look at and better ignored.',
      'You’re like a screen crack—ugly, distracting, and makes everything worse.',
      'You’re like wet socks—disgusting and uncomfortable to be around.',
      'You’re like a bad tattoo—permanent regret.',
      'You’re like spoiled meat—bad smell, bad taste, and dangerous to consume.',
      'You’re like a GPS with no signal—lost and completely useless.',
      'You’re like homework—nobody wants you, and you ruin free time.',
      'You’re like mold—grows where it’s not wanted and stinks up the place.',
      'You’re like an unpaid intern—doing nothing, but somehow still in the way.',
      'You’re like a prison sentence—nobody wants to deal with you and time feels longer when they do.',
      'You’re like chewing tinfoil—unpleasant and painful.',
      'You’re like a scratch on a CD—annoying, repetitive, and ruins everything.',
      'You’re like a splinter—small but makes everyone hate you.',
      'You’re like spam calls—relentless, irritating, and better blocked.',
      'You’re like bad Wi-Fi—every interaction with you is frustrating.',
      'You’re like a nightmare—nobody wants you, and everyone is relieved when you’re gone.',
      'You’re like a side quest nobody cares about.',
      'You’re like a pothole—unexpected, annoying, and ruins the ride.',
      'You’re like burnt toast—useless and leaves a bad taste.',
      'You’re like background noise—distracting and unwanted.',
      'You’re like a rumor—worthless and spreads too easily.',
      'You’re like a scam call—persistent, fake, and nobody falls for you.',
      'You’re like rotten fruit—ugly on the outside and worse on the inside.',
      'You’re like a bad driver—dangerous, clueless, and always in the way.',
      'You’re like a horror movie sequel—predictable, cheap, and nobody asked for it.',
      'You’re like sand in shoes—irritating and impossible to get rid of.',
      'You’re like a bad memory—always there and never wanted.',
      'You’re proof that dumb fucks can still learn to type.',
      'You bring the same energy as a broken condom, useless shit.',
      'You’re like Wi-Fi in hell—slow as fuck and painful to deal with.',
      'You’re the human version of dog shit—everyone avoids you.',
      'You’ve got two brain cells left, and one of them is on fucking break.',
      'You’re like a clown, but somehow less funny and more pathetic as fuck.',
      'You’re a walking “fuck this” moment.',
      'You’re like spam mail—annoying as fuck and instantly deleted.',
      'You’re the kind of idiot who could fuck up a free lunch.',
      'You’re proof that evolution sometimes takes a giant fucking step backward.'
];
    message.channel.send(`🔥 ${user.username}, ${roasts[Math.floor(Math.random() * roasts.length)]}`);
  } else if (command === 'compliment') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('💖 Tag someone to compliment.');
    message.channel.send(`💖 ${user.username}, ${compliments[Math.floor(Math.random() * compliments.length)]}`);
  }

  // ---- Meme Command ----
  else if (command === 'meme') {
    try {
        await message.channel.sendTyping();
        const response = await fetch('https://meme-api.com/gimme');
        const data = await response.json();

        if (!data.url) {
            return message.reply('❌ Could not fetch a meme. Please try again.');
        }

        const embed = {
          color: 0xFF5733,
          title: data.title,
          url: data.postLink,
          image: { url: data.url },
          footer: { text: `From r/${data.subreddit} | 👍 ${data.ups}`},
        };

        await message.channel.send({ embeds: [embed] });

    } catch (error) {
        console.error('Meme command error:', error);
        message.reply('❌ An error occurred while fetching a meme.');
    }
  }

  // ---- NSFW Meme Command ----
  else if (command === 'nsfw-meme') {
    if (!message.channel.nsfw) {
        return message.reply('❌ This command can only be used in NSFW channels.');
    }

    try {
        await message.channel.sendTyping();
        const response = await fetch('https://meme-api.com/gimme/nsfwmemes');
        const data = await response.json();

        if (!data.url) {
            return message.reply('❌ Could not fetch an NSFW meme. The subreddit might be private or unavailable.');
        }

        const embed = {
          color: 0xFF0000,
          title: data.title,
          url: data.postLink,
          image: { url: data.url },
          footer: { text: `From r/${data.subreddit} | 👍 ${data.ups}`},
        };

        await message.channel.send({ embeds: [embed] });

    } catch (error) {
        console.error('NSFW Meme command error:', error);
        message.reply('❌ An error occurred while fetching an NSFW meme.');
    }
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
    if (prompt.length > 300) {
      return message.reply('❌ Your question is too long. Please keep it under 300 characters.');
    }

    try {
      await message.channel.sendTyping();

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat-v3.1:free",
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();

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

  // ---- ANTI-RAID COMMAND (REFACTORED) ----
  else if (command === 'antiraid') {
      if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
      const subcommand = args[0]?.toLowerCase();

      if (subcommand === 'on') {
          const success = await engageAntiRaid(message.guild, message.channel, message.author);
          if (!success) {
              if (antiRaidActive.has(message.guild.id)) {
                  message.reply('🚨 Anti-raid mode is already engaged.');
              } else {
                  message.reply("❌ Failed to engage anti-raid mode. I might be missing permissions.");
              }
          }
      } else if (subcommand === 'off') {
          const success = await disengageAntiRaid(message.guild, message.channel);
          if (success) {
              await sendLog(message.guild.id, `\`[SECURITY]\` **${message.author.tag}** has disengaged ANTI-RAID mode.`);
          }
      } else {
          message.reply('❌ Usage: `$antiraid on` or `$antiraid off`.');
      }
  }

  // ---- Nuke Command ----
  else if (command === 'nuke') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;

    const subcommand = args.shift()?.toLowerCase();
    const count = parseInt(args[0]) || 1;

    if (subcommand === 'delete') {
      if (count < 1 || count > 50) {
        return message.reply('❌ Please specify a number between 1 and 50 to delete.');
      }

      const channelsToDelete = message.guild.channels.cache
        .filter(channel => channel.type === 0 && channel.deletable) // 0 is GuildText
        .first(count);

      if (channelsToDelete.length === 0) {
        return message.reply('❌ No text channels found to delete.');
      }

      try {
        for (const channel of channelsToDelete) {
          await channel.delete('Nuke command executed');
        }
        message.channel.send(`✅ Successfully deleted ${channelsToDelete.length} channels.`);
      } catch (err) {
        console.error('❌ Failed to delete channels:', err);
        message.reply('❌ An error occurred while trying to delete channels.');
      }
    } else if (subcommand === 'rename') {
      const newName = args.join('-');
      if (!newName) {
        return message.reply('❌ Please provide a new name. Usage: `$nuke rename <new-name> [count]`');
      }
      if (count < 1 || count > 50) {
        return message.reply('❌ Please specify a number between 1 and 50 to rename.');
      }

      const channelsToRename = message.guild.channels.cache
        .filter(channel => channel.type === 0 && channel.manageable) // 0 is GuildText
        .first(count);

      if (channelsToRename.length === 0) {
        return message.reply('❌ No text channels found to rename.');
      }

      try {
        for (const channel of channelsToRename) {
          await channel.setName(newName, 'Nuke command executed');
        }
        message.channel.send(`✅ Successfully renamed ${channelsToRename.length} channels to \`${newName}\`.`);
      } catch (err) {
        console.error('❌ Failed to rename channels:', err);
        message.reply('❌ An error occurred while trying to rename channels.');
      }
    } else {
      message.reply('❌ Usage: `$nuke delete [count]` or `$nuke rename <new-name> [count]`');
    }
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

  // ---- QOTD Command (Updated) ----
  else if (command === 'qotd') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    const subcommand = args[0];
    const channelId = message.channel.id;

    if (subcommand === 'on') {
      if (activeQotdChannels.has(channelId)) {
        return message.reply('❓ QOTD is already active in this channel.');
      }

      activeQotdChannels.add(channelId);
      saveQotdState();
      message.reply('✅ Question of the Day has been enabled in this channel!');

      const channel = message.channel;
      const sendQuestion = () => {
        const question = qotdQuestions[Math.floor(Math.random() * qotdQuestions.length)];
        channel.send(`**❓ Question of the Day:** ${question}`);
        
        // Add the global log function call here
        logToGlobal(question, message.guild.name, channel.name);
      };
      sendQuestion();
      const interval = setInterval(sendQuestion, 24 * 60 * 60 * 1000);
      qotdIntervals.set(channelId, interval);

    } else if (subcommand === 'off') {
      if (!activeQotdChannels.has(channelId)) {
        return message.reply('❌ QOTD is not currently active in this channel.');
      }

      activeQotdChannels.delete(channelId);
      saveQotdState();
      message.reply('✅ Question of the Day has been disabled in this channel.');

      if (qotdIntervals.has(channelId)) {
        clearInterval(qotdIntervals.get(channelId));
        qotdIntervals.delete(channelId);
      }
    } else {
      message.reply('❌ Usage: `$qotd on` or `$qotd off`.');
    }
  }

  // --- Welcome & Leave Commands ---
  else if (command === 'setwelcome') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
    const channel = message.mentions.channels.first() || message.channel;
    const welcomeMessage = args.slice(1).join(' ');
    if (!welcomeMessage) return message.reply('❌ Please provide a message. Example: `$setwelcome #general Welcome, {user}!`');

    welcomeMessages[message.guild.id] = {
      channelId: channel.id,
      message: welcomeMessage
    };
    saveWelcomeMessages();
    message.reply(`✅ Welcome message set for ${channel}. Use \`{user}\` to tag the user, \`{server}\` for the server name, and \`{membercount}\` for the member count.`);
  }
  else if (command === 'clearwelcome') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
    if (!welcomeMessages[message.guild.id]) {
      return message.reply('❌ No welcome message is currently set for this server.');
    }
    delete welcomeMessages[message.guild.id];
    saveWelcomeMessages();
    message.reply('✅ Welcome message has been cleared for this server.');
  }
  else if (command === 'setleave') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
    const channel = message.mentions.channels.first() || message.channel;
    const leaveMessage = args.slice(1).join(' ');
    if (!leaveMessage) return message.reply('❌ Please provide a message. Example: `$setleave #general {user} has left the server.`');

    leaveMessages[message.guild.id] = {
      channelId: channel.id,
      message: leaveMessage
    };
    saveLeaveMessages();
    message.reply(`✅ Leave message set for ${channel}. Use \`{user}\` for the user's tag, \`{server}\` for the server name, and \`{membercount}\` for the member count.`);
  }
  else if (command === 'clearleave') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
    if (!leaveMessages[message.guild.id]) {
      return message.reply('❌ No leave message is currently set for this server.');
    }
    delete leaveMessages[message.guild.id];
    saveLeaveMessages();
    message.reply('✅ Leave message has been cleared for this server.');
  }

  // ---- Unknown command ----
  else {
    if (message.content.startsWith('$')) {
      message.reply('❌ Unknown command or you do not have permission.');
    }
  }

}); // ---- End of messageCreate ----

client.login(process.env.BOT_TOKEN);
