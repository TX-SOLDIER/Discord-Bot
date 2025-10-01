require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
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
    GatewayIntentBits.GuildMessageReactions,
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

// ---- ECONOMY/CURRENCY DATA ----
const economyFile = './economy.json';
let economyData = {};

// Cooldowns to prevent spam earning
const messageCooldowns = new Map();
const commandCooldowns = new Map();
const MESSAGE_COOLDOWN = 60 * 1000; // 60 seconds
const COMMAND_COOLDOWN = 30 * 1000; // 30 seconds

function loadEconomyData() {
    if (fs.existsSync(economyFile)) {
        try {
            economyData = JSON.parse(fs.readFileSync(economyFile, 'utf8'));
        } catch (e) {
            console.error("Error parsing economy.json:", e);
        }
    }
}

function saveEconomyData() {
    fs.writeFileSync(economyFile, JSON.stringify(economyData, null, 2));
}

function getBalance(userId) {
    return economyData[userId] || 0;
}

function updateBalance(userId, amount) {
    const currentBalance = getBalance(userId);
    economyData[userId] = Math.max(0, currentBalance + amount); // Ensure balance doesn't go below 0
    return economyData[userId];
}


// ---- [NEW] STORE/PLAYER DATA ----
const storeFile = './store.json';
const playersFile = './players.json';
const battlesFile = './battles.json';
const dwBattlesFile = './dw_battles.json'; // New file for Deadliest Warrior games
let storeData = {};
let playerData = {};
let activeBattles = {};
let activeDWGames = {}; // New object for turn-based games

function loadStoreData() {
    if (fs.existsSync(storeFile)) {
        try {
            storeData = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
        } catch (e) {
            console.error("Error parsing store.json:", e);
        }
    }
}

function saveStoreData() {
    fs.writeFileSync(storeFile, JSON.stringify(storeData, null, 2));
}

function loadPlayerData() {
    if (fs.existsSync(playersFile)) {
        try {
            playerData = JSON.parse(fs.readFileSync(playersFile, 'utf8'));
        } catch (e) {
            console.error("Error parsing players.json:", e);
        }
    }
}

function savePlayerData() {
    fs.writeFileSync(playersFile, JSON.stringify(playerData, null, 2));
}

function loadBattles() {
    if (fs.existsSync(battlesFile)) {
        try {
            activeBattles = JSON.parse(fs.readFileSync(battlesFile, 'utf8'));
        } catch (e) {
            console.error("Error parsing battles.json:", e);
        }
    }
}

function saveBattles() {
    fs.writeFileSync(battlesFile, JSON.stringify(activeBattles, null, 2));
}

// ---- [NEW] DEADLIEST WARRIOR BATTLE DATA ----
function loadDWBattles() {
    if (fs.existsSync(dwBattlesFile)) {
        try {
            activeDWGames = JSON.parse(fs.readFileSync(dwBattlesFile, 'utf8'));
        } catch (e) {
            console.error("Error parsing dw_battles.json:", e);
        }
    }
}

function saveDWBattles() {
    fs.writeFileSync(dwBattlesFile, JSON.stringify(activeDWGames, null, 2));
}


// Helper to get or initialize a player's data
function getPlayerData(userId) {
    if (!playerData[userId]) {
        playerData[userId] = {
            health: 100,
            maxHealth: 100,
            inventory: [], // Array of item IDs
            loadout: {
                weapon: null,
                armor: null,
                throwable: null,
            }
        };
    }
    // Return a deep copy to avoid modifying the original object directly in battles
    return JSON.parse(JSON.stringify(playerData[userId]));
}

// Helper to find an item in the store by its ID
function findItem(itemId) {
    for (const category in storeData) {
        if (storeData[category][itemId]) {
            // Return a copy of the item with its ID and category
            const item = { ...storeData[category][itemId], id: itemId, category };
            if (category === 'modern_weapons' || category === 'medieval_weapons') {
                item.type = 'weapon';
            } else if (category === 'armor') {
                item.type = 'armor';
            } else if (category === 'throwables') {
                item.type = 'throwable';
            } else {
                item.type = 'misc';
            }
            return item;
        }
    }
    return null;
}

