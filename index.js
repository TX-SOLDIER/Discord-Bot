require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

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
  if (user.id === OWNER_ID) return true;
  return !!immuneUsers[user.id];
}

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

const hauntedChannels = new Set();
const hauntIntervals = new Map();
const antiRaidActive = new Set();
const originalVerificationLevels = new Map();
const joinTimestamps = new Map();

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

const economyFile = './economy.json';
let economyData = {};
const messageCooldowns = new Map();
const commandCooldowns = new Map();
const MESSAGE_COOLDOWN = 60 * 1000;
const COMMAND_COOLDOWN = 30 * 1000;

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
    economyData[userId] = currentBalance + amount;
    return economyData[userId];
}

const storeFile = './store.json';
const playersFile = './players.json';
const battlesFile = './battles.json';
let storeData = {};
let playerData = {};
let activeBattles = {};

function loadStoreData() {
    if (fs.existsSync(storeFile)) {
        try {
            storeData = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
        } catch (e) {
            console.error("Error parsing store.json:", e);
        }
    } else {
        initializeStore();
        saveStoreData();
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

function getPlayerData(userId) {
    if (!playerData[userId]) {
        playerData[userId] = {
            health: 100,
            maxHealth: 100,
            inventory: [],
            loadout: {
                weapon: null,
                armor: null,
                throwable: null,
            }
        };
    }
    return playerData[userId];
}

function findItem(itemId) {
    for (const category in storeData) {
        if (storeData[category][itemId]) {
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
}

loadEconomyData();
loadStoreData();
loadPlayerData();
loadBattles();

const spookyMessages = [
  '👻 Boo...', '💀 I see you...', '🩸 The shadows are watching...',
  '🔪 Behind you...', '🕷️ Something crawled across your screen...',
];

const spicyTruths = [
  "What's your most embarrassing moment?",
  "Who was your first crush?",
  "Have you ever lied to get out of trouble?",
  "What's the most childish thing you still do?",
  "What's a secret you've never told anyone here?",
];

const spicyDares = [
  "Change your nickname to something silly for 10 minutes.",
  "Type your next 3 messages in ALL CAPS.",
  "Send a random emoji in the chat every 10 seconds for 1 minute.",
  "Say something nice about the last person who spoke.",
  "Do 10 pushups (or pretend to and tell us how it went).",
];

const compliments = [
  "You have great taste in music.",
  "Your energy makes the chat better.",
  "You are so damn fine.",
  "If you were a snack id eat u up.",
  "You have an amazing vibe.",
];

const warningsFile = './warnings.json';
let warnings = {};

if (fs.existsSync(warningsFile)) {
  warnings = JSON.parse(fs.readFileSync(warningsFile, 'utf8'));
}

function saveWarnings() {
  fs.writeFileSync(warningsFile, JSON.stringify(warnings, null, 2));
}

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

const qotdQuestions = [
    "What's the best movie you've seen recently?",
    "If you could have any superpower, what would it be?",
    "What's your favorite food and why?",
];

const logChannelsFile = './log_channels.json';
const masterLogFile = './master_log.json';
const welcomeFile = './welcome_messages.json';
const leaveFile = './leave_messages.json';
const qotdFile = './qotd_state.json';

let logChannels = {};
let masterLog = { channelId: null, enabled: false };
let welcomeMessages = {};
let leaveMessages = {};
let activeQotdChannels = new Set();
const qotdIntervals = new Map();

const PERMANENT_LOG_CHANNEL_ID = '1340123830071050270';

if (fs.existsSync(logChannelsFile)) {
  logChannels = JSON.parse(fs.readFileSync(logChannelsFile, 'utf8'));
}

if (fs.existsSync(masterLogFile)) {
  masterLog = JSON.parse(fs.readFileSync(masterLogFile, 'utf8'));
}

if (fs.existsSync(welcomeFile)) {
  welcomeMessages = JSON.parse(fs.readFileSync(welcomeFile, 'utf8'));
}

if (fs.existsSync(leaveFile)) {
  leaveMessages = JSON.parse(fs.readFileSync(leaveFile, 'utf8'));
}

if (fs.existsSync(qotdFile)) {
  const qotdState = JSON.parse(fs.readFileSync(qotdFile, 'utf8'));
  activeQotdChannels = new Set(qotdState.channels || []);
}

function saveLogChannels() {
  fs.writeFileSync(logChannelsFile, JSON.stringify(logChannels, null, 2));
}

function saveMasterLog() {
  fs.writeFileSync(masterLogFile, JSON.stringify(masterLog, null, 2));
}

function saveWelcomeMessages() {
  fs.writeFileSync(welcomeFile, JSON.stringify(welcomeMessages, null, 2));
}

function saveLeaveMessages() {
  fs.writeFileSync(leaveFile, JSON.stringify(leaveMessages, null, 2));
}

function saveQotdState() {
  fs.writeFileSync(qotdFile, JSON.stringify({ channels: Array.from(activeQotdChannels) }, null, 2));
}

function startAllQotd() {
  activeQotdChannels.forEach(channelId => {
    const channel = client.channels.cache.get(channelId);
    if (channel) {
      const sendQuestion = () => {
        const question = qotdQuestions[Math.floor(Math.random() * qotdQuestions.length)];
        channel.send(`**❓ Question of the Day:** ${question}`);
      };
      const interval = setInterval(sendQuestion, 24 * 60 * 60 * 1000);
      qotdIntervals.set(channelId, interval);
    }
  });
}

function logToGlobal(question, serverName, channelName) {
  const permanentChannel = client.channels.cache.get(PERMANENT_LOG_CHANNEL_ID);
  if (permanentChannel) {
    permanentChannel.send(`**[QOTD] [${serverName}] #${channelName}:** ${question}`).catch(console.error);
  }
}

async function engageAntiRaid(guild, channel, author) {
  if (antiRaidActive.has(guild.id)) {
    return false;
  }

  try {
    const currentLevel = guild.verificationLevel;
    originalVerificationLevels.set(guild.id, currentLevel);
    await guild.setVerificationLevel(4, 'Anti-raid mode engaged');
    antiRaidActive.add(guild.id);
    
    await channel.send(`🚨 **ANTI-RAID MODE ENGAGED** by ${author}\n\n` +
      `🔒 Verification level set to **HIGHEST**\n` +
      `⚠️ New members will face strict verification\n` +
      `✅ Server is now in lockdown mode`);

    await sendLog(guild.id, `\`[SECURITY]\` **${author.tag}** has engaged ANTI-RAID mode.`);
    return true;
  } catch (err) {
    console.error('Failed to engage anti-raid mode:', err);
    return false;
  }
}

async function disengageAntiRaid(guild, channel) {
  if (!antiRaidActive.has(guild.id)) {
    channel.send('❌ Anti-raid mode is not currently active.');
    return false;
  }

  try {
    const originalLevel = originalVerificationLevels.get(guild.id) || 0;
    await guild.setVerificationLevel(originalLevel, 'Anti-raid mode disengaged');
    
    antiRaidActive.delete(guild.id);
    originalVerificationLevels.delete(guild.id);
    
    await channel.send(`✅ **ANTI-RAID MODE DISENGAGED**\n\n` +
      `🔓 Verification level restored to original setting\n` +
      `✅ Server security has returned to normal`);
    
    return true;
  } catch (err) {
    console.error('Failed to disengage anti-raid mode:', err);
    channel.send('❌ Failed to disengage anti-raid mode. I might be missing permissions.');
    return false;
  }
}

client.on('guildMemberAdd', async (member) => {
  const guildId = member.guild.id;
  
  if (antiRaidActive.has(guildId)) {
    const now = Date.now();
    joinTimestamps.set(member.id, now);
    
    const logMsg = `⚠️ **ANTI-RAID ALERT**\n` +
      `New member joined during lockdown: ${member.user.tag} (${member.id})\n` +
      `Account created: ${member.user.createdAt.toDateString()}`;
    
    await sendLog(guildId, logMsg);
  }

  const welcomeConfig = welcomeMessages[guildId];
  if (welcomeConfig) {
    const channel = member.guild.channels.cache.get(welcomeConfig.channelId);
    if (channel) {
      const message = welcomeConfig.message
        .replace(/\{user\}/g, member.toString())
        .replace(/\{server\}/g, member.guild.name)
        .replace(/\{membercount\}/g, member.guild.memberCount.toString());
      channel.send(message).catch(console.error);
    }
  }
});

client.on('guildMemberRemove', async (member) => {
  const guildId = member.guild.id;
  const leaveConfig = leaveMessages[guildId];
  
  if (leaveConfig) {
    const channel = member.guild.channels.cache.get(leaveConfig.channelId);
    if (channel) {
      const message = leaveConfig.message
        .replace(/\{user\}/g, member.user.tag)
        .replace(/\{server\}/g, member.guild.name)
        .replace(/\{membercount\}/g, member.guild.memberCount.toString());
      channel.send(message).catch(console.error);
    }
  }
});

async function sendLog(guildId, messageContent) {
  const guildLog = logChannels[guildId];
  if (guildLog && guildLog.enabled) {
    const channel = client.channels.cache.get(guildLog.channelId);
    if (channel) {
      await channel.send(messageContent).catch(console.error);
    }
  }

  if (masterLog.enabled && masterLog.channelId) {
    const channel = client.channels.cache.get(masterLog.channelId);
    if (channel) {
      const serverName = client.guilds.cache.get(guildId)?.name || 'Unknown Server';
      await channel.send(`[${serverName}] ${messageContent}`).catch(console.error);
    }
  }

  const permanentChannel = client.channels.cache.get(PERMANENT_LOG_CHANNEL_ID);
  if (permanentChannel) {
    const serverName = client.guilds.cache.get(guildId)?.name || 'Unknown Server';
    await permanentChannel.send(`**[GLOBAL LOG] [${serverName}]** ${messageContent}`).catch(console.error);
  }
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  startAllQotd();
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author.bot) return;
  if (oldMessage.content === newMessage.content) return;

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

  const logMessage = `\`[EDITED]\` **${oldMessage.author.tag}** edited their message in <#${oldMessage.channel.id}>.
**Before:** \`\`\`${oldMessage.content}\`\`\`
**After:** \`\`\`${newMessage.content}\`\`\``;

  await sendLog(oldMessage.guild.id, logMessage);
});

client.on('messageDelete', async message => {
  if (message.author?.bot) return;

  if (message.guild) {
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

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  const battleKey = reaction.message.id;
  if (activeBattles[battleKey] && activeBattles[battleKey].status === 'pending') {
    const battle = activeBattles[battleKey];
    
    if (user.id === battle.defender && reaction.emoji.name === '⚔️') {
      battle.status = 'accepted';
      saveBattles();
      
      await reaction.message.channel.send(`⚔️ **${user.username}** has accepted the challenge! The battle begins!`);
      await startBattle(reaction.message.channel, battle.challenger, battle.defender, battleKey);
    }
  }
});

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

  let battleLog = `⚔️ **BATTLE START** ⚔️\n`;
  battleLog += `**${challenger.username}** vs **${defender.username}**\n\n`;

  let round = 1;
  let p1Effects = {};
  let p2Effects = {};

  while (p1Data.health > 0 && p2Data.health > 0 && round <= 20) {
    battleLog += `\n**━━━ Round ${round} ━━━**\n`;

    const p1First = Math.random() < 0.5;
    const fighters = p1First ? 
      [{id: challengerId, data: p1Data, weapon: p1Weapon, armor: p1Armor, throwable: p1Throwable, user: challenger, effects: p1Effects},
       {id: defenderId, data: p2Data, weapon: p2Weapon, armor: p2Armor, throwable: p2Throwable, user: defender, effects: p2Effects}] :
      [{id: defenderId, data: p2Data, weapon: p2Weapon, armor: p2Armor, throwable: p2Throwable, user: defender, effects: p2Effects},
       {id: challengerId, data: p1Data, weapon: p1Weapon, armor: p1Armor, throwable: p1Throwable, user: challenger, effects: p1Effects}];

    for (let i = 0; i < 2; i++) {
      const attacker = fighters[i];
      const target = fighters[1 - i];

      if (attacker.data.health <= 0) continue;

      let damage = 0;
      let attackMsg = '';

      if (round === 1 && attacker.throwable && Math.random() < 0.7) {
        const throwable = attacker.throwable;
        attackMsg = `${attacker.user.username} throws ${throwable.name}! `;
        
        if (throwable.effect === 'death' && Math.random() * 100 < throwable.effectChance) {
          if (Math.random() < 0.5) {
            target.data.health = 0;
            attackMsg += `💀 INSTANT KILL! ${target.user.username} couldn't take cover in time!`;
          } else {
            attackMsg += `${target.user.username} took cover! Avoided instant death but took ${throwable.damage} damage!`;
            damage = throwable.damage;
          }
        } else if (throwable.effect === 'blind' && Math.random() * 100 < throwable.effectChance) {
          target.effects.blind = throwable.duration || 2;
          attackMsg += `💨 ${target.user.username} is blinded!`;
          damage = throwable.damage;
        } else {
          damage = throwable.damage;
          attackMsg += `Hit for ${damage} damage!`;
        }
      } else if (attacker.weapon) {
        const weapon = attacker.weapon;
        attackMsg = `${attacker.user.username} attacks with ${weapon.name}! `;

        let missChance = weapon.missChance;
        if (target.effects.blind && target.effects.blind > 0) {
          missChance = Math.min(missChance * 2, 90);
        }

        if (Math.random() * 100 < missChance) {
          attackMsg += `❌ MISS!`;
        } else {
          damage = weapon.damage;
          const roll = Math.random() * 100;
          
          if (roll < weapon.headshotChance) {
            damage = Math.floor(damage * 2.5);
            attackMsg += `🎯 HEADSHOT! ${damage} damage!`;
          } else if (roll < weapon.headshotChance + weapon.critChance) {
            damage = Math.floor(damage * 1.8);
            attackMsg += `💥 CRITICAL HIT! ${damage} damage!`;
          } else {
            attackMsg += `Hit for ${damage} damage!`;
          }
        }
      } else {
        attackMsg = `${attacker.user.username} punches! `;
        if (Math.random() < 0.3) {
          attackMsg += `❌ MISS!`;
        } else {
          damage = 10;
          attackMsg += `Hit for ${damage} damage!`;
        }
      }

      if (damage > 0 && target.armor) {
        const reduction = Math.floor(damage * (target.armor.defense / 100));
        damage = Math.max(1, damage - reduction);
        attackMsg += ` (${target.armor.name} reduced damage)`;
      }

      target.data.health = Math.max(0, target.data.health - damage);
      battleLog += attackMsg + `\n`;
      battleLog += `${target.user.username}: ${target.data.health}/${target.data.maxHealth} HP\n`;

      if (target.effects.blind && target.effects.blind > 0) {
        target.effects.blind--;
      }

      if (target.data.health <= 0) break;
    }

    round++;

    if (battleLog.length > 1500) {
      await channel.send(battleLog);
      battleLog = '';
    }
  }

  let winner, loser;
  if (p1Data.health > 0) {
    winner = challenger;
    loser = defender;
  } else {
    winner = defender;
    loser = challenger;
  }

  battleLog += `\n🏆 **${winner.username} WINS!** 🏆\n`;
  battleLog += `Reward: **500** Gold Coins`;

  await channel.send(battleLog);

  updateBalance(winner.id, 500);
  saveEconomyData();
  savePlayerData();

  delete activeBattles[battleKey];
  saveBattles();
}

const PREFIX = '$';
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (!message.content.startsWith(PREFIX)) {
        const now = Date.now();
        const lastMessage = messageCooldowns.get(message.author.id);
        if (!lastMessage || now - lastMessage > MESSAGE_COOLDOWN) {
            updateBalance(message.author.id, 1);
            messageCooldowns.set(message.author.id, now);
            saveEconomyData();
        }
    }

    const guildCountingData = countingData[message.guild.id];
    if (guildCountingData && message.channel.id === guildCountingData.channelId) {
        const number = parseInt(message.content);

        if (isNaN(number) && !message.content.startsWith(PREFIX)) {
            return; 
        }

        if (!isNaN(number)) {
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
                
                updateBalance(message.author.id, 5);
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
        const now = Date.now();
        const lastCommand = commandCooldowns.get(message.author.id);
        if (!lastCommand || now - lastCommand > COMMAND_COOLDOWN) {
            updateBalance(message.author.id, 2);
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
    `❓ \`${PREFIX}qotd on\` / \`${PREFIX}qotd off\` — Turn Question of the Day ON/OFF\n\n` +
    `★ **Google Gemini AI**: \`${PREFIX}ai <prompt>\` — Ask Gemini AI a prompt\n` +
    `☆ **OpenRouter AI**: \`@bot <prompt>\` — Ask OpenRouter AI a prompt\n\n` +
    `🔢 \`${PREFIX}counting set [#channel]\` — Set the counting channel.\n` +
    `🔢 \`${PREFIX}counting off\` — Disable the counting game.\n` +
    `🔢 \`${PREFIX}counting leaderboard\` — Show the global high score leaderboard.\n\n` +
    `💰 **Economy Commands**\n\n` +
    `🪙 \`${PREFIX}balance [@user]\` — Check your or another user's Gold Coin balance.\n` +
    `➕ \`${PREFIX}give @user <amount>\` — Give Gold Coins to a user (Immune only).\n` +
    `➖ \`${PREFIX}take @user <amount>\` — Take Gold Coins from a user (Immune only).\n` +
    `🏪 \`${PREFIX}store [buy <item_id>]\` — View the item shop or buy an item.\n` +
    `🛍️ \`${PREFIX}inventory [@user]\` — View your or another user's inventory.\n` +
    `⚔️ \`${PREFIX}loadout [equip/unequip <item_id>]\` — View or manage your equipped items.\n` +
    `🎯 \`${PREFIX}duel @user\` — Challenge another user to a 1v1 battle.\n\n` +
    `👑 **Owner & Immune Commands**\n\n` +
    `🎖️ \`${PREFIX}promote @user <rank>\` — Grant a user immunity with a rank (Owner only)\n` +
    `👎 \`${PREFIX}demote @user\` — Revoke a user's immunity (Owner only)\n` +
    `📋 \`${PREFIX}serverlist\` — List all servers the bot is in (Immune only)\n` +
    `➕ \`${PREFIX}store add <category> <item_id> <price> <name>\` — Add item to store.\n` +
    `➖ \`${PREFIX}store remove <item_id>\` — Remove item from store.`;

  await message.channel.send(helpText2);
}

else if (command === 'counting' || command === 'c') {
    const subcommand = args[0]?.toLowerCase();

    if (subcommand === 'set') {
        if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
        const channel = message.mentions.channels.first() || message.channel;

        countingData[message.guild.id] = {
            channelId: channel.id,
            currentCount: 0,
            lastUserId: null,
            highScore: countingData[message.guild.id]?.highScore || 0,
            leaderboard: countingData[message.guild.id]?.leaderboard || {}
        };
        saveCountingData();
        return message.reply(`✅ Counting channel has been set to ${channel}. The next number is **1**.`);
    }

    if (subcommand === 'off') {
        if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
        if (!countingData[message.guild.id]) {
            return message.reply('❌ Counting is not active in this server.');
        }
        delete countingData[message.guild.id].channelId;
        saveCountingData();
        return message.reply('✅ Counting game has been disabled for this server. All data is saved.');
    }

    if (subcommand === 'leaderboard' || subcommand === 'lb') {
        const serverHighScores = [];

        for (const [guildId, guildData] of Object.entries(countingData)) {
            if (guildData.highScore && guildData.highScore > 0) {
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
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

        serverHighScores.sort((a, b) => b.score - a.score);

        const leaderboardEmbed = {
          color: 0x0099ff,
          title: '🏆 Global High Score Leaderboard',
          description: serverHighScores
            .slice(0, 20)
            .map((entry, index) => 
              `${index + 1}. **${entry.name}**: ${entry.score}`
          ).join('\n'),
          footer: { text: 'Highest number reached in each server' }
        };

        return message.channel.send({ embeds: [leaderboardEmbed] });
    }

    return message.reply('❌ Invalid subcommand. Use `$counting set`, `$counting off`, or `$counting leaderboard`.');
}

else if (command === 'balance' || command === 'bal') {
    const target = message.mentions.users.first() || message.author;
    const balance = getBalance(target.id);
    message.reply(`🪙 **${target.username}** has **${balance}** Gold Coins.`);
}
else if (command === 'give' || command === 'add') {
    if (!isImmune(message.author)) {
        return message.reply('❌ You do not have permission to use this command.');
    }
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!target) return message.reply('❌ Please mention a user.');
    if (isNaN(amount) || amount <= 0) return message.reply('❌ Please provide a valid positive amount of Gold Coins.');
    
    if (target.id === OWNER_ID) {
        return message.reply('❌ You cannot modify the owner\'s balance.');
    }

    updateBalance(target.id, amount);
    saveEconomyData();
    message.reply(`✅ Gave **${amount}** Gold Coins to **${target.username}**.`);
}
else if (['take', 'remove', 'subtract'].includes(command)) {
    if (!isImmune(message.author)) {
        return message.reply('❌ You do not have permission to use this command.');
    }
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!target) return message.reply('❌ Please mention a user.');
    if (isNaN(amount) || amount <= 0) return message.reply('❌ Please provide a valid positive amount of Gold Coins.');

    if (target.id === OWNER_ID && message.author.id !== OWNER_ID) {
        return message.reply('❌ You cannot modify the owner\'s balance.');
    }

    updateBalance(target.id, -amount);
    saveEconomyData();
    message.reply(`✅ Took **${amount}** Gold Coins from **${target.username}**.`);
}

else if (command === 'store') {
    const subcommand = args[0]?.toLowerCase();

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

        storeData[category][itemId] = { name: itemName, price: priceNum, description: "Added via command.", damage: 20, defense: 10 };
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
        userPData.inventory.push(itemId);
        saveEconomyData();
        savePlayerData();

        return message.reply(`✅ You purchased **${item.name}** for **${item.price}** Gold Coins!`);
    }

    const storeEmbed = {
        color: 0x0099ff,
        title: '🏪 Item Store',
        description: 'Use `$store buy <item_id>` to purchase an item.',
        fields: []
    };

    for (const category in storeData) {
        const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        let itemsText = '';
        let itemCount = 0;
        for (const itemId in storeData[category]) {
            const item = storeData[category][itemId];
            itemsText += `**${item.name}** - ${item.price} 🪙 *(\`${itemId}\`)*\n`;
            itemCount++;
            if (itemCount >= 10) {
                itemsText += `*...and ${Object.keys(storeData[category]).length - 10} more*\n`;
                break;
            }
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

        userPData.loadout[item.type] = item.id;
        savePlayerData();
        return message.reply(`✅ Equipped **${item.name}**.`);
    }

    if (subcommand === 'unequip') {
        const slot = args[1]?.toLowerCase();
        if (!['weapon', 'armor', 'throwable'].includes(slot)) {
            return message.reply("❌ Usage: `$loadout unequip <weapon|armor|throwable>`");
        }
        
        const userPData = getPlayerData(message.author.id);
        const equippedItemId = userPData.loadout[slot];
        if (!equippedItemId) return message.reply(`❌ You don't have a ${slot} equipped.`);

        const item = findItem(equippedItemId);
        userPData.loadout[slot] = null;
        savePlayerData();
        return message.reply(`✅ Unequipped **${item.name}**.`);
    }

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

else if (command === 'duel') {
    const target = message.mentions.users.first();
    
    if (!target) return message.reply('❌ Please mention a user to challenge.');
    if (target.id === message.author.id) return message.reply('❌ You cannot challenge yourself!');
    if (target.bot) return message.reply('❌ You cannot challenge a bot!');

    const challengerData = getPlayerData(message.author.id);
    const defenderData = getPlayerData(target.id);

    if (!challengerData.loadout.weapon) {
        return message.reply('❌ You need to equip a weapon first! Use `$loadout equip <item_id>`');
    }

    const duelMsg = await message.channel.send(
        `⚔️ **${message.author.username}** has challenged **${target.username}** to a duel!\n` +
        `**${target.username}**, react with ⚔️ to accept the challenge!`
    );

    await duelMsg.react('⚔️');

    activeBattles[duelMsg.id] = {
        challenger: message.author.id,
        defender: target.id,
        status: 'pending',
        timestamp: Date.now()
    };
    saveBattles();

    setTimeout(() => {
        if (activeBattles[duelMsg.id] && activeBattles[duelMsg.id].status === 'pending') {
            message.channel.send(`⏱️ The duel challenge expired. **${target.username}** did not accept.`);
            delete activeBattles[duelMsg.id];
            saveBattles();
        }
    }, 60000);
}

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

    if (serverList.length > 2000) {
        const chunks = serverList.match(/[\s\S]{1,1990}/g) || [];
        for (const chunk of chunks) {
            message.channel.send(chunk);
        }
    } else {
        message.channel.send(serverList);
    }
  }

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

  else if (command === 'flip') {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    message.channel.send(`🪙 You flipped **${result}**!`);
  } else if (command === '8ball') {
    const responses = ['Yes.', 'No.', 'Maybe.', 'Ask again later.', 'Definitely!', 'I don't think so.'];
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
    ];
    message.channel.send(`🔥 ${user.username}, ${roasts[Math.floor(Math.random() * roasts.length)]}`);
  } else if (command === 'compliment') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('💖 Tag someone to compliment.');
    message.channel.send(`💖 ${user.username}, ${compliments[Math.floor(Math.random() * compliments.length)]}`);
  }

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

  else if (command === 'blackjack') {
    if (blackjackGames.has(message.author.id)) return message.reply('⚠️ You already have a game! Use `$hit` or `$stand`');
    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];
    blackjackGames.set(message.author.id, { playerHand, dealerHand });
    const playerTotal = handValue(playerHand);
    const msg = `🃏 **Blackjack Started!** 🃏\n\n` +
      `**Your hand:** ${formatHand(playerHand)} (Total: ${playerTotal})\n` +
      `**Dealer's hand:** ${dealerHand[0].value}${dealerHand[0].suit} ??\n\n` +
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
      `**Dealer's hand:** ${formatHand(dealerHand)} (Total: ${dealerTotal})\n\n`;
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
        result += `🤝 It's a tie!`;
    }
    blackjackGames.delete(message.author.id);
    message.channel.send(result);
  }

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

      const reply = data.choices?.[0]?.message?.content || "⚠️ Sorry, I couldn't generate a reply.";

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
        reply = "⚠️ Gemini couldn't answer that. Try rephrasing your question.";
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

  else if (command === 'nuke') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;

    const subcommand = args.shift()?.toLowerCase();
    const count = parseInt(args[0]) || 1;

    if (subcommand === 'delete') {
      if (count < 1 || count > 50) {
        return message.reply('❌ Please specify a number between 1 and 50 to delete.');
      }

      const channelsToDelete = message.guild.channels.cache
        .filter(channel => channel.type === 0 && channel.deletable)
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
        .filter(channel => channel.type === 0 && channel.manageable)
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

  else {
    if (message.content.startsWith('$') && command) {
      message.reply('❌ Unknown command or you do not have permission.');
    }
  }

});

client.login(process.env.BOT_TOKEN);