function initializeStore() {
    storeData = {
        modern_weapons: {
            glock19: { name: "Glock 19", price: 500, damage: 25, missChance: 10, critChance: 15, headshotChance: 8, description: "Reliable 9mm pistol" },
            m4a1: { name: "M4A1", price: 1200, damage: 35, missChance: 8, critChance: 18, headshotChance: 12, description: "Standard military rifle" },
            ak47: { name: "AK-47", price: 1300, damage: 40, missChance: 12, critChance: 16, headshotChance: 10, description: "Powerful assault rifle" },
            mp5: { name: "MP5", price: 800, damage: 28, missChance: 6, critChance: 20, headshotChance: 9, description: "Fast SMG" },
            desert_eagle: { name: "Desert Eagle", price: 900, damage: 45, missChance: 15, critChance: 25, headshotChance: 15, description: "High caliber handgun" },
            m16: { name: "M16", price: 1400, damage: 38, missChance: 7, critChance: 17, headshotChance: 14, description: "Burst fire rifle" },
            uzi: { name: "Uzi", price: 700, damage: 22, missChance: 9, critChance: 22, headshotChance: 7, description: "Compact machine pistol" },
            scar_h: { name: "SCAR-H", price: 1600, damage: 42, missChance: 9, critChance: 19, headshotChance: 13, description: "Heavy assault rifle" },
            p90: { name: "P90", price: 1100, damage: 30, missChance: 5, critChance: 21, headshotChance: 11, description: "High capacity SMG" },
            barret_m82: { name: "Barrett M82", price: 2500, damage: 75, missChance: 18, critChance: 30, headshotChance: 25, description: "Anti-material rifle" },
            aug: { name: "AUG", price: 1500, damage: 36, missChance: 8, critChance: 18, headshotChance: 12, description: "Bullpup assault rifle" },
            famas: { name: "FAMAS", price: 1250, damage: 34, missChance: 10, critChance: 17, headshotChance: 11, description: "French bullpup rifle" },
            g36c: { name: "G36C", price: 1350, damage: 37, missChance: 7, critChance: 18, headshotChance: 13, description: "German assault rifle" },
            vector: { name: "Vector", price: 1000, damage: 29, missChance: 6, critChance: 23, headshotChance: 10, description: "Advanced SMG" },
            m249: { name: "M249 SAW", price: 2000, damage: 50, missChance: 14, critChance: 20, headshotChance: 12, description: "Light machine gun" },
            hk416: { name: "HK416", price: 1700, damage: 41, missChance: 7, critChance: 19, headshotChance: 14, description: "Elite assault rifle" },
            aa12: { name: "AA-12", price: 1800, damage: 55, missChance: 12, critChance: 22, headshotChance: 10, description: "Auto shotgun" },
            fnfal: { name: "FN FAL", price: 1650, damage: 43, missChance: 9, critChance: 18, headshotChance: 13, description: "Battle rifle" },
            kriss_vector: { name: "Kriss Vector", price: 1450, damage: 33, missChance: 5, critChance: 24, headshotChance: 12, description: "Elite SMG" },
            mk14_ebr: { name: "MK14 EBR", price: 3000, damage: 80, missChance: 6, critChance: 35, headshotChance: 28, description: "Most powerful modern rifle" },
        },
        medieval_weapons: {
            wooden_sword: { name: "Wooden Sword", price: 100, damage: 15, missChance: 15, critChance: 10, headshotChance: 5, description: "Training sword" },
            iron_sword: { name: "Iron Sword", price: 300, damage: 25, missChance: 12, critChance: 15, headshotChance: 8, description: "Basic iron blade" },
            steel_sword: { name: "Steel Sword", price: 600, damage: 35, missChance: 10, critChance: 18, headshotChance: 10, description: "Quality steel blade" },
            battle_axe: { name: "Battle Axe", price: 700, damage: 40, missChance: 13, critChance: 25, headshotChance: 12, description: "Heavy two-handed axe" },
            war_hammer: { name: "War Hammer", price: 800, damage: 42, missChance: 14, critChance: 30, headshotChance: 15, description: "Crushing weapon" },
            mace: { name: "Mace", price: 500, damage: 32, missChance: 11, critChance: 20, headshotChance: 10, description: "Spiked club" },
            flail: { name: "Flail", price: 650, damage: 36, missChance: 16, critChance: 28, headshotChance: 14, description: "Chain weapon" },
            halberd: { name: "Halberd", price: 900, damage: 45, missChance: 12, critChance: 22, headshotChance: 13, description: "Polearm weapon" },
            claymore: { name: "Claymore", price: 1100, damage: 50, missChance: 11, critChance: 24, headshotChance: 14, description: "Scottish greatsword" },
            katana: { name: "Katana", price: 1300, damage: 48, missChance: 8, critChance: 32, headshotChance: 20, description: "Samurai blade" },
            rapier: { name: "Rapier", price: 850, damage: 38, missChance: 9, critChance: 26, headshotChance: 18, description: "Dueling sword" },
            scimitar: { name: "Scimitar", price: 750, damage: 37, missChance: 10, critChance: 23, headshotChance: 12, description: "Curved blade" },
            longsword: { name: "Longsword", price: 950, damage: 43, missChance: 10, critChance: 21, headshotChance: 13, description: "Versatile sword" },
            gladius: { name: "Gladius", price: 700, damage: 34, missChance: 9, critChance: 19, headshotChance: 11, description: "Roman short sword" },
            viking_axe: { name: "Viking Axe", price: 1000, damage: 46, missChance: 12, critChance: 27, headshotChance: 14, description: "Norse weapon" },
            morning_star: { name: "Morning Star", price: 850, damage: 41, missChance: 13, critChance: 29, headshotChance: 16, description: "Spiked mace" },
            zweihander: { name: "Zweihander", price: 1400, damage: 52, missChance: 13, critChance: 26, headshotChance: 15, description: "German greatsword" },
            excalibur: { name: "Excalibur", price: 2200, damage: 65, missChance: 7, critChance: 33, headshotChance: 22, description: "Legendary blade" },
            crusader_sword: { name: "Crusader Sword", price: 1600, damage: 55, missChance: 9, critChance: 28, headshotChance: 17, description: "Holy blade" },
            spartan_spear: { name: "Spartan Spear", price: 2800, damage: 75, missChance: 6, critChance: 38, headshotChance: 30, description: "Most powerful ancient weapon" },
        },
        armor: {
            cloth_armor: { name: "Cloth Armor", price: 200, defense: 5, description: "Basic protection" },
            leather_armor: { name: "Leather Armor", price: 400, defense: 12, description: "Light armor" },
            chainmail: { name: "Chainmail", price: 700, defense: 20, description: "Medieval armor" },
            bronze_armor: { name: "Bronze Armor", price: 600, defense: 18, description: "Ancient armor" },
            iron_armor: { name: "Iron Armor", price: 900, defense: 25, description: "Standard metal armor" },
            steel_armor: { name: "Steel Armor", price: 1200, defense: 32, description: "Quality armor" },
            samurai_armor: { name: "Samurai Armor", price: 1800, defense: 40, description: "Japanese warrior armor" },
            spartan_armor: { name: "Spartan Armor", price: 2000, defense: 45, description: "Greek warrior armor" },
            roman_legion: { name: "Roman Legion Armor", price: 1900, defense: 42, description: "Roman soldier armor" },
            knight_armor: { name: "Knight Armor", price: 2200, defense: 48, description: "Full plate armor" },
            viking_armor: { name: "Viking Armor", price: 1700, defense: 38, description: "Norse warrior armor" },
            crusader_armor: { name: "Crusader Armor", price: 2100, defense: 46, description: "Holy knight armor" },
            dragon_scale: { name: "Dragon Scale Armor", price: 2800, defense: 55, description: "Legendary armor" },
            kevlar_vest: { name: "Kevlar Vest", price: 1500, defense: 35, description: "Bulletproof vest" },
            tactical_vest: { name: "Tactical Vest", price: 1800, defense: 38, description: "Military vest" },
            plate_carrier: { name: "Plate Carrier", price: 2200, defense: 47, description: "Ceramic plate armor" },
            swat_armor: { name: "SWAT Armor", price: 2500, defense: 50, description: "Police tactical armor" },
            riot_gear: { name: "Riot Gear", price: 2000, defense: 44, description: "Full riot armor" },
            juggernaut: { name: "Juggernaut Armor", price: 2700, defense: 53, description: "Heavy assault armor" },
            spec_ops: { name: "Spec Ops Body Armor", price: 3500, defense: 65, description: "Most powerful armor" },
        },
        throwables: {
            smoke_grenade: { name: "Smoke Grenade", price: 300, damage: 0, effect: "blind", effectChance: 80, duration: 2, description: "Blinds enemy, increases miss chance" },
            flashbang: { name: "Flashbang", price: 350, damage: 5, effect: "stun", effectChance: 75, duration: 1, description: "Stuns enemy" },
            frag_grenade: { name: "Frag Grenade", price: 600, damage: 60, effect: "death", effectChance: 40, description: "High damage, chance of instant death if hit" },
            molotov: { name: "Molotov Cocktail", price: 400, damage: 35, effect: "burn", duration: 3, description: "Burns over time" },
            throwing_knife: { name: "Throwing Knife", price: 250, damage: 25, effect: "bleed", duration: 2, description: "Quick damage" },
            shuriken: { name: "Shuriken", price: 300, damage: 20, effect: "bleed", duration: 2, description: "Ninja throwing star" },
            c4: { name: "C4 Explosive", price: 800, damage: 80, effect: "death", effectChance: 50, description: "Massive explosion" },
            tear_gas: { name: "Tear Gas", price: 400, damage: 10, effect: "blind", effectChance: 90, duration: 3, description: "Heavy blind effect" },
        }
    };
    saveStoreData();
}


// Load all data on startup
loadEconomyData();
loadStoreData();
if (Object.keys(storeData).length === 0) {
    initializeStore();
}
loadPlayerData();
loadBattles();
loadDWBattles(); // Load new game data


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

  // --- [NEW] COUNTING GAME EDIT DETECTION ---
  const guildCountingData = countingData[newMessage.guild.id];
  if (guildCountingData && newMessage.channel.id === guildCountingData.channelId) {
    const nextNumber = guildCountingData.currentCount + 1;
    const alertMessage = `⚠️ **EDIT DETECTED!**
**User:** ${oldMessage.author}
**Original Message:** \`${oldMessage.content}\`
**Edited To:** \`${newMessage.content}\`

To avoid confusion, the next number is still **${nextNumber}**.`;
    await newMessage.channel.send(alertMessage);
  }
  // --- END NEW CODE ---

  const logMessage = `\`[EDITED]\` **${oldMessage.author.tag}** edited their message in <#${oldMessage.channel.id}>.
**Before:** \`\`\`${oldMessage.content}\`\`\`
**After:** \`\`\`${newMessage.content}\`\`\``;

  await sendLog(oldMessage.guild.id, logMessage);
});

client.on('messageDelete', async message => {
  if (message.author?.bot) return;

  // --- [NEW] COUNTING GAME DELETE DETECTION ---
  if (message.guild) { // Ensure guild context exists
    const guildCountingData = countingData[message.guild.id];
    if (guildCountingData && message.channel.id === guildCountingData.channelId) {
        const nextNumber = guildCountingData.currentCount + 1;
        const alertMessage = `⚠️ **DELETE DETECTED!**
**User:** ${message.author || 'An unknown user'}
**Deleted Message:** \`${message.content || '(Message content not available)'}\`

To avoid confusion, the next number is **${nextNumber}**.`;
        await message.channel.send(alertMessage);
    }
  }
  // --- END NEW CODE ---

  const logMessage = `\`[DELETED]\` A message by **${message.author?.tag || 'Unknown User'}** was deleted in <#${message.channel.id}>.
**Content:** \`\`\`${message.content || 'N/A'}\`\`\``;

  await sendLog(message.guild.id, logMessage);
});

// ---- BATTLE SYSTEMS: Reaction Handler ----
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    // Handle partial messages
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }
    }
    const battleKey = reaction.message.id;

    // --- Automated Battle System ---
    if (activeBattles[battleKey] && activeBattles[battleKey].status === 'pending') {
        const battle = activeBattles[battleKey];
        if (user.id === battle.defender && reaction.emoji.name === '⚔️') {
            battle.status = 'accepted';
            saveBattles();
            await reaction.message.channel.send(`⚔️ **${user.username}** has accepted the automated battle challenge! The battle begins!`);
            await startBattle(reaction.message.channel, battle.challenger, battle.defender, battleKey);
        }
        return;
    }

    // --- [NEW] Turn-based "Deadliest Warrior" Battle System ---
    const dwGame = activeDWGames[battleKey];
    if (!dwGame) return;

    // Challenge acceptance
    if (dwGame.status === 'pending') {
        if (user.id === dwGame.p2.id && reaction.emoji.name === '⚔️') {
            await startDWBattle(reaction.message, dwGame);
        }
        return;
    }

    // Active game turn handling
    if (dwGame.status === 'active') {
        const currentPlayer = dwGame.turn === dwGame.p1.id ? dwGame.p1 : dwGame.p2;
        if (user.id !== currentPlayer.id) {
             // Remove the reaction if it's not the player's turn
            await reaction.users.remove(user.id).catch(err => console.error("Failed to remove reaction:", err));
            return;
        }

        const actionMap = { '⚔️': 'attack', '🛡️': 'cover', '❤️': 'heal', '💣': 'throwable' };
        const action = actionMap[reaction.emoji.name];

        if (action) {
            // Remove all reactions to prevent multiple inputs
            await reaction.message.reactions.removeAll().catch(err => console.error("Failed to clear reactions:", err));
            await processDWTurn(battleKey, action);
        }
    }
});


// ---- BATTLE SYSTEM: Combat Functions ----
async function startBattle(channel, challengerId, defenderId, battleKey) {
  const p1Data = getPlayerData(challengerId);
  const p2Data = getPlayerData(defenderId);
  
  p1Data.health = p1Data.maxHealth;
  p2Data.health = p2Data.maxHealth;
  
  const p1Weapon = p1Data.loadout.weapon ? findItem(p1Data.loadout.weapon) : null;
  const p2Weapon = p2Data.loadout.weapon ? findItem(p2Data.loadout.weapon) : null;
  const p1Armor = p1Data.loadout.armor ? findItem(p1Data.loadout.armor) : null;
  const p2Armor = p2Data.loadout.armor ? findItem(p2Data.loadout.armor) : null;
  const p1Throwable = p1Data.loadout.throwable ? findItem(p1Data.loadout.throwable) : null;
  const p2Throwable = p2Data.loadout.throwable ? findItem(p2Data.loadout.throwable) : null;

  const challenger = await client.users.fetch(challengerId);
  const defender = await client.users.fetch(defenderId);

  let battleLog = `⚔️ **AUTO BATTLE START** ⚔️\n`;
  battleLog += `**${challenger.username}** vs **${defender.username}**\n\n`;
  battleLog += `**${challenger.username}** | HP: ${p1Data.health} | Weapon: ${p1Weapon ? p1Weapon.name : 'Fists'} | Armor: ${p1Armor ? p1Armor.name : 'None'}\n`;
  battleLog += `**${defender.username}** | HP: ${p2Data.health} | Weapon: ${p2Weapon ? p2Weapon.name : 'Fists'} | Armor: ${p2Armor ? p2Armor.name : 'None'}\n`;

  await channel.send(battleLog);

  let round = 1;
  let p1Effects = {};
  let p2Effects = {};

  while (p1Data.health > 0 && p2Data.health > 0 && round <= 20) {
    let roundLog = `\n**━━━ Round ${round} ━━━**\n`;

    const p1First = Math.random() < 0.5;
    const fighters = p1First ? 
      [{id: challengerId, data: p1Data, weapon: p1Weapon, armor: p1Armor, throwable: p1Throwable, user: challenger, effects: p1Effects},
       {id: defenderId, data: p2Data, weapon: p2Weapon, armor: p2Armor, throwable: p2Throwable, user: defender, effects: p2Effects}] :
      [{id: defenderId, data: p2Data, weapon: p2Weapon, armor: p2Armor, throwable: p2Throwable, user: defender, effects: p2Effects},
       {id: challengerId, data: p1Data, weapon: p1Weapon, armor: p1Armor, throwable: p1Throwable, user: challenger, effects: p1Effects}];

    for (let i = 0; i < 2; i++) {
      if (fighters[0].data.health <= 0 || fighters[1].data.health <= 0) break;

      const attacker = fighters[i];
      const target = fighters[1 - i];

      // Check if using throwable this round (30% chance)
      if (attacker.throwable && Math.random() < 0.3) {
        const throwResult = await executeThrowable(attacker, target, roundLog);
        roundLog += throwResult.log;
        if (throwResult.instantDeath) break;
      } else if (attacker.weapon) {
        const attackResult = await executeAttack(attacker, target);
        roundLog += attackResult;
      } else {
        const fistDamage = 10;
        const actualDamage = Math.max(1, fistDamage - (target.armor ? target.armor.defense * 0.3 : 0));
        target.data.health -= actualDamage;
        roundLog += `👊 **${attacker.user.username}** punches for ${actualDamage.toFixed(1)} damage!\n`;
      }
    }

    // Apply status effects
    for (let fighter of fighters) {
      if (fighter.effects.burn && fighter.effects.burn > 0) {
        const burnDamage = 8;
        fighter.data.health -= burnDamage;
        roundLog += `🔥 **${fighter.user.username}** takes ${burnDamage} burn damage!\n`;
        fighter.effects.burn--;
      }
      if (fighter.effects.bleed && fighter.effects.bleed > 0) {
        const bleedDamage = 5;
        fighter.data.health -= bleedDamage;
        roundLog += `🩸 **${fighter.user.username}** takes ${bleedDamage} bleed damage!\n`;
        fighter.effects.bleed--;
      }
      if (fighter.effects.blind && fighter.effects.blind > 0) {
        fighter.effects.blind--;
      }
    }

    roundLog += `\n**${challenger.username}**: ${Math.max(0, p1Data.health).toFixed(0)} HP\n`;
    roundLog += `**${defender.username}**: ${Math.max(0, p2Data.health).toFixed(0)} HP\n`;

    await channel.send(roundLog);
    await new Promise(resolve => setTimeout(resolve, 2000));

    round++;
  }

  // Determine winner
  let resultLog = `\n**━━━ BATTLE END ━━━**\n`;
  let winnerId, winnerName, reward = 500;

  if (p1Data.health > p2Data.health) {
    winnerId = challengerId;
    winnerName = challenger.username;
    resultLog += `🏆 **${challenger.username}** wins with ${p1Data.health.toFixed(0)} HP remaining!\n`;
  } else if (p2Data.health > p1Data.health) {
    winnerId = defenderId;
    winnerName = defender.username;
    resultLog += `🏆 **${defender.username}** wins with ${p2Data.health.toFixed(0)} HP remaining!\n`;
  } else {
    resultLog += `🤝 It's a draw! Both fighters are equally matched!\n`;
    reward = 250;
  }

  if (winnerId) {
    updateBalance(winnerId, reward);
    saveEconomyData();
    resultLog += `💰 **${winnerName}** earned ${reward} Gold Coins!\n`;
  } else {
    updateBalance(challengerId, reward);
    updateBalance(defenderId, reward);
    saveEconomyData();
    resultLog += `💰 Both fighters earned ${reward} Gold Coins for their effort!\n`;
  }

  await channel.send(resultLog);

  delete activeBattles[battleKey];
  saveBattles();
  // We don't save player data because health should reset after battle
}

async function executeAttack(attacker, target) {
  let log = '';
  const weapon = attacker.weapon;
  const baseDamage = weapon.damage || 10;

  // Check for miss
  let missChance = weapon.missChance || 10;
  if (attacker.effects.blind && attacker.effects.blind > 0) {
    missChance += 30;
  }

  if (Math.random() * 100 < missChance) {
    log += `❌ **${attacker.user.username}** missed with ${weapon.name}!\n`;
    return log;
  }

  // Check for headshot
  if (Math.random() * 100 < (weapon.headshotChance || 5)) {
    const headshotDamage = baseDamage * 2;
    const actualDamage = Math.max(1, headshotDamage - (target.armor ? target.armor.defense * 0.4 : 0));
    target.data.health -= actualDamage;
    log += `🎯 **HEADSHOT!** **${attacker.user.username}** hits **${target.user.username}** with ${weapon.name} for ${actualDamage.toFixed(1)} damage!\n`;
    return log;
  }

  // Check for critical hit
  if (Math.random() * 100 < (weapon.critChance || 10)) {
    const critDamage = baseDamage * 1.5;
    const actualDamage = Math.max(1, critDamage - (target.armor ? target.armor.defense * 0.5 : 0));
    target.data.health -= actualDamage;
    log += `💥 **CRITICAL HIT!** **${attacker.user.username}** strikes **${target.user.username}** with ${weapon.name} for ${actualDamage.toFixed(1)} damage!\n`;
    return log;
  }

  // Normal hit
  const actualDamage = Math.max(1, baseDamage - (target.armor ? target.armor.defense * 0.6 : 0));
  target.data.health -= actualDamage;
  log += `⚔️ **${attacker.user.username}** hits **${target.user.username}** with ${weapon.name} for ${actualDamage.toFixed(1)} damage!\n`;

  return log;
}

async function executeThrowable(attacker, target, currentLog) {
  const throwable = attacker.throwable;
  let log = `💣 **${attacker.user.username}** throws ${throwable.name}!\n`;
  let instantDeath = false;

  // Base damage
  if (throwable.damage > 0) {
    const actualDamage = Math.max(1, throwable.damage - (target.armor ? target.armor.defense * 0.3 : 0));
    target.data.health -= actualDamage;
    log += `💥 ${throwable.name} deals ${actualDamage.toFixed(1)} damage to **${target.user.username}**!\n`;
  }

  // Apply effects
  if (throwable.effect && Math.random() * 100 < (throwable.effectChance || 50)) {
    switch (throwable.effect) {
      case 'blind':
        target.effects.blind = throwable.duration || 2;
        log += `😵 **${target.user.username}** is blinded! Miss chance increased!\n`;
        break;
      case 'stun':
        log += `⚡ **${target.user.username}** is stunned!\n`;
        break;
      case 'burn':
        target.effects.burn = throwable.duration || 3;
        log += `🔥 **${target.user.username}** is burning!\n`;
        break;
      case 'bleed':
        target.effects.bleed = throwable.duration || 2;
        log += `🩸 **${target.user.username}** is bleeding!\n`;
        break;
      case 'death':
        if (Math.random() < 0.7) {
          target.data.health = 0;
          instantDeath = true;
          log += `☠️ **INSTANT DEATH!** **${target.user.username}** was eliminated by ${throwable.name}!\n`;
        } else {
          log += `🛡️ **${target.user.username}** took cover and survived the explosion!\n`;
        }
        break;
    }
  }

  return { log, instantDeath };
}


// ---- [NEW] DEADLIEST WARRIOR FUNCTIONS ----

async function startDWBattle(message, game) {
    game.status = 'active';
    game.p1.health = 100;
    game.p2.health = 100;
    game.p1.healsLeft = 3;
    game.p2.healsLeft = 3;
    game.p1.inCover = false;
    game.p2.inCover = false;
    game.round = 1;
    game.turn = game.p1.id;
    game.log = `**${game.p2.name}** accepted the challenge! The battle begins!`;
    
    saveDWBattles();
    await updateDWEmbed(message.channel, message.id);
}

async function updateDWEmbed(channel, messageId) {
    const game = activeDWGames[messageId];
    if (!game) return;

    const message = await channel.messages.fetch(messageId);
    if (!message) return;

    const currentPlayer = game.turn === game.p1.id ? game.p1 : game.p2;
    const waitingPlayer = game.turn === game.p1.id ? game.p2 : game.p1;
    
    const embed = new EmbedBuilder()
        .setColor('#C70039')
        .setTitle(`DEADLIEST WARRIOR - Round ${game.round}/30`)
        .setDescription(`**Last Action:**\n${game.log}\n\nIt's **${currentPlayer.name}**'s turn to act!`)
        .addFields(
            { name: `🔴 ${game.p1.name}`, value: `**HP:** ${game.p1.health}/100\n**Heals:** ${game.p1.healsLeft}\n**Cover:** ${game.p1.inCover ? 'Yes' : 'No'}`, inline: true },
            { name: `🔵 ${game.p2.name}`, value: `**HP:** ${game.p2.health}/100\n**Heals:** ${game.p2.healsLeft}\n**Cover:** ${game.p2.inCover ? 'Yes' : 'No'}`, inline: true }
        )
        .setImage('https://i.imgur.com/8f1V3gI.gif') // General battle GIF
        .setFooter({ text: '⚔️ Attack | 🛡️ Take Cover | ❤️ Heal | 💣 Use Throwable' });

    await message.edit({ embeds: [embed], content: `${currentPlayer.name}, it's your turn!` });
    
    // Add reactions for the current player
    await message.react('⚔️');
    await message.react('🛡️');
    await message.react('❤️');
    if (currentPlayer.throwable) { // Only show throwable if they have one
        await message.react('💣');
    }
}

async function processDWTurn(messageId, action) {
    const game = activeDWGames[messageId];
    if (!game) return;

    const channel = await client.channels.fetch(game.channelId);
    const attacker = game.turn === game.p1.id ? game.p1 : game.p2;
    const target = game.turn === game.p1.id ? game.p2 : game.p1;
    let actionLog = '';
    let gameOver = false;

    // Reset attacker's cover status at the start of their turn
    attacker.inCover = false;

    switch (action) {
        case 'attack': {
            const weapon = attacker.weapon;
            if (!weapon) {
                 actionLog = `👊 **${attacker.name}** has no weapon and attacks with their fists!`;
                 target.health -= 5;
            } else {
                const missChance = weapon.missChance || 10;
                if (Math.random() * 100 < missChance) {
                    actionLog = `❌ **${attacker.name}** attacked with ${weapon.name} but missed!`;
                } else {
                    let damage = weapon.damage || 10;
                    if (target.inCover) {
                        damage *= 0.5; // 50% damage reduction if target is in cover
                        actionLog += `🛡️ **${target.name}** was in cover and took reduced damage!\n`;
                    }
                    const defense = target.armor ? target.armor.defense * 0.4 : 0;
                    const actualDamage = Math.max(1, damage - defense);
                    target.health = Math.max(0, target.health - actualDamage);
                    actionLog += `⚔️ **${attacker.name}** hits **${target.name}** with ${weapon.name} for **${actualDamage.toFixed(1)}** damage!`;
                }
            }
            break;
        }
        case 'cover': {
            attacker.inCover = true;
            actionLog = `🛡️ **${attacker.name}** takes cover, preparing for the next attack!`;
            break;
        }
        case 'heal': {
            if (attacker.healsLeft > 0) {
                const healAmount = 25;
                attacker.health = Math.min(100, attacker.health + healAmount);
                attacker.healsLeft--;
                actionLog = `❤️ **${attacker.name}** healed for **${healAmount}** HP!`;
            } else {
                actionLog = `❌ **${attacker.name}** is out of heals!`;
            }
            break;
        }
        case 'throwable': {
            const throwable = attacker.throwable;
            if (!throwable) {
                actionLog = `❌ **${attacker.name}** has no throwable item equipped!`;
            } else {
                let damage = throwable.damage || 0;
                if (target.inCover) {
                    damage *= 0.6; // Cover helps a bit against explosives
                }
                 const defense = target.armor ? target.armor.defense * 0.2 : 0;
                 const actualDamage = Math.max(1, damage - defense);
                 target.health = Math.max(0, target.health - actualDamage);
                 actionLog = `💣 **${attacker.name}** used **${throwable.name}**, dealing **${actualDamage.toFixed(1)}** damage to **${target.name}**!`;
                 attacker.throwable = null; // Throwable is consumed
            }
            break;
        }
    }

    game.log = actionLog;

    // Check for win/loss
    if (target.health <= 0) {
        gameOver = true;
        await endDWBattle(channel, messageId, attacker, target);
    } else if (game.turn === game.p2.id) { // End of a full round
        game.round++;
    }

    if (game.round > 30 && !gameOver) {
        gameOver = true;
        await endDWBattle(channel, messageId, null, null, true); // It's a draw
    }

    if (!gameOver) {
        game.turn = target.id; // Switch turns
        saveDWBattles();
        await updateDWEmbed(channel, messageId);
    }
}

async function endDWBattle(channel, messageId, winner, loser, isDraw = false) {
    const game = activeDWGames[messageId];
    if (!game) return;

    let embed;
    const reward = 750;
    const drawReward = 350;

    if (isDraw) {
        updateBalance(game.p1.id, drawReward);
        updateBalance(game.p2.id, drawReward);
        embed = new EmbedBuilder()
            .setColor('#FFFF00')
            .setTitle('DEADLIEST WARRIOR - DRAW')
            .setDescription(`After 30 rounds, neither warrior could claim victory!\nBoth **${game.p1.name}** and **${game.p2.name}** have earned **${drawReward}** Gold Coins!`)
            .setImage('https://i.imgur.com/c6QZ8vG.gif');
    } else {
        updateBalance(winner.id, reward);
        embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`DEADLIEST WARRIOR - ${winner.name} WINS!`)
            .setDescription(`🏆 **${winner.name}** has defeated **${loser.name}**!\n💰 **${winner.name}** earned **${reward}** Gold Coins!`)
            .setImage('https://i.imgur.com/Fuhs8b3.gif');
    }
    
    saveEconomyData();
    await channel.send({ embeds: [embed] });
    
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if(message) await message.reactions.removeAll().catch(err => console.error("Could not clear reactions on finished game"));

    delete activeDWGames[messageId];
    saveDWBattles();
}

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

    // ---- [NEW] ECONOMY - EARN FOR CHATTING ----
    if (!message.content.startsWith(PREFIX)) {
        const now = Date.now();
        const lastMessage = messageCooldowns.get(message.author.id);
        if (!lastMessage || now - lastMessage > MESSAGE_COOLDOWN) {
            updateBalance(message.author.id, 1); // Award 1 Gold Coin
            messageCooldowns.set(message.author.id, now);
            saveEconomyData();
        }
    }


    // ---- COUNTING GAME LOGIC ----
    const guildCountingData = countingData[message.guild.id];
    if (guildCountingData && message.channel.id === guildCountingData.channelId) {
        // Allow commands to pass through
        if (message.content.startsWith(PREFIX)) {
            // Do nothing, let command handler below take over
        } else {
            const number = parseInt(message.content);

            // Ignore non-numeric messages
            if (isNaN(number)) {
                return; 
            }

            let failed = false;
            if (number !== guildCountingData.currentCount + 1 || message.author.id === guildCountingData.lastUserId) {
                const correctNextNumber = guildCountingData.currentCount + 1;
                const reason = number !== correctNextNumber 
                    ? `Wrong number noob! Learn to count.The next number was **${correctNextNumber}**.` 
                    : `You can't count twice in a row you noob smh. Pay attention !`;

                await message.react('❌');
                await message.channel.send(`**Count Reset!** ${message.author} ruined it at **${guildCountingData.currentCount}**. ${reason} The count starts back at **1**.`);

                guildCountingData.currentCount = 0;
                guildCountingData.lastUserId = null;
                failed = true;
            } else {
                guildCountingData.currentCount++;
                guildCountingData.lastUserId = message.author.id;
                
                if (guildCountingData.currentCount > (guildCountingData.highScore || 0)) {
                    guildCountingData.highScore = guildCountingData.currentCount;
                }

                const userId = message.author.id;
                guildCountingData.leaderboard[userId] = (guildCountingData.leaderboard[userId] || 0) + 1;
                
                // [NEW] ECONOMY - EARN FOR COUNTING
                updateBalance(message.author.id, 5); // Award 5 Gold Coins
                saveEconomyData();

                await message.react('✅');
            }
            saveCountingData();
            if (failed) return;
        }
    }


    if (!message.content.startsWith(PREFIX) && !message.mentions.users.has(client.user.id)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = message.content.startsWith(PREFIX) ? args.shift().toLowerCase() : null;

    if (command) {
        // ---- [NEW] ECONOMY - EARN FOR USING COMMANDS ----
        const now = Date.now();
        const lastCommand = commandCooldowns.get(message.author.id);
        if (!lastCommand || now - lastCommand > COMMAND_COOLDOWN) {
            updateBalance(message.author.id, 2); // Award 2 Gold Coins
            commandCooldowns.set(message.author.id, now);
            saveEconomyData();
        }

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
  // 1️⃣ Utility & Fun/Games
  const embed1 = new EmbedBuilder()
    .setTitle('📖 Bot Commands – Utility & Fun')
    .setColor(0x39FF14)
    .setDescription(
      `📌 **Utility Commands**\n` +
      `• \`${PREFIX}prefix\` – Show the bot prefix\n` +
      `• \`${PREFIX}ping\` – Check bot response time\n` +
      `• \`${PREFIX}stats\` – Server member stats\n` +
      `• \`${PREFIX}uptime\` – Bot active time\n` +
      `• \`${PREFIX}botinfo\` – Info about the bot\n` +
      `• \`${PREFIX}invite\` – Get bot invite link\n` +
      `• \`${PREFIX}setwelcome\` / \`${PREFIX}clearwelcome\` – Set/clear welcome message\n` +
      `• \`${PREFIX}setleave\` / \`${PREFIX}clearleave\` – Set/clear leave message\n\n` +

      `🪙 **Fun & Games**\n` +
      `• \`${PREFIX}flip\` – Flip a coin\n` +
      `• \`${PREFIX}8ball [question]\` – Magic 8-ball\n` +
      `• \`${PREFIX}dice\` – Roll a die\n` +
      `• \`${PREFIX}rate @user\` – Rate someone\n` +
      `• \`${PREFIX}howgay @user\` – Gay meter\n` +
      `• \`${PREFIX}sus @user\` – Sus meter\n` +
      `• \`${PREFIX}truth\` – Truth question\n` +
      `• \`${PREFIX}dare\` – Dare\n` +
      `• \`${PREFIX}roast @user\` – Roast\n` +
      `• \`${PREFIX}compliment @user\` – Compliment\n` +
      `• \`${PREFIX}meme\` – Random meme\n` +
      `• \`${PREFIX}nsfw-meme\` – Random NSFW meme (NSFW channels only)\n` +
      `• \`${PREFIX}haunt\` / \`${PREFIX}unhaunt\` – Haunting\n` +
      `• \`${PREFIX}blackjack\`, \`${PREFIX}hit\`, \`${PREFIX}stand\` – Play Blackjack`
    );

  // 2️⃣ Moderation & Log Mode
  const embed2 = new EmbedBuilder()
    .setTitle('🎯 Moderation & Logging')
    .setColor(0x39FF14)
    .setDescription(
      `🎉 **Moderation Commands**\n` +
      `• \`${PREFIX}giveaway <duration> <prize>\` – Start a giveaway\n` +
      `• \`${PREFIX}kick @user [reason]\` – Kick a user\n` +
      `• \`${PREFIX}ban @user [reason]\` – Ban a user\n` +
      `• \`${PREFIX}mute @user [time]\` – Mute a user\n` +
      `• \`${PREFIX}unmute @user\` – Unmute a user\n` +
      `• \`${PREFIX}warn @user [reason]\` – Warn a user\n` +
      `• \`${PREFIX}warnings @user\` – Show warnings\n` +
      `• \`${PREFIX}clear [number]\` – Delete messages\n` +
      `• \`${PREFIX}lock\` / \`${PREFIX}unlock\` – Lock/unlock channel\n` +
      `• \`${PREFIX}antiraid on/off\` – Engage/disengage server lockdown\n` +
      `• \`${PREFIX}slowmode [seconds]\` – Set slowmode\n` +
      `• \`${PREFIX}role add/remove @user <role>\` – Manage roles\n` +
      `• \`${PREFIX}unauthorized\` – Unauthorized response\n` +
      `• \`${PREFIX}nuke delete [count]\` – Delete bulk channels\n` +
      `• \`${PREFIX}nuke rename <n> [count]\` – Rename bulk channels\n\n` +

      `🖥️ **Log Mode Commands**\n` +
      `• \`${PREFIX}logmode on [#channel]\` – Enable logging\n` +
      `• \`${PREFIX}logmode off\` – Disable logging\n` +
      `• \`${PREFIX}logmode setmaster <channelID>\` – Set master log (Owner only)\n` +
      `• \`${PREFIX}logmode masteron/off\` – Enable/disable master log (Owner only)`
    );

  // 3️⃣ QOTD, Counting, Info, AI, Economy, Battle, Owner
  const embed3 = new EmbedBuilder()
    .setTitle('🔢 QOTD, Counting, Economy & Battle')
    .setColor(0x39FF14)
    .setDescription(
      `❓ **Question of the Day**\n` +
      `• \`${PREFIX}qotd on/off\` – Enable/disable QOTD in channel\n` +
      `• \`${PREFIX}qotd everyone on/off\` – Enable/disable @everyone ping\n\n` +

      `🔢 **Counting Game**\n` +
      `• \`${PREFIX}counting set [#channel]\` – Set counting channel\n` +
      `• \`${PREFIX}counting off\` – Disable counting game\n` +
      `• \`${PREFIX}counting leaderboard\` – Show global leaderboard\n\n` +

      `🧑‍💼 **Info & Tools**\n` +
      `• \`${PREFIX}userinfo\` – User info\n` +
      `• \`${PREFIX}avatar @user\` – Avatar\n` +
      `• \`${PREFIX}serverinfo\` – Server info\n` +
      `• \`${PREFIX}shout [msg]\` – Shout\n` +
      `• \`${PREFIX}spoiler [msg]\` – Spoiler\n` +
      `• \`${PREFIX}say [msg]\` – Echo\n` +
      `• \`${PREFIX}send <channelID> <message>\` – Send elsewhere\n\n` +

      `🤖 **AI Commands**\n` +
      `• \`${PREFIX}ai <prompt>\` – Ask Google Gemini AI\n` +
      `• \`@bot <prompt>\` – Ask OpenRouter AI\n\n` +

      `💰 **Economy Commands**\n` +
      `• \`${PREFIX}balance [@user]\` – Check balance\n` +
      `• \`${PREFIX}pay @user <amount>\` – Pay coins\n` +
      `• \`${PREFIX}give/take @user <amount>\` – Owner & Immune only\n\n` +

      `🪖 **Battle System**\n` +
      `• \`${PREFIX}store [buy <item_id>]\` – Shop\n` +
      `• \`${PREFIX}inventory [@user]\` – View inventory\n` +
      `• \`${PREFIX}loadout [equip/unequip <item_id>]\` – Manage loadout\n` +
      `• \`${PREFIX}battle @user\` – Automated 1v1 battle\n` +
      `• \`${PREFIX}dw @user\` – Turn-based "Deadliest Warrior" battle\n\n` +

      `👑 **Owner & Immune Commands**\n` +
      `• \`${PREFIX}promote/demote @user <rank>\` – Grant/revoke immunity\n` +
      `• \`${PREFIX}serverlist\` – List servers\n` +
      `• \`${PREFIX}store add/remove ...\` – Manage shop\n\n` +

      `🏅 **Immunity Ranks:** 2LT, 1LT, CPT, MAJ, LTC, COL, BG, MG, LTG, GEN\n\n` +

      `💰 **Economy Permissions:**\n` +
      `• Bot Owner: Full control\n` +
      `• Immune Users: Give/take except owner\n` +
      `• Normal Users: Can only pay coins`
    )
    .setFooter({ text: 'Use $help for full command list 📖' })
    .setImage('https://i.imgur.com/NAneRS5.gif'); // permanent image

  // Send embeds
  await message.channel.send({ embeds: [embed1] });
  await message.channel.send({ embeds: [embed2] });
  await message.channel.send({ embeds: [embed3] });
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
            highScore: countingData[message.guild.id]?.highScore || 0, // Preserve high score on re-set
            leaderboard: countingData[message.guild.id]?.leaderboard || {} // Preserve user score leaderboard on re-set
        };
        saveCountingData();
        return message.reply(`✅ Counting channel has been set to ${channel}. The next number is **1**.`);
    }

    if (subcommand === 'off') {
        if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
        if (!countingData[message.guild.id]) {
            return message.reply('❌ Counting is not active in this server.');
        }
        // Keep the data but remove the active channel
        delete countingData[message.guild.id].channelId;
        saveCountingData();
        return message.reply('✅ Counting game has been disabled for this server. All data is saved.');
    }

    if (subcommand === 'leaderboard' || subcommand === 'lb') {
        const serverHighScores = [];

        for (const [guildId, guildData] of Object.entries(countingData)) {
            // Only include servers with a recorded high score
            if (guildData.highScore && guildData.highScore > 0) {
                const guild = client.guilds.cache.get(guildId);
                if (guild) { // Ensure the bot is still in the guild
                    serverHighScores.push({
                        name: guild.name,
                        score: guildData.highScore
                    });
                }
            }
        }

        if (serverHighScores.length === 0) {
            return message.reply('The global leaderboard is empty. No high scores have been set yet!');
        }

        // Sort from highest score to lowest
        serverHighScores.sort((a, b) => b.score - a.score);

        const leaderboardEmbed = {
          color: 0x0099ff,
          title: '🏆 Global High Score Leaderboard',
          description: serverHighScores
            .slice(0, 20) // Show top 20 servers
            .map((entry, index) => 
              `${index + 1}. **${entry.name}**: ${entry.score}`
          ).join('\n'),
          footer: { text: 'Highest number reached in each server' }
        };

        return message.channel.send({ embeds: [leaderboardEmbed] });
    }

    return message.reply('❌ Invalid subcommand. Use `$counting set`, `$counting off`, or `$counting leaderboard`.');
}

// ---- ECONOMY COMMANDS ----
else if (command === 'balance' || command === 'bal') {
    const target = message.mentions.users.first() || message.author;
    const balance = getBalance(target.id);
    message.reply(`💰 **${target.username}** has **${balance}** Gold Coins.`);
}

else if (command === 'give' || command === 'add') {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!target) return message.reply('❌ Please mention a user.');
    if (isNaN(amount) || amount <= 0) return message.reply('❌ Please provide a valid positive amount of Gold Coins.');
    
    // Owner can give to anyone including themselves
    if (message.author.id === OWNER_ID) {
        updateBalance(target.id, amount);
        saveEconomyData();
        return message.reply(`✅ Gave **${amount}** Gold Coins to **${target.username}**.`);
    }
    
    // Immune users can give to anyone EXCEPT the owner
    if (isImmune(message.author)) {
        if (target.id === OWNER_ID) {
            return message.reply('❌ You cannot modify the owner\'s balance.');
        }
        updateBalance(target.id, amount);
        saveEconomyData();
        return message.reply(`✅ Gave **${amount}** Gold Coins to **${target.username}**.`);
    }
    
    // Normal users cannot use this command
    return message.reply('❌ You do not have permission to use this command.');
}

else if (['take', 'remove', 'subtract'].includes(command)) {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!target) return message.reply('❌ Please mention a user.');
    if (isNaN(amount) || amount <= 0) return message.reply('❌ Please provide a valid positive amount of Gold Coins.');

    // Owner can take from anyone including themselves
    if (message.author.id === OWNER_ID) {
        updateBalance(target.id, -amount);
        saveEconomyData();
        return message.reply(`✅ Took **${amount}** Gold Coins from **${target.username}**.`);
    }
    
    // Immune users can take from anyone EXCEPT the owner
    if (isImmune(message.author)) {
        if (target.id === OWNER_ID) {
            return message.reply('❌ You cannot modify the owner\'s balance.');
        }
        updateBalance(target.id, -amount);
        saveEconomyData();
        return message.reply(`✅ Took **${amount}** Gold Coins from **${target.username}**.`);
    }
    
    // Normal users cannot use this command
    return message.reply('❌ You do not have permission to use this command.');
}

// NEW: Pay command for normal users
else if (command === 'pay') {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!target) return message.reply('❌ Please mention a user to pay.');
    if (target.id === message.author.id) return message.reply('❌ You cannot pay yourself.');
    if (target.bot) return message.reply('❌ You cannot pay bots.');
    if (isNaN(amount) || amount <= 0) return message.reply('❌ Please provide a valid positive amount.');
    
    const senderBalance = getBalance(message.author.id);
    if (senderBalance < amount) {
        return message.reply(`❌ You don't have enough Gold Coins. You have **${senderBalance}**, but tried to pay **${amount}**.`);
    }
    
    updateBalance(message.author.id, -amount);
    updateBalance(target.id, amount);
    saveEconomyData();
    
    message.reply(`✅ You paid **${amount}** Gold Coins to **${target.username}**.`);
}
  
// ---- [NEW] STORE, INVENTORY, LOADOUT COMMANDS ----
else if (command === 'store') {
    const subcommand = args[0]?.toLowerCase();

    // Immune-only commands to manage the store
    if (subcommand === 'add') {
        if (!isImmune(message.author)) return message.reply('❌ You are not authorized to manage the store.');
        
        const [_, category, itemId, price, ...nameParts] = args;
        const itemName = nameParts.join(' ');
        const priceNum = parseInt(price);

        if (!category || !itemId || !price || !itemName) {
            return message.reply('❌ Usage: `$store add <category> <item_id> <price> <name>`');
        }
        if (isNaN(priceNum) || priceNum < 0) return message.reply('❌ Invalid price.');
        if (!storeData[category]) return message.reply(`❌ Invalid category. Valid categories are: ${Object.keys(storeData).join(', ')}`);
        if (findItem(itemId)) return message.reply('❌ An item with that ID already exists.');

        storeData[category][itemId] = { name: itemName, price: priceNum, description: "Added via command.", stats: {}, effects: [] };
        saveStoreData();
        return message.reply(`✅ Added **${itemName}** (\`${itemId}\`) to the store for **${priceNum}** Gold Coins.`);
    }

    if (subcommand === 'remove') {
        if (!isImmune(message.author)) return message.reply('❌ You are not authorized to manage the store.');
        const itemId = args[1];
        if (!itemId) return message.reply('❌ Usage: `$store remove <item_id>`');

        const item = findItem(itemId);
        if (!item) return message.reply('❌ Item not found.');

        delete storeData[item.category][item.id];
        saveStoreData();
        return message.reply(`✅ Removed **${item.name}** (\`${itemId}\`) from the store.`);
    }

    if (subcommand === 'buy') {
        const itemId = args[1];
        if (!itemId) return message.reply('❌ Please specify an item ID to buy. Example: `$store buy glock19`');

        const item = findItem(itemId);
        if (!item) return message.reply('❌ That item does not exist.');

        const balance = getBalance(message.author.id);
        if (balance < item.price) {
            return message.reply(`❌ You don't have enough Gold Coins. You need **${item.price}**, but you only have **${balance}**.`);
        }

        const userPData = getPlayerData(message.author.id);
        if (userPData.inventory.includes(itemId)) {
            return message.reply('❌ You already own this item.');
        }

        updateBalance(message.author.id, -item.price);
        
        // This is a bit tricky, we need to modify the actual player data, not the copy
        const actualPlayerData = playerData[message.author.id] || getPlayerData(message.author.id);
        actualPlayerData.inventory.push(itemId);
        savePlayerData();
        
        saveEconomyData();
        return message.reply(`✅ You purchased **${item.name}** for **${item.price}** Gold Coins!`);
    }

    // Default: View store
    const storeEmbed = {
        color: 0x0099ff,
        title: '🏪 Item Store',
        description: 'Use `$store buy <item_id>` to purchase an item.',
        fields: []
    };

    for (const category in storeData) {
        const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        let itemsText = '';
        for (const itemId in storeData[category]) {
            const item = storeData[category][itemId];
            itemsText += `**${item.name}** - ${item.price} 🪙\n*ID: \`${itemId}\`*\n`;
        }
        if (itemsText) {
            storeEmbed.fields.push({ name: `--- ${categoryName} ---`, value: itemsText, inline: false });
        }
    }
    return message.channel.send({ embeds: [storeEmbed] });
}

else if (command === 'inventory' || command === 'inv') {
    const target = message.mentions.users.first() || message.author;
    const userPData = getPlayerData(target.id);

    const invEmbed = {
        color: 0x34eb6b,
        title: `🛍️ ${target.username}'s Inventory`,
        description: ''
    };
    
    if (userPData.inventory.length === 0) {
        invEmbed.description = 'This inventory is empty.';
    } else {
        const categorizedItems = { weapon: [], armor: [], throwable: [], misc: [] };

        userPData.inventory.forEach(itemId => {
            const item = findItem(itemId);
            if(item && categorizedItems[item.type]) {
                categorizedItems[item.type].push(`- **${item.name}** (\`${item.id}\`)`);
            } else if (item) {
                 categorizedItems.misc.push(`- **${item.name}** (\`${item.id}\`)`);
            }
        });
        
        let desc = '';
        if (categorizedItems.weapon.length > 0) desc += `**Weapons**\n${categorizedItems.weapon.join('\n')}\n\n`;
        if (categorizedItems.armor.length > 0) desc += `**Armor**\n${categorizedItems.armor.join('\n')}\n\n`;
        if (categorizedItems.throwable.length > 0) desc += `**Throwables**\n${categorizedItems.throwable.join('\n')}\n\n`;
        if (categorizedItems.misc.length > 0) desc += `**Miscellaneous**\n${categorizedItems.misc.join('\n')}\n\n`;

        invEmbed.description = desc.trim();
    }

    return message.channel.send({ embeds: [invEmbed] });
}

else if (command === 'loadout') {
    const subcommand = args[0]?.toLowerCase();
    const itemId = args[1];

    if (subcommand === 'equip') {
        if (!itemId) return message.reply('❌ Usage: `$loadout equip <item_id>`');
        
        const userPData = getPlayerData(message.author.id);
        if (!userPData.inventory.includes(itemId)) {
            return message.reply("❌ You don't own that item. Buy it from the store first.");
        }

        const item = findItem(itemId);
        if (!item || item.type === 'misc') return message.reply("❌ This item cannot be equipped.");

        // Modify the actual player data
        const actualPlayerData = playerData[message.author.id];
        actualPlayerData.loadout[item.type] = item.id;
        savePlayerData();
        return message.reply(`✅ Equipped **${item.name}**.`);
    }

    if (subcommand === 'unequip') {
        const slot = args[1]?.toLowerCase();
        if (!['weapon', 'armor', 'throwable'].includes(slot)) {
            return message.reply("❌ Usage: `$loadout unequip <weapon|armor|throwable>`");
        }
        
        // Modify the actual player data
        const actualPlayerData = playerData[message.author.id];
        const equippedItemId = actualPlayerData.loadout[slot];
        if (!equippedItemId) return message.reply(`❌ You don't have a ${slot} equipped.`);

        const item = findItem(equippedItemId);
        actualPlayerData.loadout[slot] = null;
        savePlayerData();
        return message.reply(`✅ Unequipped **${item.name}**.`);
    }

    // Default: View loadout
    const target = message.mentions.users.first() || message.author;
    const userPData = getPlayerData(target.id);
    const loadout = userPData.loadout;

    const weapon = loadout.weapon ? findItem(loadout.weapon) : null;
    const armor = loadout.armor ? findItem(loadout.armor) : null;
    const throwable = loadout.throwable ? findItem(loadout.throwable) : null;
    
    const loadoutEmbed = {
        color: 0xf5b042,
        title: `⚔️ ${target.username}'s Loadout`,
        fields: [
            { name: '❤️ Health', value: `${userPData.health}/${userPData.maxHealth}`, inline: false },
            { name: '🔫 Weapon', value: weapon ? `**${weapon.name}** (\`${weapon.id}\`)` : 'None', inline: true },
            { name: '🛡️ Armor', value: armor ? `**${armor.name}** (\`${armor.id}\`)` : 'None', inline: true },
            { name: '💣 Throwable', value: throwable ? `**${throwable.name}** (\`${throwable.id}\`)` : 'None', inline: true },
        ],
        footer: { text: "Use `$loadout equip <id>` or `$loadout unequip <slot>`" }
    };

    return message.channel.send({ embeds: [loadoutEmbed] });
}

// ---- Automated Battle Command ----
else if (command === 'battle' || command === '1v1') {
    const target = message.mentions.users.first();

    if (!target) return message.reply('❌ Please mention someone to battle! Example: `$battle @user`');
    if (target.id === message.author.id) return message.reply('❌ You cannot battle yourself!');
    if (target.bot) return message.reply('❌ You cannot battle a bot!');

    const challengerData = getPlayerData(message.author.id);
    const defenderData = getPlayerData(target.id);

    if (!challengerData.loadout.weapon) return message.reply('❌ You need to equip a weapon first! Use `$loadout equip <item_id>`');
    if (!defenderData.loadout.weapon) return message.reply(`❌ ${target.username} doesn't have a weapon equipped!`);

    const challengeEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('⚔️ AUTOMATED BATTLE CHALLENGE ⚔️')
        .setDescription(`**${message.author.username}** has challenged **${target.username}** to an automated 1v1 battle!\n\n` +
                        `**${target.username}**, react with ⚔️ to accept the challenge!\n\n` +
                        `This battle will resolve automatically.`)
        .addFields(
            { name: `${message.author.username}'s Loadout`, value: `🔫 ${challengerData.loadout.weapon ? findItem(challengerData.loadout.weapon).name : 'None'}`, inline: true },
            { name: `${target.username}'s Loadout`, value: `🔫 ${defenderData.loadout.weapon ? findItem(defenderData.loadout.weapon).name : 'None'}`, inline: true }
        )
        .setImage("https://i.imgur.com/yourTopBattle.gif")
        .setFooter({ text: 'Challenge expires in 60 seconds' });

    const challengeMsg = await message.channel.send({ embeds: [challengeEmbed] });
    await challengeMsg.react('⚔️');

    // Store battle data
    activeBattles[challengeMsg.id] = {
        challenger: message.author.id,
        defender: target.id,
        status: 'pending',
        timestamp: Date.now()
    };
    saveBattles();

    // Auto-cancel after 60 seconds
    setTimeout(() => {
        if (activeBattles[challengeMsg.id] && activeBattles[challengeMsg.id].status === 'pending') {
            delete activeBattles[challengeMsg.id];
            saveBattles();
            message.channel.send(`⏱️ The automated battle challenge from **${message.author.username}** to **${target.username}** has expired.`);
        }
    }, 60000);
}

// ---- [NEW] DEADLIEST WARRIOR BATTLE COMMAND ----
else if (command === 'dw' || command === 'deadliestwarrior') {
    const target = message.mentions.users.first();

    if (!target) return message.reply('❌ Please mention someone to battle! Example: `$dw @user`');
    if (target.id === message.author.id) return message.reply('❌ You cannot battle yourself!');
    if (target.bot) return message.reply('❌ You cannot battle a bot!');

    const challengerData = getPlayerData(message.author.id);
    const defenderData = getPlayerData(target.id);

    if (!challengerData.loadout.weapon) return message.reply('❌ You need to equip a weapon first! Use `$loadout equip <item_id>`');
    if (!defenderData.loadout.weapon) return message.reply(`❌ ${target.username} doesn't have a weapon equipped!`);

    const challengeEmbed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle("🔥 TX SOLDIER'S DEADLIEST WARRIOR 🔥")
        .setDescription(`**${message.author.username}** has challenged **${target.username}** to a turn-based duel to the death!\n\n` +
                        `**${target.username}**, react with ⚔️ to accept the challenge!\n\n` +
                        `This is a turn-based battle. You will choose your actions each round.`)
        .addFields(
            { name: `${message.author.username}'s Loadout`, value: `🔫 ${challengerData.loadout.weapon ? findItem(challengerData.loadout.weapon).name : 'None'}\n🛡️ ${challengerData.loadout.armor ? findItem(challengerData.loadout.armor).name : 'None'}\n💣 ${challengerData.loadout.throwable ? findItem(challengerData.loadout.throwable).name : 'None'}`, inline: true },
            { name: `${target.username}'s Loadout`, value: `🔫 ${defenderData.loadout.weapon ? findItem(defenderData.loadout.weapon).name : 'None'}\n🛡️ ${defenderData.loadout.armor ? findItem(defenderData.loadout.armor).name : 'None'}\n💣 ${defenderData.loadout.throwable ? findItem(defenderData.loadout.throwable).name : 'None'}`, inline: true }
        )
        .setImage('https://i.imgur.com/eT824xG.gif')
        .setFooter({ text: 'Challenge expires in 60 seconds' });

    const challengeMsg = await message.channel.send({ embeds: [challengeEmbed] });
    await challengeMsg.react('⚔️');

    activeDWGames[challengeMsg.id] = {
        channelId: message.channel.id,
        status: 'pending',
        p1: { id: message.author.id, name: message.author.username, weapon: findItem(challengerData.loadout.weapon), armor: findItem(challengerData.loadout.armor), throwable: findItem(challengerData.loadout.throwable) },
        p2: { id: target.id, name: target.username, weapon: findItem(defenderData.loadout.weapon), armor: findItem(defenderData.loadout.armor), throwable: findItem(defenderData.loadout.throwable) },
    };
    saveDWBattles();

    // Auto-cancel after 60 seconds
    setTimeout(() => {
        if (activeDWGames[challengeMsg.id] && activeDWGames[challengeMsg.id].status === 'pending') {
            delete activeDWGames[challengeMsg.id];
            saveDWBattles();
            message.channel.send(`⏱️ The Deadliest Warrior challenge from **${message.author.username}** to **${target.username}** has expired.`);
        }
    }, 60000);
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
    const sent = await message.channel.send({ content: "🏓 Pinging..." });
    const pingEmbed = {
      color: 0x39FF14,
      title: "🏓 Pong!",
      description: `Latency is **${sent.createdTimestamp - message.createdTimestamp}ms**\nAPI Latency is **${Math.round(client.ws.ping)}ms**`,
      thumbnail: { url: "https://i.imgur.com/Abo2D8x.gif" } // shows GIF in corner
    };
    await sent.edit({ content: "", embeds: [pingEmbed] });
  } else if (command === 'stats') {
    message.channel.send(`📊 Server has ${message.guild.memberCount} members.`);
  } else if (command === 'uptime') {
    const uptime = Math.floor(process.uptime());
    message.channel.send(`⏱️ Bot uptime: ${uptime} seconds.`);
  } else if (command === 'botinfo') {
    const botInfoEmbed = new EmbedBuilder()
      .setColor(0x00FFFF) // Cyan color, you can change
      .setTitle(`🤖 ${client.user.tag} — Bot Info`)
      .setDescription(`📡 [SECURE TRANSMISSION] 📡\n\n**Unit:** Discord Bot\n**Creator / Operator:** TX_SOLDIER\n**Status:** Mission-Ready. Armed.`)
      .addFields(
        { name: 'Capabilities', value: 
          `**Defense:** Active protection for allied servers.\n` +
          `**Offense:** Engage threats if provoked or mission parameters require.\n` +
          `**Recon:** Logging and monitoring activities\n` +
          `**Special Operations:** Classified.` }
      )
      .setImage("https://i.imgur.com/yourTopGif.gif") // Top GIF
      .setFooter({ text: 'End Transmission.', iconURL: "https://i.imgur.com/yourBottomGif.gif" }); // Bottom GIF in footer
    message.channel.send({ embeds: [botInfoEmbed] });
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
    const responses = ['Yes.', 'No.', 'Maybe.', 'Ask again later.', 'Definitely!', 'I dont think so.'];
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
    if (playerTotal > 21) {
        result += `💥 You busted! Dealer wins.`;
    } else if (dealerTotal > 21) {
        result += `🎉 Dealer busted! You win! You earned **25** Gold Coins.`;
        updateBalance(message.author.id, 25);
        saveEconomyData();
    } else if (playerTotal > dealerTotal) {
        result += `🎉 You win! You earned **25** Gold Coins.`;
        updateBalance(message.author.id, 25);
        saveEconomyData();
    } else if (playerTotal < dealerTotal) {
        result += `😢 Dealer wins.`;
    } else {
        result += `🤝 It’s a tie!`;
    }
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

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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
    if (message.content.startsWith('$') && command) { // Check if it was a command attempt
      message.reply('❌ Unknown command or you do not have permission.');
    }
  }

}); // ---- End of messageCreate ----

client.login(process.env.BOT_TOKEN);
