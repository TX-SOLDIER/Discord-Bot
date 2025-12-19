// ============================================================================
// DISCORD BOT - PERSISTENT DATA WITH JSONBIN.IO
// ============================================================================
// All 'fs' file system calls have been replaced with JSONBin.io API calls.
// Data is now persistent and will not be erased on new commits or deployments.
// ===========================================================================

require('dotenv').config();
const { 
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');
const fetch = require('node-fetch');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ---- Slash Commands Definition ----
const commands = [
  new SlashCommandBuilder()
    .setName('hi')
    .setDescription('Say hello')
    .toJSON(),
];

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

// ✅ Error logging to catch startup/login issues
client.on('error', console.error);
client.on('shardError', console.error);
process.on('unhandledRejection', console.error);

// ---- Google Gemini AI Setup ----
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// ---- JSONBin.io Setup ----
// Secrets must be set on your hosting platform (e.g., Render)
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// ---- Central Bot Data Store ----
// This single object holds all data that needs to persist.
// It's loaded from JSONBin on startup and saved on changes.
let botData = {
    immuneUsers: {},
    autoDeleteUsers: {},
    countingData: {},
    economyData: {},
    lotteryData: {
        drawDate: null,
        winningNumbers: [],
        entries: {},
        prizePool: 500000,
        isActive: false,
    },
    storeData: {},
    playerData: {},
    activeBattles: {},
    activeDWGames: {},
    warnings: {},
    activeQotdChannels: [],
    qotdSettings: {},
    sentQuestions: {},
    welcomeMessages: {},
    leaveMessages: {},
    logChannels: {},
    masterLog: { channelId: null, enabled: false },

    // ---- XP + Prestige System Data ----
    xpData: {},
    xpSettings: {
      baseXp: 15,
      cooldown: 60,
      xpToNext: 100,
      levelMultiplier: 1.25,
      coinRewardPerLevel: 150,
      coinRewardPerPrestige: 10000,
      maxLevel: 100,
      maxPrestige: 10,
    },

    // ---- Channel Settings ----
    levelUpChannel: null, // Channel ID for level-up announcements
};

// In-memory Set for efficient QOTD channel lookups.
// This is populated from botData.activeQotdChannels after loading.
let activeQotdChannels = new Set();

// ---- JSONBin.io Data Functions ----
// Instead of saving every few seconds, we save only once per hour.
let dirty = false;
let saveCount = 0;
let lastSaveTime = null;

/**
 * Marks botData as changed so it will be saved at the next scheduled save.
 */
function markDirty() {
  dirty = true;
}

/**
 * Saves the current state of botData to JSONBin.io once per hour if dirty.
 */
async function saveData() {
  if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) return;
  if (!dirty) return; // No changes since last save

  try {
    const dataToSave = {
      ...botData,
      activeQotdChannels: Array.from(activeQotdChannels)
    };

    const response = await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY,
      },
      body: JSON.stringify(dataToSave),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(`JSONBin API Error: ${result.message || response.statusText}`);
    }

    console.log(`[DATA] ✅ Hourly save to JSONBin at ${new Date().toLocaleTimeString()}`);
    dirty = false;
  } catch (e) {
    console.error('[DATA] ❌ Failed to save data to JSONBin:', e);
  }
}

// Save once per hour if data has changed
setInterval(saveData, 60 * 60 * 1000);

// Save on shutdown
process.on("SIGINT", async () => {
  console.log("💾 Saving data before shutdown...");
  await saveData();
  process.exit();
});

/**
 * Loads the bot's data from JSONBin.io on startup.
 * Called once inside the client.once('ready') event.
 */
async function loadData() {
  if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
    console.error("❌ JSONBin credentials not provided. Bot will run with default, non-persistent data.");
    return;
  }
  
  try {
    const response = await fetch(JSONBIN_URL, {
      method: 'GET',
      headers: { 'X-Master-Key': JSONBIN_API_KEY },
    });

    if (response.status === 404) {
        console.warn("⚠️ Bin not found or empty. Initializing with default data and performing first save.");
        saveData(); // Save the initial default structure to the new bin
        return;
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch data from JSONBin. Status: ${response.status}. Body: ${errorText}`);
    }

    const loaded = await response.json();
    
    // Merge loaded data with defaults. This prevents errors if new properties are
    // added to the bot's code but don't exist in the saved bin yet.
    if (loaded.record) {
        botData = { ...botData, ...loaded.record };
    }

    // Convert the loaded array of QOTD channels back into a Set for fast lookups.
    activeQotdChannels = new Set(botData.activeQotdChannels || []);

    console.log("[DATA] ✅ Data successfully loaded from JSONBin.");
  } catch (e) {
    console.error('[DATA] ❌ CRITICAL error loading data from JSONBin. Bot will use default data. Error:', e);
  }
}

// ---- Consolidated Save Functions ----
// Now they just mark data dirty instead of saving immediately.
const saveImmunity = markDirty;
const saveCountingData = markDirty;
const saveEconomyData = markDirty;
const saveLotteryData = markDirty;
const saveStoreData = markDirty;
const savePlayerData = markDirty;
const saveBattles = markDirty;
const saveDWBattles = markDirty;
const saveWarnings = markDirty;
const saveQotdState = markDirty;
const saveQotdSettings = markDirty;
const saveWelcomeMessages = markDirty;
const saveLeaveMessages = markDirty;
const saveLogChannels = markDirty;
const saveMasterLog = markDirty;
const saveXPData = markDirty;
const saveXPSettings = markDirty;

// ---- Immunity System ----
const OWNER_ID = '782155864134909952';
const IMMUNITY_RANKS = ['2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL', 'BG', 'MG', 'LTG', 'GEN'];

function isImmune(user) {
  if (user.id === OWNER_ID) return true;
  return !!botData.immuneUsers[user.id];
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

// ---- In-Memory Data (Not Persistent) ----
const hauntedChannels = new Set();
const hauntIntervals = new Map();
const antiRaidActive = new Set();
const originalVerificationLevels = new Map();
const originalChannelPermissions = new Map();
const joinTimestamps = new Map();
const activeFlipChallenges = new Map();
const higherLowerGames = new Map();
const guessNumberGames = new Map();
const activeRouletteGames = new Map();
const activeRRGames = new Map();
const rrCooldowns = new Map();
const RR_COOLDOWN_TIME = 30000;
const messageCooldowns = new Map();
const commandCooldowns = new Map();
const MESSAGE_COOLDOWN = 60 * 1000;
const COMMAND_COOLDOWN = 30 * 1000;
const blackjackGames = new Map();
const userConversations = new Map(); 

// ---- Lottery System ----
function generateWinningNumbers() {
    const numbers = new Set();
    while (numbers.size < 7) {
        numbers.add(Math.floor(Math.random() * 99) + 1);
    }
    return Array.from(numbers).sort((a, b) => a - b);
}

async function runLotteryDraw() {
    if (!botData.lotteryData.isActive || (botData.lotteryData.drawDate && new Date(botData.lotteryData.drawDate) > new Date())) {
        return;
    }
    
    botData.lotteryData.winningNumbers = generateWinningNumbers();
    
    let jackpotWinner = null;
    
    for (const [guildId, entries] of Object.entries(botData.lotteryData.entries)) {
        for (const [userId, userNumbers] of Object.entries(entries)) {
            const matchCount = userNumbers.filter(num => botData.lotteryData.winningNumbers.includes(num)).length;
            if (matchCount === 7) {
                jackpotWinner = { userId, guildId, userNumbers };
                break;
            }
        }
        if (jackpotWinner) break;
    }

    for (const guildId of Object.keys(botData.lotteryData.entries)) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        const channel = guild.channels.cache.find(c => c.name.includes('lottery') || c.type === 0); 
        if (!channel) continue;

        const resultsEmbed = new EmbedBuilder()
            .setTitle('💰 Weekly Lottery Draw Results!')
            .setColor(0xFFA500)
            .addFields({ name: '✨ Winning Numbers', value: `\`${botData.lotteryData.winningNumbers.join(', ')}\``, inline: false })
            .setImage('https://i.imgur.com/rN99D4p.png');

        if (jackpotWinner && jackpotWinner.guildId === guildId) {
            const winnerId = jackpotWinner.userId;
            const winnings = botData.lotteryData.prizePool;
            
            updateBalance(winnerId, winnings);
            saveEconomyData();

            resultsEmbed.setDescription(`🎉 **JACKPOT WINNER FOUND!** 🎉\n<@${winnerId}> guessed all 7 numbers and wins **${winnings} Gold Coins**!`)
                         .setColor(0xFFD700)
                         .addFields({ name: 'Winning Ticket', value: `\`${jackpotWinner.userNumbers.join(', ')}\``, inline: false });

            botData.lotteryData.drawDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            botData.lotteryData.entries = {};
            
        } else {
            resultsEmbed.setDescription('Sorry, no jackpot winner this week. The prize pool rolls over!')
                         .addFields({ name: 'Next Draw', value: `<t:${Math.floor(new Date(botData.lotteryData.drawDate).getTime() / 1000)}:R>` });
        }
        
        await channel.send({ embeds: [resultsEmbed] });
    }
    
    if (!jackpotWinner) {
        botData.lotteryData.drawDate = new Date(new Date(botData.lotteryData.drawDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
    saveLotteryData();
}

// ---- Economy & Player Data Functions ----
function getBalance(userId) {
    return botData.economyData[userId] || 0;
}

function updateBalance(userId, amount) {
    const currentBalance = getBalance(userId);
    botData.economyData[userId] = Math.max(0, currentBalance + amount);
    return botData.economyData[userId];
}

function getPlayerData(userId) {
    if (!botData.playerData[userId]) {
        botData.playerData[userId] = {
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
    return JSON.parse(JSON.stringify(botData.playerData[userId]));
}

function findItem(itemId) {
    for (const category in botData.storeData) {
        if (botData.storeData[category][itemId]) {
            const item = { ...botData.storeData[category][itemId], id: itemId, category };
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

// ===============================
// XP + Prestige System Core
// ===============================

function getXPData(userId) {
  if (!botData.xpData[userId]) {
    botData.xpData[userId] = {
      xp: 0,
      level: 1,
      prestige: 0,
      totalXp: 0,
      lastMessageTime: 0,
      background: 'https://i.imgur.com/Qm9X9jN.png', // default card background
    };
  }
  return botData.xpData[userId];
}

function addXP(userId, amount) {
  const data = getXPData(userId);
  data.xp += amount;
  data.totalXp += amount;

  const xpToLevel = botData.xpSettings.xpToNext * Math.pow(data.level, botData.xpSettings.levelMultiplier);

  if (data.xp >= xpToLevel) {
    data.xp -= xpToLevel;
    data.level++;
    handleLevelUp(userId, data);
  }

  saveXPData();
}

// ---- Level Up Handler (Embed + Channel + DM) ----
function handleLevelUp(userId, data) {
  const coins = botData.xpSettings.coinRewardPerLevel;
  updateBalance(userId, coins);
  saveEconomyData();

  const user = client.users.cache.get(userId);

  // 🎉 Level Up Embed
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🎉 Level Up!')
    .setDescription(
      `**${user ? user.username : 'A user'}** reached **Level ${data.level}!**\n` +
      `💰 Earned **${coins} CP**\n` +
      `⭐ Prestige **${data.prestige}**`
    )
    .setThumbnail(user?.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: 'XP & Prestige System — Keep Chatting!' })
    .setTimestamp();

  // 📨 Send to set channel or fallback to DM
  const chId = botData.levelUpChannel;
  const ch = chId ? client.channels.cache.get(chId) : null;

  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
  if (user) user.send({ embeds: [embed] }).catch(() => {});

  // 🌟 Auto-prestige at max level
  if (data.level >= botData.xpSettings.maxLevel) {
    handlePrestige(userId, data);
  }

  saveXPData();
}

// ---- Prestige Handler (Public + DM Embed) ----
function handlePrestige(userId, data) {
  if (data.prestige >= botData.xpSettings.maxPrestige) return;

  data.prestige++;
  data.level = 1;
  data.xp = 0;

  const bonus = botData.xpSettings.coinRewardPerPrestige * data.prestige;
  updateBalance(userId, bonus);
  saveEconomyData();

  const user = client.users.cache.get(userId);

  // 🌟 Prestige Embed
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🌟 Prestige Unlocked!')
    .setDescription(
      `**${user ? user.username : 'A user'}** has reached **Prestige ${data.prestige}!**\n\n` +
      `🏆 Level reset to **1**\n💰 Prestige Bonus: **${bonus.toLocaleString()} CP**`
    )
    .setThumbnail(user?.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: 'XP & Prestige System — Keep grinding!' })
    .setTimestamp();

  // 📨 Send to set channel or DM fallback
  const chId = botData.levelUpChannel;
  const ch = chId ? client.channels.cache.get(chId) : null;

  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
  if (user) user.send({ embeds: [embed] }).catch(() => {});

  saveXPData();
}

function initializeStore() {
    botData.storeData = {
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

const spookyMessages = [
  '👻 Boo...', '💀 I see you...', '🩸 The shadows are watching...',
  '🔪 Behind you...', '🕷️ Something crawled across your screen...',
];

// ============================================================================
// DATA ARRAYS - ALL CONTENT IN ONE PLACE
// ============================================================================
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

const qotdQuestions = [
  // --- FUNNY & RANDOM ---
  "If animals could talk, which species would be the rudest?",
  "What is a scam that has become so normalized that we don't even realize it's a scam?",
  "If you were arrested with no explanation, what would your friends and family assume you did?",
  "What is the weirdest thing you have ever done while your brain was on 'autopilot'?",
  "If you had to replace your hands with objects that aren't hands, what would you choose?",
  "What is a slang word or trend that makes you feel old?",
  "If you could play a prank on the entire world at once, what would it be?",
  "What is the worst purchase you have ever made?",
  "If your life was a reality TV show, what would the reviews say?",
  "What is the most useless fact you know that you use surprisingly often?",
  "If you could unsubscribe from one social obligation forever (weddings, birthdays, etc.), what would it be?",
  "What is the weirdest wrong number text or call you've ever received?",
  "If you were a ghost, how would you mess with the people living in your house?",
  "What’s a food that everyone loves but you think tastes like garbage?",
  "If you could replace the sound of your fart with any sound effect, what would it be?",
  "What is the cringiest thing you posted on social media 5+ years ago?",
  "If you had to fight a horde of 5-year-olds, how many do you think you could take before going down?",
  "What fictional character do you hate with a burning passion?",
  "If you could legally steal one thing without consequences, what would it be?",
  "What is the dumbest way you have ever injured yourself?",

  // --- MOVIES & TV ---
  "Which movie villain was actually right all along?",
  "If you could delete one movie franchise from existence, which one would it be?",
  "What movie ending made you so angry you almost broke the screen?",
  "If you could recast the main character of any movie with a Muppet, which movie would be the funniest?",
  "What is a movie that everyone hates but you secretly love?",
  "If you were stuck in a horror movie, would you be the first to die, the survivor, or the killer?",
  "Which fictional TV family would you fit into best?",
  "What movie universe would be the absolute worst to actually live in?",
  "If you could watch a movie for the first time again, what would it be?",
  "Which actor plays the same character in every single movie?",
  "What is the best opening scene in movie history?",
  "If they made a movie about your life, who would you want to play you?",
  "What TV show intro do you never skip?",
  "Which side character stole the show from the main protagonist?",
  "What movie traumatized you as a child?",

  // --- VIDEO GAMES ---
  "If you could use one video game cheat code in real life (God mode, infinite money, big head mode), what would it be?",
  "Which video game world would you survive the longest in?",
  "What is a game mechanic (double jump, inventory slots, fast travel) you wish existed in real life?",
  "What was the first boss fight that made you rage quit?",
  "If you had to date a video game character, who would it be?",
  "What is your controversial gaming opinion?",
  "Which game has the most toxic community?",
  "If your life had a HUD (Heads Up Display), what stats would you want to see?",
  "What is the most money you have ever spent on a free-to-play game?",
  "Which game ending disappointed you the most?",
  "If you were an NPC, what would your one line of dialogue be?",
  "Keyboard and Mouse or Controller? Fight.",
  "What game map do you know better than your own hometown?",
  "If you could bring one weapon from a video game into real life, what would it be?",
  "Which game character has the best drip/outfit?",

  // --- EXTREMELY DIFFICULT CHOICES (WYR) ---
  "Would you rather have nipples for fingers or fingers for nipples?",
  "Would you rather have your internet browsing history public to everyone you know, or your text messages public to your parents?",
  "Would you rather always feel like you have to sneeze but can't, or always have an itch you can't scratch?",
  "Would you rather restart your life at age 10 with all your current knowledge, or skip 10 years ahead with $10 million in the bank?",
  "Would you rather be the funniest person in the room or the most attractive person in the room?",
  "Would you rather have a partner who is a 10/10 but boring, or a 5/10 who is your soulmate?",
  "Would you rather fight a chicken every time you enter your car, or fight an orangutan once a year with a sword?",
  "Would you rather speak all languages fluently or be able to play every musical instrument perfectly?",
  "Would you rather always smell like garlic or always smell like damp clothes?",
  "Would you rather have no one show up to your wedding or no one show up to your funeral?",
  "Would you rather pee your pants every time you laugh, or shit your pants every time you cry?",
  "Would you rather lose the ability to lie, or believe everything you are told?",
  "Would you rather have uncontrollable gas on a first date or at a job interview?",
  "Would you rather live in a world with no laws or a world with no privacy?",
  "Would you rather accidentally send a spicy photo to your boss or your grandma?",
  "Would you rather have a pause button for your life or a mute button for people?",
  "Would you rather have 10 kids or no kids at all?",
  "Would you rather know *when* you die or *how* you die?",
  "Would you rather never have sex again or never have good food again?",
  "Would you rather be constantly sticky or constantly itchy?",

  // --- SPICY / ADULT / FLIRTY ---
  "What is your biggest immediate 'ick' or dealbreaker on a date?",
  "What is the wildest place you have ever hooked up?",
  "Does body count matter? Why or why not?",
  "What is a non-sexual thing that you find extremely attractive?",
  "What is your favorite part of a woman's/man's body?",
  "Lights on or lights off?",
  "What is a kink or fetish you have that you're willing to admit?",
  "Have you ever had a crush on a friend's partner?",
  "What is the best pickup line that has actually worked on you (or you used)?",
  "Roleplay in the bedroom: Hot or Cringe?",
  "What is the longest you have gone without sex?",
  "Have you ever sent a nude to the wrong person?",
  "What is your opinion on open relationships?",
  "What is the most awkward thing that has happened to you during sex?",
  "Do you prefer being the dominant one or the submissive one?",
  "What is an outfit that instantly turns you on?",
  "Have you ever hooked up with an ex? Was it a mistake?",
  "What is your favorite time of day to get intimate?",
  "Spit or swallow?",
  "Have you ever been caught in the act? By who?",
  "What is the sexiest accent a person can have?",
  "Rough or gentle?",
  "Have you ever had a one-night stand? Would you do it again?",
  "What is your guilty pleasure when browsing 'adult sites'?",
  "If you could have a 'hall pass' with one celebrity, who would it be?",
  "Have you ever faked it? Be honest.",
  "Do you prefer morning fun or late-night fun?",
  "What’s the weirdest thing someone has said to you in bed?",
  "Size matters: True or False?",
  "Have you ever joined the Mile High Club (or wanted to)?"
];

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
  'I’m like a screen crack—ugly, distracting, and makes everything worse.',
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

// ============================================================================
// GAME LOGIC & FUNCTIONALITY
// ============================================================================

// ---- Blackjack Game ----
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
const qotdIntervals = new Map();
// DELETE THE LINE: let sentQuestions = {};  <-- We don't need this anymore!

function sendQuestion(channelId) {
  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  // Initialize the persistent storage if it doesn't exist
  if (!botData.sentQuestions) botData.sentQuestions = {};
  if (!botData.sentQuestions[channelId]) botData.sentQuestions[channelId] = [];

  // Use botData.sentQuestions instead of the temporary variable
  const unusedIndices = qotdQuestions
    .map((_, i) => i)
    .filter(i => !botData.sentQuestions[channelId].includes(i));

  // If we ran out of questions, reset the list for this channel
  if (unusedIndices.length === 0) {
    botData.sentQuestions[channelId] = [];
    unusedIndices.push(...qotdQuestions.map((_, i) => i));
  }

  const randomIndex = unusedIndices[Math.floor(Math.random() * unusedIndices.length)];
  
  // Save the new index to persistent storage
  botData.sentQuestions[channelId].push(randomIndex);
  saveQotdState(); // <--- THIS SAVES IT TO THE DATABASE!

  const prefix = botData.qotdSettings[channelId]?.everyone ? '@everyone ' : '';
  const question = qotdQuestions[randomIndex];
  channel.send(`${prefix}**❓ Question of the Day:** ${question}`);
  
  logToGlobal(question, channel.guild.name, channel.name);
}

function startAllQotd() {
  if (activeQotdChannels.size === 0) {
    console.log("No QOTD channels to start.");
    return;
  }

  activeQotdChannels.forEach(channelId => {
    if (qotdIntervals.has(channelId)) return;
    sendQuestion(channelId);
    const interval = setInterval(() => sendQuestion(channelId), 24 * 60 * 60 * 1000);
    qotdIntervals.set(channelId, interval);
  });
}

function stopQotd(channelId) {
  if (!activeQotdChannels.has(channelId)) return;

  const interval = qotdIntervals.get(channelId);
  if (interval) clearInterval(interval);
  qotdIntervals.delete(channelId);

  activeQotdChannels.delete(channelId);
  saveQotdState();

  if (botData.qotdSettings[channelId]) {
    delete botData.qotdSettings[channelId];
    saveQotdSettings();
  }

  // Clean up the persistent data if you want (optional)
  if (botData.sentQuestions && botData.sentQuestions[channelId]) {
      delete botData.sentQuestions[channelId];
      saveQotdState();
  }
}

// ---- Permanent Global Log Channel ----
const PERMANENT_LOG_CHANNEL_ID = '1411247548240232540';

async function logToGlobal(qotd, serverName, channelName) {
  try {
    const logChannel = client.channels.cache.get(PERMANENT_LOG_CHANNEL_ID);
    if (logChannel) {
      const embed = {
        color: 0x0099ff,
        title: `New QOTD in ${serverName}`,
        description: `**Channel:** #${channelName}\n**Question:** ${qotd}`,
        timestamp: new Date(),
        footer: { text: 'Logged by QOTD Bot' },
      };
      logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Failed to log QOTD to global channel:', error);
  }
}

// --- ANTI-RAID HELPER FUNCTIONS ---
async function engageAntiRaid(guild, alertChannel, author = null) {
    if (antiRaidActive.has(guild.id)) return false;

    antiRaidActive.add(guild.id);
    originalVerificationLevels.set(guild.id, guild.verificationLevel);

    const permsToStore = [];
    guild.channels.cache.forEach(channel => {
        if (channel.isTextBased()) {
            const everyoneRole = guild.roles.everyone;
            const currentPerms = channel.permissionOverwrites.cache.get(everyoneRole.id);
            permsToStore.push({
                channelId: channel.id,
                sendMessages: currentPerms ? currentPerms.allow.has(PermissionsBitField.Flags.SendMessages) ? true : currentPerms.deny.has(PermissionsBitField.Flags.SendMessages) ? false : null : null
            });
        }
    });
    originalChannelPermissions.set(guild.id, permsToStore);

    try {
        await guild.setVerificationLevel(4);

        guild.channels.cache.forEach(async (channel) => {
            if (channel.isTextBased()) {
                 await channel.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: false
                }).catch(err => console.error(`Failed to lock channel ${channel.name}:`, err));
            }
        });

        if (author) {
            await sendLog(guild.id, `\`[SECURITY]\` **${author.tag}** has engaged ANTI-RAID mode.`);
            if (alertChannel) {
                await alertChannel.send("🚨ANTI-RAID PROTOCOL  ENGAGED🚨THIS IS NOT A DRILL. All security measures are live. Unauthorized accounts will be IDENTIFIED, TRACKED and ELIMINATED. Channels are locked, posting is restricted, and verification is mandatory. Attempts to bypass will result in immediate bans and permanent removal from the server. Moderators: Engage intruders.");
            }
        } else {
             await sendLog(guild.id, `\`[SECURITY]\` **AUTOMATIC ANTI-RAID** has been engaged due to rapid joins.`);
            if (alertChannel) {
                await alertChannel.send("🚨**AUTO-TRIGGER**🚨ANTI-RAID PROTOCOL  ENGAGED🚨THIS IS NOT A DRILL. All security measures are live. Unauthorized accounts will be IDENTIFIED, TRACKED and ELIMINATED. Channels are locked, posting is restricted, and verification is mandatory. Attempts to bypass will result in immediate bans and permanent removal from the server. Moderators: Engage intruders.");
            }
        }
        return true;
    } catch (err) {
        console.error("Anti-Raid ON Error:", err);
        antiRaidActive.delete(guild.id);
        originalChannelPermissions.delete(guild.id);
        return false;
    }
}

async function disengageAntiRaid(guild, replyChannel) {
    if (!antiRaidActive.has(guild.id)) {
        if (replyChannel) await replyChannel.send("Anti-raid has been disengaged.")
        return false;
    }

    antiRaidActive.delete(guild.id);
    const originalLevel = originalVerificationLevels.get(guild.id) || 0;
    const savedPerms = originalChannelPermissions.get(guild.id);

    originalVerificationLevels.delete(guild.id);
    originalChannelPermissions.delete(guild.id);

    try {
        await guild.setVerificationLevel(originalLevel);

        if (savedPerms) {
            for (const perm of savedPerms) {
                const channel = guild.channels.cache.get(perm.channelId);
                if (channel && channel.isTextBased()) {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: perm.sendMessages
                    }).catch(err => console.error(`Failed to restore channel ${channel.name}:`, err));
                }
            }
        } else {
            console.warn(`[Anti-Raid] No saved permissions found for guild ${guild.id}. Using default unlock.`);
            guild.channels.cache.forEach(async (channel) => {
                if (channel.isTextBased()) {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: null
                    }).catch(err => console.error(`Failed to unlock channel ${channel.name}:`, err));
                }
            });
        }

        if (replyChannel) {
            await replyChannel.send('✅ Anti-raid mode has been disengaged. All systems and channel permissions have been restored to their previous state.');
        }
        return true;
    } catch (err) {
        console.error("Anti-Raid OFF Error:", err);
        if (replyChannel) {
            await replyChannel.send("❌ Failed to fully disengage anti-raid mode. I might be missing permissions. Please check channels manually.");
        }
        return false;
    }
}

// --- Welcome & Leave Event Handlers ---
client.on('guildMemberAdd', async member => {
    // ... (your anti-raid logic remains the same here) ...

    const welcomeData = botData.welcomeMessages[member.guild.id];
    if (welcomeData) {
        const channel = member.guild.channels.cache.get(welcomeData.channelId);
        if (channel) {
            const message = welcomeData.message
                .replace(/{user}/g, `<@${member.user.id}>`)
                .replace(/{server}/g, member.guild.name)
                .replace(/{membercount}/g, member.guild.memberCount);

            if (welcomeData.gifUrl) {
                // If a GIF URL exists, send it in an embed
                const welcomeEmbed = new EmbedBuilder()
                    .setColor(0x00FF00) // Green color for welcome
                    .setImage(welcomeData.gifUrl);
                
                channel.send({ content: message, embeds: [welcomeEmbed] });
            } else {
                // Otherwise, send the plain message
                channel.send(message);
            }
        }
    }
    await sendLog(member.guild.id, `\`[JOIN]\` **${member.user.tag}** (${member.user.id}) joined the server.`);
});


client.on('guildMemberRemove', async member => {
  const leaveData = botData.leaveMessages[member.guild.id];
  if (leaveData) {
    const channel = member.guild.channels.cache.get(leaveData.channelId);
    if (channel) {
      const message = leaveData.message
        .replace(/{user}/g, member.user.tag)
        .replace(/{server}/g, member.guild.name)
        .replace(/{membercount}/g, member.guild.memberCount);

      if (leaveData.gifUrl) {
          // If a GIF URL exists, send it in an embed
          const leaveEmbed = new EmbedBuilder()
              .setColor(0xFF0000) // Red color for leave
              .setImage(leaveData.gifUrl);

          channel.send({ content: message, embeds: [leaveEmbed] });
      } else {
          // Otherwise, send the plain message
          channel.send(message);
      }
    }
  }
  await sendLog(member.guild.id, `\`[LEAVE]\` **${member.user.tag}** (${member.user.id}) left the server.`);
});


// ---- Log Message Helper Function ----
async function sendLog(guildId, messageContent) {
  if (botData.logChannels[guildId]?.enabled && botData.logChannels[guildId]?.channelId) {
    const channel = client.channels.cache.get(botData.logChannels[guildId].channelId);
    if (channel) await channel.send(messageContent).catch(console.error);
  }

  if (botData.masterLog.enabled && botData.masterLog.channelId) {
    const channel = client.channels.cache.get(botData.masterLog.channelId);
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

// ---- Slash Command Handler ----
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'hi') {
    await interaction.reply('Hello world 👋');
  }
});

// ---- Bot Startup Event (`ready`) ----
client.once('ready', async () => {
  console.log("🚀 Bot starting up... Loading persistent data from JSONBin...");
  await loadData();
  
  if (!botData.storeData || Object.keys(botData.storeData).length === 0) {
      console.log("🏬 Store data is empty. Initializing with default items...");
      initializeStore();
  }

  console.log(`✅ Logged in as ${client.user.tag}`);

  // ---- Register Slash Commands ----
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

  try {
    console.log('🔁 Refreshing application (/) commands...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Slash commands registered.');
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }
  
  // Start systems that depend on loaded data.
  startAllQotd();
  
  setInterval(runLotteryDraw, 600000);
  console.log(`✅ Lottery check routine started.`);

  if (!botData.lotteryData.drawDate) {
      const nextSunday = new Date();
      nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()) % 7);
      nextSunday.setHours(10, 0, 0, 0); 
      botData.lotteryData.drawDate = nextSunday.toISOString();
      botData.lotteryData.isActive = true;
      saveLotteryData();
      console.log(`✅ Initial lottery draw date set for: ${nextSunday.toLocaleString()}`);
  }
});

// ---- Log message updates and deletions ----
client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const guildCountingData = botData.countingData[newMessage.guild.id];
  if (guildCountingData && newMessage.channel.id === guildCountingData.channelId) {
    const nextNumber = guildCountingData.currentCount + 1;
    const alertMessage = `⚠️ **EDIT DETECTED!**\n**User:** ${oldMessage.author}\n**Original Message:** \`${oldMessage.content}\`\n**Edited To:** \`${newMessage.content}\`\n\nTo avoid confusion, the next number is still **${nextNumber}**.`;
    await newMessage.channel.send(alertMessage);
  }

  const logMessage = `\`[EDITED]\` **${oldMessage.author.tag}** edited their message in <#${oldMessage.channel.id}>.\n**Before:** \`\`\`${oldMessage.content}\`\`\`\n**After:** \`\`\`${newMessage.content}\`\`\``;
  await sendLog(oldMessage.guild.id, logMessage);
});

client.on('messageDelete', async message => {
  if (message.author?.bot) return;

  if (message.guild) {
    const guildCountingData = botData.countingData[message.guild.id];
    if (guildCountingData && message.channel.id === guildCountingData.channelId) {
        const nextNumber = guildCountingData.currentCount + 1;
        const alertMessage = `⚠️ **DELETE DETECTED!**\n**User:** ${message.author || 'An unknown user'}\n**Deleted Message:** \`${message.content || '(Message content not available)'}\`\n\nTo avoid confusion, the next number is **${nextNumber}**.`;
        await message.channel.send(alertMessage);
    }
  }

  const logMessage = `\`[DELETED]\` A message by **${message.author?.tag || 'Unknown User'}** was deleted in <#${message.channel.id}>.\n**Content:** \`\`\`${message.content || 'N/A'}\`\`\``;
  await sendLog(message.guild.id, logMessage);
});

// ---- BATTLE SYSTEMS: Reaction Handler ----
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.partial) {
        try { await reaction.fetch(); } 
        catch (error) { console.error('Error fetching reaction:', error); return; }
    }
    const battleKey = reaction.message.id;

    if (botData.activeBattles[battleKey] && botData.activeBattles[battleKey].status === 'pending') {
        const battle = botData.activeBattles[battleKey];
        if (user.id === battle.defender && reaction.emoji.name === '⚔️') {
            battle.status = 'accepted';
            saveBattles();
            await reaction.message.channel.send(`⚔️ **${user.username}** has accepted the automated battle challenge! The battle begins!`);
            await startBattle(reaction.message.channel, battle.challenger, battle.defender, battleKey);
        }
        return;
    }

    const dwGame = botData.activeDWGames[battleKey];
    if (!dwGame) return;

    if (dwGame.status === 'pending') {
        if (user.id === dwGame.p2.id && reaction.emoji.name === '⚔️') {
            await startDWBattle(reaction.message, dwGame);
        }
        return;
    }

    if (dwGame.status === 'active') {
        const currentPlayer = dwGame.turn === dwGame.p1.id ? dwGame.p1 : dwGame.p2;
        if (user.id !== currentPlayer.id) {
            await reaction.users.remove(user.id).catch(err => console.error("Failed to remove reaction:", err));
            return;
        }

        const actionMap = { '⚔️': 'attack', '🛡️': 'cover', '❤️': 'heal', '💣': 'throwable' };
        const action = actionMap[reaction.emoji.name];

        if (action) {
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
  delete botData.activeBattles[battleKey];
  saveBattles();
}

async function executeAttack(attacker, target) {
  let log = '';
  const weapon = attacker.weapon;
  const baseDamage = weapon.damage || 10;
  let missChance = weapon.missChance || 10;
  if (attacker.effects.blind && attacker.effects.blind > 0) missChance += 30;

  if (Math.random() * 100 < missChance) {
    log += `❌ **${attacker.user.username}** missed with ${weapon.name}!\n`;
    return log;
  }
  if (Math.random() * 100 < (weapon.headshotChance || 5)) {
    const headshotDamage = baseDamage * 2;
    const actualDamage = Math.max(1, headshotDamage - (target.armor ? target.armor.defense * 0.4 : 0));
    target.data.health -= actualDamage;
    log += `🎯 **HEADSHOT!** **${attacker.user.username}** hits **${target.user.username}** with ${weapon.name} for ${actualDamage.toFixed(1)} damage!\n`;
    return log;
  }
  if (Math.random() * 100 < (weapon.critChance || 10)) {
    const critDamage = baseDamage * 1.5;
    const actualDamage = Math.max(1, critDamage - (target.armor ? target.armor.defense * 0.5 : 0));
    target.data.health -= actualDamage;
    log += `💥 **CRITICAL HIT!** **${attacker.user.username}** strikes **${target.user.username}** with ${weapon.name} for ${actualDamage.toFixed(1)} damage!\n`;
    return log;
  }
  const actualDamage = Math.max(1, baseDamage - (target.armor ? target.armor.defense * 0.6 : 0));
  target.data.health -= actualDamage;
  log += `⚔️ **${attacker.user.username}** hits **${target.user.username}** with ${weapon.name} for ${actualDamage.toFixed(1)} damage!\n`;
  return log;
}

async function executeThrowable(attacker, target, currentLog) {
  const throwable = attacker.throwable;
  let log = `💣 **${attacker.user.username}** throws ${throwable.name}!\n`;
  let instantDeath = false;

  if (throwable.damage > 0) {
    const actualDamage = Math.max(1, throwable.damage - (target.armor ? target.armor.defense * 0.3 : 0));
    target.data.health -= actualDamage;
    log += `💥 ${throwable.name} deals ${actualDamage.toFixed(1)} damage to **${target.user.username}**!\n`;
  }

  if (throwable.effect && Math.random() * 100 < (throwable.effectChance || 50)) {
    switch (throwable.effect) {
      case 'blind': target.effects.blind = throwable.duration || 2; log += `😵 **${target.user.username}** is blinded! Miss chance increased!\n`; break;
      case 'stun': log += `⚡ **${target.user.username}** is stunned!\n`; break;
      case 'burn': target.effects.burn = throwable.duration || 3; log += `🔥 **${target.user.username}** is burning!\n`; break;
      case 'bleed': target.effects.bleed = throwable.duration || 2; log += `🩸 **${target.user.username}** is bleeding!\n`; break;
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


// ---- DEADLIEST WARRIOR FUNCTIONS ----
async function startDWBattle(message, game) {
    game.status = 'active';
    game.p1.health = 100;
    game.p2.health = 100;
    game.p1.healsLeft = 3;
    game.p2.healsLeft = 3;
    game.p1.inCover = false;
    game.p2.inCover = false;
    game.p1.effects = {};
    game.p2.effects = {};
    game.round = 1;
    game.turn = game.p1.id;
    game.log = `**${game.p2.name}** accepted the challenge! The battle begins!`;
    
    saveDWBattles();
    await updateDWEmbed(message.channel, message.id);
}

async function updateDWEmbed(channel, messageId) {
    const game = botData.activeDWGames[messageId];
    if (!game) return;

    const message = await channel.messages.fetch(messageId);
    if (!message) return;

    const currentPlayer = game.turn === game.p1.id ? game.p1 : game.p2;
    
    const p1Effects = Object.entries(game.p1.effects).filter(([_, v]) => v > 0).map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} (${v})`).join(', ') || 'None';
    const p2Effects = Object.entries(game.p2.effects).filter(([_, v]) => v > 0).map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} (${v})`).join(', ') || 'None';

    const embed = new EmbedBuilder()
        .setColor('#C70039')
        .setTitle(`DEADLIEST WARRIOR - Round ${game.round}/30`)
        .setDescription(`**Last Action:**\n${game.log}\n\nIt's **${currentPlayer.name}**'s turn to act!`)
        .addFields(
            { name: `🔴 ${game.p1.name}`, value: `**HP:** ${game.p1.health.toFixed(0)}/100\n**Heals:** ${game.p1.healsLeft}\n**Cover:** ${game.p1.inCover ? 'Yes' : 'No'}\n**Effects:** ${p1Effects}`, inline: true },
            { name: `🔵 ${game.p2.name}`, value: `**HP:** ${game.p2.health.toFixed(0)}/100\n**Heals:** ${game.p2.healsLeft}\n**Cover:** ${game.p2.inCover ? 'Yes' : 'No'}\n**Effects:** ${p2Effects}`, inline: true }
        )
        .setImage('https://i.imgur.com/8f1V3gI.gif')
        .setFooter({ text: '⚔️ Attack | 🛡️ Take Cover | ❤️ Heal | 💣 Use Throwable' });

    await message.edit({ embeds: [embed], content: `<@${currentPlayer.id}>, it's your turn!` });
    
    await message.react('⚔️');
    await message.react('🛡️');
    await message.react('❤️');
    if (currentPlayer.throwable) await message.react('💣');
}

async function processDWTurn(messageId, action) {
    const game = botData.activeDWGames[messageId];
    if (!game) return;

    const channel = await client.channels.fetch(game.channelId);
    const attacker = game.turn === game.p1.id ? game.p1 : game.p2;
    const target = game.turn === game.p1.id ? game.p2 : game.p1;
    let actionLog = '';
    let gameOver = false;
    let preTurnLog = '';

    if (attacker.effects.burn > 0) {
        const burnDamage = 8;
        attacker.health -= burnDamage;
        preTurnLog += `🔥 **${attacker.name}** took **${burnDamage}** burn damage!\n`;
        attacker.effects.burn--;
    }
     if (attacker.effects.bleed > 0) {
        const bleedDamage = 5;
        attacker.health -= bleedDamage;
        preTurnLog += `🩸 **${attacker.name}** took **${bleedDamage}** bleed damage!\n`;
        attacker.effects.bleed--;
    }
    if (attacker.health <= 0) {
        game.log = preTurnLog + `\n**${attacker.name}** succumbed to their injuries!`;
        await endDWBattle(channel, messageId, target, attacker);
        return;
    }
    if (attacker.effects.stun > 0) {
        preTurnLog += `😵 **${attacker.name}** is stunned and skips their turn!`;
        attacker.effects.stun--;
        game.log = preTurnLog;
        game.turn = target.id;
        if (game.turn === game.p1.id) game.round++;
        if (game.round > 30) {
            await endDWBattle(channel, messageId, null, null, true);
        } else {
            saveDWBattles();
            await updateDWEmbed(channel, messageId);
        }
        return;
    }

    attacker.inCover = false;

    switch (action) {
        case 'attack': {
            const weapon = attacker.weapon;
            if (!weapon) {
                 actionLog = `👊 **${attacker.name}** attacks with their fists!`;
                 target.health -= 5;
            } else {
                let missChance = weapon.missChance || 10;
                if(attacker.effects.blind > 0) {
                    missChance += 30;
                    attacker.effects.blind--;
                }

                if (Math.random() * 100 < missChance) {
                    actionLog = `❌ **${attacker.name}** attacked with ${weapon.name} but missed!`;
                } else {
                    let damage = weapon.damage || 10;
                    let hitType = '';

                    if (Math.random() * 100 < (weapon.headshotChance || 5)) {
                        damage *= 2;
                        hitType = '🎯 **HEADSHOT!** ';
                    } else if (Math.random() * 100 < (weapon.critChance || 10)) {
                        damage *= 1.5;
                        hitType = '💥 **CRITICAL HIT!** ';
                    }

                    if (target.inCover) {
                        damage *= 0.5;
                        actionLog += `🛡️ **${target.name}** was in cover and took reduced damage!\n`;
                    }
                    const defense = target.armor ? target.armor.defense * 0.4 : 0;
                    const actualDamage = Math.max(1, damage - defense);
                    target.health = Math.max(0, target.health - actualDamage);
                    actionLog += `${hitType}**${attacker.name}** hits **${target.name}** with ${weapon.name} for **${actualDamage.toFixed(1)}** damage!`;
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
                if (target.inCover) damage *= 0.6; 
                const defense = target.armor ? target.armor.defense * 0.2 : 0;
                const actualDamage = Math.max(1, damage - defense);
                target.health = Math.max(0, target.health - actualDamage);
                actionLog = `💣 **${attacker.name}** used **${throwable.name}**, dealing **${actualDamage.toFixed(1)}** damage!\n`;

                if (throwable.effect && Math.random() * 100 < (throwable.effectChance || 50)) {
                    target.effects[throwable.effect] = (target.effects[throwable.effect] || 0) + throwable.duration;
                     actionLog += `...and inflicted **${throwable.effect.toUpperCase()}** on **${target.name}**!`;
                }
                attacker.throwable = null;
            }
            break;
        }
    }

    game.log = preTurnLog + actionLog;

    if (target.health <= 0) {
        gameOver = true;
        await endDWBattle(channel, messageId, attacker, target);
    } else if (game.turn === game.p2.id) {
        game.round++;
    }

    if (game.round > 30 && !gameOver) {
        gameOver = true;
        await endDWBattle(channel, messageId, null, null, true);
    }

    if (!gameOver) {
        game.turn = target.id;
        saveDWBattles();
        await updateDWEmbed(channel, messageId);
    }
}

async function endDWBattle(channel, messageId, winner, loser, isDraw = false) {
    const game = botData.activeDWGames[messageId];
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
            .setDescription(`${game.log}\n\n🏆 **${winner.name}** has defeated **${loser.name}**!\n💰 **${winner.name}** earned **${reward}** Gold Coins!`)
            .setImage('https://i.imgur.com/Fuhs8b3.gif');
    }
    
    saveEconomyData();
    
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if(message) {
        await message.edit({ embeds: [embed], content: "The battle has ended!" });
        await message.reactions.removeAll().catch(err => console.error("Could not clear reactions on finished game"));
    } else {
        await channel.send({ embeds: [embed] });
    }

    delete botData.activeDWGames[messageId];
    saveDWBattles();
}

client.on('channelUpdate', async (oldChannel, newChannel) => {
  let changes = [];
  if (oldChannel.name !== newChannel.name) changes.push(`Name: \`\`${oldChannel.name}\`\` -> \`\`${newChannel.name}\`\``);
  if (oldChannel.topic !== newChannel.topic) changes.push(`Topic: \`\`${oldChannel.topic || 'N/A'}\`\` -> \`\`${newChannel.topic || 'N/A'}\`\``);
  if (changes.length > 0) {
    const logMessage = `\`[CHANNEL UPDATE]\` Channel **#${newChannel.name}** was updated.\n${changes.join('\n')}`;
    await sendLog(newChannel.guild.id, logMessage);
  }
});

const PREFIX = '$';

// ---- Main Message Handler (`messageCreate`) ----
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

// ---- XP Gain System ----
if (!message.author.bot && message.guild) {
  const now = Date.now();
  const data = getXPData(message.author.id);
  if (now - data.lastMessageTime >= botData.xpSettings.cooldown * 1000) {
    data.lastMessageTime = now;
    const gained = botData.xpSettings.baseXp + Math.floor(Math.random() * 10);
    addXP(message.author.id, gained);
  }
}
  
// ---- AUTO-DELETE MESSAGE HANDLER ----
if (botData.autoDeleteUsers && botData.autoDeleteUsers[message.author?.id]) {
  try {
    const contentPreview = message.content?.slice(0, 100) || '[No Content]';
    await message.delete();

    console.log(`[AUTO-DELETE] Deleted message from ${message.author.tag}`);
    
    await sendLog(
      message.guild?.id,
      `\`[AUTO-DELETE]\` Deleted message from **${message.author.tag}** (${message.author.id}) in <#${message.channel.id}>:\n> ${contentPreview}`
    );
  } catch (err) {
    console.error(`[AUTO-DELETE ERROR] Could not delete message from ${message.author.tag}:`, err);
  }
  return;
}
  
    if (!message.content.startsWith(PREFIX)) {
        const now = Date.now();
        const lastMessage = messageCooldowns.get(message.author.id);
        if (!lastMessage || now - lastMessage > MESSAGE_COOLDOWN) {
            updateBalance(message.author.id, 1);
            messageCooldowns.set(message.author.id, now);
            saveEconomyData();
        }
    }

    const guildCountingData = botData.countingData[message.guild?.id];
if (guildCountingData && message.channel.id === guildCountingData.channelId) {
    // Ignore bot messages
    if (message.author.bot) return;

    const isPrivileged = isImmune(message.author) || message.author.id === OWNER_ID;

    // ✅ 1) If message doesn't start with prefix AND user is NOT immune/owner
    if (!message.content.startsWith(PREFIX) && !isPrivileged) {
        // Auto-delete any non-number
        if (!/^\d+$/.test(message.content.trim())) {
            return message.delete().catch(() => {});
        }
    }

    // ✅ 2) Continue with your existing counting logic (number parsing)
    if (!message.content.startsWith(PREFIX)) {
        const number = parseInt(message.content);
        if (isNaN(number)) return; 

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
  // ==== AI-POWERED DEBATE SYSTEM ====
const debateCooldowns = new Map();   // userId → last use
const debateThreads  = new Map();    // channelId → [{role,text}, …]

if (message.content.startsWith('$debate')) {
  const args  = message.content.split(' ').slice(1);
  const topic = args.join(' ') || 'a random issue';
  const stance = Math.random() > 0.5 ? 'for' : 'against';

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `
You are a neutral debate bot.
The topic is "${topic}".
Argue ${stance.toUpperCase()} the topic in 2–3 concise sentences.
Stay polite and suitable for a general Discord audience.
`;

  await message.channel.send('🧠 Generating debate topic…');
  try {
    const result = await model.generateContent(prompt);
    const reply  = result.response.text();

    let minutesLeft = 5;
    const embed = new EmbedBuilder()
      .setTitle(`💬 Debate Topic: ${topic}`)
      .setColor(0x00AEEF)
      .setDescription(`**Stance chosen:** ${stance.toUpperCase()}\n\n> ${reply}`)
      .addFields({
        name: 'How to Participate',
        value: `React with 👍 to agree or 👎 to disagree.\nDebate ends in **${minutesLeft} minutes**.`,
      })
      .setFooter({ text: 'AI Debate – Be respectful!' })
      .setTimestamp();

    const debateMsg = await message.channel.send({ embeds: [embed] });
    await debateMsg.react('👍');
    await debateMsg.react('👎');
    debateThreads.set(message.channel.id, []);

    // update countdown every minute
    const interval = setInterval(async () => {
      minutesLeft--;
      if (minutesLeft <= 0) return;
      const upd = EmbedBuilder.from(embed)
        .setFields({
          name: 'How to Participate',
          value: `React with 👍 to agree or 👎 to disagree.\nDebate ends in **${minutesLeft} minute${minutesLeft===1?'':'s'}**.`,
        });
      try { await debateMsg.edit({ embeds: [upd] }); } catch {}
    }, 60000);

    // conclude after 5 minutes
    setTimeout(async () => {
      clearInterval(interval);
      try {
        const fetched = await message.channel.messages.fetch(debateMsg.id);
        const r = fetched.reactions.cache;
        const ups = r.get('👍')?.count - 1 || 0;
        const dns = r.get('👎')?.count - 1 || 0;
        let resultText =
          ups > dns ? `✅ Majority **agreed** (${ups} 👍 vs ${dns} 👎)` :
          dns > ups ? `❌ Majority **disagreed** (${dns} 👎 vs ${ups} 👍)` :
          `🤝 It’s a **tie** (${ups} 👍 vs ${dns} 👎)`;
        const final = EmbedBuilder.from(embed)
          .addFields({ name: 'Final Results', value: resultText })
          .setFooter({ text: '🏁 Debate concluded after 5 minutes.' });
        await fetched.edit({ embeds: [final] });
        debateThreads.delete(message.channel.id);
        await message.channel.send('🏁 **Debate concluded!** Thanks for participating.');
      } catch (e) { console.error('Debate conclude error:', e); }
    }, 300000);
  } catch (e) {
    console.error('AI debate error:', e);
    message.channel.send('❌ Unable to start debate right now.');
  }
}

// ---- Debate Reply Handler (AI memory + cooldown + live reactions) ----
if (message.reference && !message.author.bot) {
  try {
    const replied = await message.channel.messages.fetch(message.reference.messageId);
    if (!replied.author.bot) return;
    if (!replied.embeds?.length) return;
    const emb = replied.embeds[0];
    if (!emb.title?.startsWith('💬 Debate Topic')) return;

    const topic = emb.title.replace('💬 Debate Topic: ', '');
    const userArg = message.content.trim();
    const uid  = message.author.id;
    const cid  = message.channel.id;

    // cooldown 1 min
    const now = Date.now(), last = debateCooldowns.get(uid) || 0;
    if (now - last < 60000) {
      const wait = Math.ceil((60000 - (now - last)) / 1000);
      return message.reply(`⏳ Please wait **${wait}s** before engaging again.`);
    }
    debateCooldowns.set(uid, now);

    // memory
    if (!debateThreads.has(cid)) debateThreads.set(cid, []);
    const thread = debateThreads.get(cid);
    thread.push({ role: 'user', text: userArg });
    if (thread.length > 6) thread.shift();

    const history = thread.map(m => `${m.role==='user'?'User':'Bot'}: ${m.text}`).join('\n');
    const prompt = `
You are a neutral, respectful debate bot for topic "${topic}".
Recent conversation:
${history}
Give a short (2–3 sentence) counter-argument or clarification.
Stay polite and logical.
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const res = await model.generateContent(prompt);
    const replyText = res.response.text();
    thread.push({ role: 'bot', text: replyText });

    const followEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('🤖 Debate Response')
      .setDescription(`> ${replyText}`)
      .setFooter({ text: '👍 0   👎 0 • AI Debate – Context aware' });

    const botMsg = await message.channel.send({
      embeds: [followEmbed],
      reply: { messageReference: message.id },
    });

    // add reactions + live counter
    try { await botMsg.react('👍'); await botMsg.react('👎'); } catch {}
    const collector = botMsg.createReactionCollector({ time: 5*60*1000, dispose: true });

    const updateFooter = async () => {
      try {
        const ups = botMsg.reactions.cache.get('👍')?.count - 1 || 0;
        const dns = botMsg.reactions.cache.get('👎')?.count - 1 || 0;
        const upd = EmbedBuilder.from(followEmbed)
          .setFooter({ text: `👍 ${ups}   👎 ${dns} • AI Debate – Context aware` });
        await botMsg.edit({ embeds: [upd] });
      } catch (e) { console.error('Footer update error:', e); }
    };
    collector.on('collect', updateFooter);
    collector.on('remove', updateFooter);
  } catch (e) {
    console.error('Debate reply handler error:', e);
  }
}

// ---- COMMANDS START HERE ----

if (command === 'help') {
  const embed1 = new EmbedBuilder()
    .setColor(0x39FF14)
    .setDescription(
      `• \`${PREFIX}prefix\` – Show the bot prefix\n` +
      `• \`${PREFIX}ping\` – Check bot response time\n` +
      `• \`${PREFIX}stats\` – Server member stats\n` +
      `• \`${PREFIX}uptime\` – Bot active time\n` +
      `• \`${PREFIX}botinfo\` – Info about the bot\n` +
      `• \`${PREFIX}invite\` – Get bot invite link\n` +
      `• \`${PREFIX}setwelcome\` / \`${PREFIX}clearwelcome\` – Set/clear welcome message\n` +
      `• \`${PREFIX}setleave\` / \`${PREFIX}clearleave\` – Set/clear leave message\n` +
      `• \`${PREFIX}embed create <name> ~ <title> ~ <description> ~ <imageURL> ~ [color]\` – Create or edit a saved embed\n` +
      `• \`${PREFIX}embed send <name> [#channel]\` – Send a saved embed (or GIF-only embed)\n` +
      `• \`${PREFIX}embed delete <name>\` – Delete a saved embed\n` +
      `• \`${PREFIX}embed list\` – Show all saved embed names\n` +
      `• \`${PREFIX}setgif <URL>\` – Set the persistent GIF embed URL\n` +
      `• \`${PREFIX}showgif\` – Display the persistently saved GIF embed\n` +
      `• \`${PREFIX}rank\` – Show your rank card (prestige frames + progress bar)\n` +
      `• \`${PREFIX}setbg <imageURL>\` – Set background image for your rank card\n` +
      `• \`${PREFIX}prestige\` – Prestige when you reach max level (resets level, increments prestige)\n` +
      `• \`${PREFIX}xpleaderboard\` / \`${PREFIX}xplb\` – Show server XP leaderboard\n` +
      `• \`${PREFIX}xpinfo [@user]\` – Show XP/level/CP info and progress bar for a user\n` +
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
      `• \`${PREFIX}haunt\` / \`${PREFIX}unhaunt\` – Haunting on/off for a channel\n` +
      `• \`${PREFIX}blackjack\`, \`${PREFIX}hit\`, \`${PREFIX}stand\` – Play Blackjack`
    );

  const embed2 = new EmbedBuilder()
    .setColor(0x39FF14)
    .setDescription(
      `• \`${PREFIX}giveaway <duration> <prize>\` – Start a giveaway\n` +
      `• \`${PREFIX}debate <question>\` – Start an ai powered debate\n` +
      `• \`${PREFIX}kick @user [reason]\` – Kick a user\n` +
      `• \`${PREFIX}ban @user [reason]\` – Ban a user\n` +
      `• \`${PREFIX}mute @user [time]\` – Mute a user\n` +
      `• \`${PREFIX}unmute @user\` – Unmute a user\n` +
      `• \`${PREFIX}warn @user [reason]\` – Warn a user\n` +
      `• \`${PREFIX}warnings @user\` – Show warnings\n` +
      `• \`${PREFIX}clear [number]\` – Delete messages\n` +
      `• \`${PREFIX}lock\` / \`${PREFIX}unlock\` – Lock/unlock channel (Manage Channels required)\n` +
      `• \`${PREFIX}antiraid on|off\` – Engage/disengage server lockdown\n` +
      `• \`${PREFIX}slowmode [seconds]\` – Set slowmode for current channel\n` +
      `• \`${PREFIX}role add/remove @user <role>\` – Add or remove a role by name (Manage Roles required)\n` +
      `• \`${PREFIX}nuke delete [count]\` – Delete bulk channels\n` +
      `• \`${PREFIX}nuke rename <new-name> [count]\` – Rename bulk channels\n` +
      `• \`${PREFIX}unauthorized\` – Unauthorized response template\n` +
      `• \`${PREFIX}logmode on [#channel]\` – Enable logging\n` +
      `• \`${PREFIX}logmode off\` – Disable logging\n` +
      `• \`${PREFIX}logmode setmaster <channelID>\` – Set master log (Owner only)\n` +
      `• \`${PREFIX}logmode masteron|masteroff\` – Enable/disable master log (Owner only)\n` +
      `• \`${PREFIX}autodelete <userId> [on|off] [moreUserIds...]\` – Toggle auto-delete for user IDs (Owner/Immune only)\n` +
      `• \`${PREFIX}autodelete list\` – Show auto-delete active list (Owner/Immune only)\n` +
      `• \`${PREFIX}addxp @user <amount>\` – Add XP to a user (Immune only)\n` +
      `• \`${PREFIX}removexp @user <amount>\` – Remove XP from a user (Immune only)\n` +
      `• \`${PREFIX}setlevel @user <level>\` – Set user level (Immune only)\n` +
      `• \`${PREFIX}setprestige @user <tier>\` – Set prestige level (Immune only)\n` +
      `• \`${PREFIX}resetxp @user\` – Reset a user’s XP data (Immune only)`
    );

  const embed3 = new EmbedBuilder()
    .setColor(0x39FF14)
    .setDescription(
      `• \`${PREFIX}qotd on|off\` – Enable/disable Question of the Day in channel\n` +
      `• \`${PREFIX}qotd everyone on|off\` – Enable/disable @everyone ping for QOTD\n` +
      `• \`${PREFIX}counting set [#channel]\` – Set counting channel\n` +
      `• \`${PREFIX}counting off\` – Disable counting game\n` +
      `• \`${PREFIX}counting leaderboard\` – Show global counting leaderboard\n` +
      `• \`${PREFIX}userinfo\` – User info\n` +
      `• \`${PREFIX}avatar @user\` – Avatar\n` +
      `• \`${PREFIX}serverinfo\` – Server info\n` +
      `• \`${PREFIX}shout [msg]\` – Shout a message (all caps)\n` +
      `• \`${PREFIX}spoiler [msg]\` – Send spoiler message\n` +
      `• \`${PREFIX}say [msg]\` – Echo message\n` +
      `• \`${PREFIX}send <channelID> <message>\` – Send message to channel ID\n` +
      `• \`${PREFIX}ai <prompt>\` – Ask Google Gemini AI\n` +
      `• \`@bot <prompt>\` – Ask OpenRouter AI\n` +
      `• \`${PREFIX}balance [@user]\` / \`${PREFIX}bal\` – Check balance\n` +
      `• \`${PREFIX}pay @user <amount>\` – Pay coins\n` +
      `• \`${PREFIX}give / ${PREFIX}add / ${PREFIX}take / ${PREFIX}remove / ${PREFIX}subtract @user <amount>\` – Economy admin (Owner/Immune only)\n` +
      `• \`${PREFIX}lottery\` – View active lottery info\n` +
      `• \`${PREFIX}buyticket 1 2 3 4 5 6 7\` – Buy a lottery ticket (7 unique numbers)\n` +
      `• \`${PREFIX}flipbet <heads|tails> <amount>\` – Coin flip wager\n` +
      `• \`${PREFIX}challengeflip @user <amount>\` – Challenge another player to a coin flip\n` +
      `• \`${PREFIX}higherlower\` / \`${PREFIX}hl\` – Guess higher or lower\n` +
      `• \`${PREFIX}guessnumber\` / \`${PREFIX}gtn\` – Number guessing game\n` +
      `• \`${PREFIX}roulette <betType> <amount>\` – Play roulette (red/black/even/odd/number)\n` +
      `• \`${PREFIX}rr\` – Russian Roulette (loser muted 1hr)\n` +
      `• \`${PREFIX}store [buy <item_id>]\` – Shop\n` +
      `• \`${PREFIX}store add/remove ...\` – Manage shop (Owner/Immune only)\n` +
      `• \`${PREFIX}inventory [@user]\` – View inventory\n` +
      `• \`${PREFIX}loadout [equip/unequip <item_id>]\` – Manage loadout\n` +
      `• \`${PREFIX}battle @user\` / \`${PREFIX}1v1\` – Automated 1v1 battle\n` +
      `• \`${PREFIX}dw @user\` / \`${PREFIX}deadliestwarrior\` – Turn-based Deadliest Warrior\n` +
      `• \`${PREFIX}setlevelupchannel #channel\` – Set channel for level-up announcements (Immune only)\n` +
      `• \`${PREFIX}disablelevelup\` – Disable level-up announcements (Immune only)\n` +
      `• \`${PREFIX}xpsettings\` – Show XP system settings\n` +
      `• \`${PREFIX}setxpsetting <key> <value>\` – Update XP system settings (Immune only)\n` +
      `• \`${PREFIX}promote/demote @user <rank>\` – Grant/revoke immunity PREFIX immunitylist for list of admin.(Owner only)\n` +
      `• \`${PREFIX}serverlist\` – List servers (Owner/Immune only)\n` +
      `• \`${PREFIX}forcesave\` – Manually save all bot data (Owner & Immune only)\n` +
      `• Immunity Ranks: 2LT, 1LT, CPT, MAJ, LTC, COL, BG, MG, LTG, GEN\n` +
      `• Economy Permissions:\n` +
      `  - Bot Owner: Full control\n` +
      `  - Immune Users: Give/take except owner\n` +
      `  - Normal Users: Can only pay coins`
    )
    .setFooter({ text: 'Bot developer and creator:TX_SOLDIER' })
    .setImage('https://media4.giphy.com/media/v1.Y2lkPTZjMDliOTUyOWgwYTdtYXNjdmpnOWpib256anFtNmI1M3IwZW84eHUxZG5tcTluZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/6YjbrQ0dun9ydpEqhG/giphy.gif');

  await message.channel.send({ embeds: [embed1] });
  await message.channel.send({ embeds: [embed2] });
  await message.channel.send({ embeds: [embed3] });
}

else if (command === 'counting' || command === 'c') {
    const subcommand = args[0]?.toLowerCase();

    if (subcommand === 'set') {
        if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
        const channel = message.mentions.channels.first() || message.channel;

        botData.countingData[message.guild.id] = {
            channelId: channel.id,
            currentCount: 0,
            lastUserId: null,
            highScore: botData.countingData[message.guild.id]?.highScore || 0,
            leaderboard: botData.countingData[message.guild.id]?.leaderboard || {}
        };
        saveCountingData();
        return message.reply(`✅ Counting channel has been set to ${channel}. The next number is **1**.`);
    }

    // ✅ NEW: setnext command (owner/immunes only)
    if (subcommand === 'setnext') {
        if (!isImmune(message.author) && message.author.id !== OWNER_ID) {
            return message.reply("❌ Only bot owner or immune users can set the next number!");
        }

        const newNumber = parseInt(args[1]);
        if (isNaN(newNumber) || newNumber < 1) {
            return message.reply('❌ Please provide a valid positive number.');
        }

        const data = botData.countingData[message.guild.id];
        if (!data) {
            return message.reply('❌ Counting is not active in this server.');
        }

        data.currentCount = newNumber - 1;
        data.lastUserId = null; // reset last user so ANYONE can type the next number
        saveCountingData();

        return message.reply(`✅ Next number has been set to **${newNumber}**.`);
    }

    if (subcommand === 'off') {
        if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
        if (!botData.countingData[message.guild.id]) {
            return message.reply('❌ Counting is not active in this server.');
        }
        delete botData.countingData[message.guild.id].channelId;
        saveCountingData();
        return message.reply('✅ Counting game has been disabled for this server. All data is saved.');
    }

    if (subcommand === 'leaderboard' || subcommand === 'lb') {
        const serverHighScores = [];
        for (const [guildId, guildData] of Object.entries(botData.countingData)) {
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
          description: serverHighScores.slice(0, 20).map((entry, index) => `${index + 1}. **${entry.name}**: ${entry.score}`).join('\n'),
          footer: { text: 'Highest number reached in each server' }
        };
        return message.channel.send({ embeds: [leaderboardEmbed] });
    }

    return message.reply('❌ Invalid subcommand. Use `$counting set`, `$counting setnext`, `$counting off`, or `$counting leaderboard`.');
}

else if (command === 'hl') {
  const channelId = message.channel.id;
  const game = higherLowerGames.get(channelId);
  const reward = 100;
  const COOLDOWN = 3000; // 3s per user

  // =========================
  // END GAME
  // =========================
  if (args[0] === 'end') {
    if (!game) return message.reply('❌ No Higher / Lower game is running.');

    const isStarter = game.starterId === message.author.id;
    const isOwner = message.author.id === OWNER_ID;
    const immune = isImmune(message.author);

    if (!isStarter && !isOwner && !immune) {
      return message.reply(
        '❌ Only the game starter, immune users, or the owner can end this game.'
      );
    }

    higherLowerGames.delete(channelId);

    return message.channel.send(
      `🛑 **Higher / Lower ended.**\nThe number was **${game.number}**.`
    );
  }

  // =========================
  // START GAME
  // =========================
  if (!game) {
    const secret = Math.floor(Math.random() * 100) + 1;

    const startEmbed = new EmbedBuilder()
      .setTitle('⬆️⬇️ Higher or Lower')
      .setDescription(
        '🎯 I picked a number between **1–100**.\n\n' +
        'Type a number to guess!\n\n' +
        '⏱️ **Cooldown:** 3 seconds per user\n' +
        '🛑 **End game:** `!hl end`'
      )
      .setColor(0x0099FF);

    await message.channel.send({ embeds: [startEmbed] });

    higherLowerGames.set(channelId, {
      number: secret,
      starterId: message.author.id,
      lastGuess: new Map(),
      startedAt: Date.now(),
    });

    // Auto-expire after 10 minutes
    setTimeout(() => {
      if (higherLowerGames.has(channelId)) {
        higherLowerGames.delete(channelId);
        message.channel.send('⌛ **Higher / Lower ended due to inactivity.**');
      }
    }, 10 * 60 * 1000);

    return;
  }

  // =========================
  // GUESS HANDLING
  // =========================
  const guess = parseInt(args[0], 10);
  if (isNaN(guess)) return;

  if (guess < 1 || guess > 100) return;

  const now = Date.now();
  const last = game.lastGuess.get(message.author.id) || 0;

  if (now - last < COOLDOWN) return; // silent anti-spam

  game.lastGuess.set(message.author.id, now);

  if (guess < game.number) {
    return message.react('⬆️');
  }

  if (guess > game.number) {
    return message.react('⬇️');
  }

  // =========================
  // WIN
  // =========================
  higherLowerGames.delete(channelId);

  const newBalance = updateBalance(message.author.id, reward);
  saveEconomyData();

  const winEmbed = new EmbedBuilder()
    .setTitle('🎉 Correct Guess!')
    .setDescription(
      `<@${message.author.id}> guessed **${game.number}** correctly!`
    )
    .addFields(
      { name: '💰 Reward', value: `+${reward} Gold Coins`, inline: true },
      { name: '💸 New Balance', value: `${newBalance}`, inline: true }
    )
    .setColor(0x00FF00);

  message.channel.send({ embeds: [winEmbed] });
}

  else if (command === 'gtn') {
  const channelId = message.channel.id;
  const game = guessNumberGames.get(channelId);
  const reward = 100; // Reward for winning

  // =========================
  // END GAME LOGIC
  // =========================
  if (args[0] === 'end') {
    if (!game) return message.reply('❌ No GTN game is running in this channel.');

    const isStarter = game.starterId === message.author.id;
    const isOwner = message.author.id === OWNER_ID;
    const immune = isImmune(message.author);

    if (!isStarter && !isOwner && !immune) {
      return message.reply('❌ Only the game starter, immune users, or the owner can end this game.');
    }

    guessNumberGames.delete(channelId);
    return message.channel.send(`🛑 **GTN ended.** The number was **${game.number}**.`);
  }

  // =========================
  // START GAME LOGIC
  // =========================
  if (!game) {
    const secret = Math.floor(Math.random() * 100) + 1;
    
    guessNumberGames.set(channelId, {
      number: secret,
      starterId: message.author.id,
      attempts: 0
    });

    const startEmbed = new EmbedBuilder()
      .setTitle('🎯 Guess the Number')
      .setDescription('I picked a number between **1–100**.\n\nType `$gtn <number>` to guess!\n🛑 **End game:** `$gtn end`')
      .setColor(0xFFA500);

    return message.channel.send({ embeds: [startEmbed] });
  }

  // =========================
  // GUESS HANDLING
  // =========================
  const guess = parseInt(args[0], 10);
  
  // If they just typed $gtn without a number (and game is already running)
  if (isNaN(guess)) {
    return message.reply('❓ Please provide a number! Example: `$gtn 50`');
  }

  if (guess < 1 || guess > 100) {
    return message.reply('❌ Please guess a number between 1 and 100.');
  }

  game.attempts++;

  if (guess < game.number) {
    return message.reply('⬆️ **Higher!**');
  }

  if (guess > game.number) {
    return message.reply('⬇️ **Lower!**');
  }

  // =========================
  // WIN LOGIC
  // =========================
  guessNumberGames.delete(channelId);

  const newBalance = updateBalance(message.author.id, reward);
  saveEconomyData();

  const winEmbed = new EmbedBuilder()
    .setTitle('🎉 Correct!')
    .setDescription(`<@${message.author.id}> guessed **${game.number}** correctly in **${game.attempts}** tries!`)
    .addFields(
      { name: '💰 Reward', value: `+${reward} Gold Coins`, inline: true },
      { name: '💸 New Balance', value: `${newBalance}`, inline: true }
    )
    .setThumbnail('https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJueXF6bm9sZzRycHByZ3R6Z3R6Z3R6Z3R6Z3R6Z3R6Z3R6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/26tOZ42Mg6pbMUMM0/giphy.gif')
    .setColor(0x00FF00);

  return message.channel.send({ embeds: [winEmbed] });

// =========================
  // SLOTS COMMAND ($slots)
  // =========================
  } else if (command === 'slots') {
    const bet = parseInt(args[0]);
    const balance = getBalance(message.author.id);

    if (isNaN(bet) || bet <= 0) {
      return message.reply("❌ Please provide a valid amount to bet. Example: `$slots 100`");
    }
    if (bet > balance) {
      return message.reply(`❌ You don't have enough Gold Coins. Your balance: **${balance}**`);
    }

    const emojis = ['🍎', '💎', '🎰', '🍒', '🌟'];
    const res1 = emojis[Math.floor(Math.random() * emojis.length)];
    const res2 = emojis[Math.floor(Math.random() * emojis.length)];
    const res3 = emojis[Math.floor(Math.random() * emojis.length)];

    let winnings = 0;
    let resultText = "";
    let color = 0x000000;

    if (res1 === res2 && res2 === res3) {
      winnings = bet * 5;
      resultText = `🎉 **JACKPOT!**\n\nAll three matched! You won **${winnings}** Gold Coins!`;
      color = 0xFFD700;
    } else if (res1 === res2 || res2 === res3 || res1 === res3) {
      winnings = bet * 2;
      resultText = `✨ **Nice!**\n\nYou got a double match! You won **${winnings}** Gold Coins!`;
      color = 0x00FF00;
    } else {
      winnings = -bet;
      resultText = `💀 **Better luck next time!**\n\nNo matches. You lost **${bet}** Gold Coins.`;
      color = 0xFF0000;
    }

    const newBalance = updateBalance(message.author.id, winnings);
    saveEconomyData();

    const slotsEmbed = new EmbedBuilder()
      .setTitle('🎰 Slot Machine')
      .setDescription(`**[ ${res1} | ${res2} | ${res3} ]**\n\n${resultText}`)
      .addFields(
        { name: '💰 Bet Amount', value: `${bet} Gold Coins`, inline: true },
        { name: '💸 New Balance', value: `${newBalance} Gold Coins`, inline: true }
      )
      .setColor(color)
      .setImage('https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUybmp4YmloenYzNHp2NmZnY2dydThweHVqMmVvNDZiZHQxeWIyZnptMSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/DS57LWXWFN70hI37kQ/giphy.gif')
      .setTimestamp();

    return message.channel.send({ embeds: [slotsEmbed] });

  // =========================
  // LOTTERY COMMAND ($lottery)
  // =========================
  } else if (command === 'lottery') {
    const nextDraw = new Date(botData.lotteryData.drawDate);
    const timeUntilDraw = Math.floor(nextDraw.getTime() / 1000);
    const gifUrl = 'https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyNmY5NWR2M2pjcTZqM2J4bHp4aTVxcWh6b3Ftb2QzeWNvMmhhNnNyNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/6r66mC6UA0fEk2QAeZ/giphy.gif';

    const guildEntries = botData.lotteryData.entries[message.guild.id] || {};
    const userTickets = guildEntries[message.author.id]?.length || 0;

    const infoEmbed = new EmbedBuilder()
      .setTitle('🎟️ Weekly Lottery Information')
      .setDescription('Match 7 unique numbers (1-99) to win the jackpot!')
      .addFields(
        { name: '🏆 Jackpot Prize', value: `**${botData.lotteryData.prizePool.toLocaleString()} Gold Coins**`, inline: true },
        { name: '⏰ Next Draw', value: `<t:${timeUntilDraw}:R>`, inline: true },
        { name: '🔢 Your Tickets', value: `${userTickets}`, inline: true },
        { name: '💵 Cost to Enter', value: '1,000 Gold Coins per ticket', inline: true },
        { name: '❓ How to Play', value: 'Use `$buyticket <num1> <num2> ... <num7>`', inline: false }
      )
      .setColor(0x9B59B6)
      .setImage(gifUrl)
      .setFooter({ text: 'Good luck! All tickets reset after the draw.' });

    return message.channel.send({ embeds: [infoEmbed] });
}

else if (command === 'buyticket') {
    const ticketCost = 1000;
    const balance = getBalance(message.author.id);
    if (balance < ticketCost) {
        return message.reply(`❌ Buying a ticket costs **${ticketCost} Gold Coins**, and you only have **${balance}**.`);
    }
    if (args.length !== 7) {
        return message.reply('❌ You must provide exactly 7 unique numbers between 1 and 99. Usage: `$buyticket 5 10 15 20 25 30 35`');
    }
    const userNumbers = args.map(n => parseInt(n)).filter(n => !isNaN(n) && n >= 1 && n <= 99);
    if (userNumbers.length !== 7 || new Set(userNumbers).size !== 7) {
        return message.reply('❌ All 7 numbers must be unique and between 1 and 99.');
    }
    const newBalance = updateBalance(message.author.id, -ticketCost);
    saveEconomyData();
    if (!botData.lotteryData.entries[message.guild.id]) {
        botData.lotteryData.entries[message.guild.id] = {};
    }
    if (!botData.lotteryData.entries[message.guild.id][message.author.id]) {
        botData.lotteryData.entries[message.guild.id][message.author.id] = [];
    }
    botData.lotteryData.entries[message.guild.id][message.author.id].push(userNumbers.sort((a, b) => a - b));
    saveLotteryData();
    const embed = new EmbedBuilder().setTitle('✅ Lottery Ticket Purchased!').setDescription(`Your ticket numbers: \`${userNumbers.join(', ')}\`\nGood luck!`).addFields({ name: '💵 Cost', value: `-${ticketCost} Gold Coins`, inline: true }, { name: '💸 New Balance', value: `\`${newBalance}\` Gold Coins`, inline: true }).setColor(0x27AE60);
    message.channel.send({ embeds: [embed] });
}
  
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
    if (message.author.id === OWNER_ID) {
        updateBalance(target.id, amount);
        saveEconomyData();
        return message.reply(`✅ Gave **${amount}** Gold Coins to **${target.username}**.`);
    }
    if (isImmune(message.author)) {
        if (target.id === OWNER_ID) {
            return message.reply('❌ You cannot modify the owner\'s balance.');
        }
        updateBalance(target.id, amount);
        saveEconomyData();
        return message.reply(`✅ Gave **${amount}** Gold Coins to **${target.username}**.`);
    }
    return message.reply('❌ You do not have permission to use this command.');
}

else if (['take', 'remove', 'subtract'].includes(command)) {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target) return message.reply('❌ Please mention a user.');
    if (isNaN(amount) || amount <= 0) return message.reply('❌ Please provide a valid positive amount of Gold Coins.');
    if (message.author.id === OWNER_ID) {
        updateBalance(target.id, -amount);
        saveEconomyData();
        return message.reply(`✅ Took **${amount}** Gold Coins from **${target.username}**.`);
    }
    if (isImmune(message.author)) {
        if (target.id === OWNER_ID) {
            return message.reply('❌ You cannot modify the owner\'s balance.');
        }
        updateBalance(target.id, -amount);
        saveEconomyData();
        return message.reply(`✅ Took **${amount}** Gold Coins from **${target.username}**.`);
    }
    return message.reply('❌ You do not have permission to use this command.');
}

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

else if (command === 'immunelist') {
  if (message.author.id !== OWNER_ID) {
    return message.reply('❌ Only the bot owner can view immune users.');
  }

  const immuneEntries = Object.entries(botData.immuneUsers || {});

  if (immuneEntries.length === 0) {
    return message.reply('ℹ️ There are currently **no immune users**.');
  }

  let list = immuneEntries
    .map(([id, rank], i) => `${i + 1}. <@${id}> — **${rank}**`)
    .join('\n');

  message.channel.send({
    content: `🛡️ **Immune Users List:**\n${list}`
  });
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
        if (!botData.storeData[category]) return message.reply(`❌ Invalid category. Valid categories are: ${Object.keys(botData.storeData).join(', ')}`);
        if (findItem(itemId)) return message.reply('❌ An item with that ID already exists.');
        botData.storeData[category][itemId] = { name: itemName, price: priceNum, description: "Added via command.", stats: {}, effects: [] };
        saveStoreData();
        return message.reply(`✅ Added **${itemName}** (\`${itemId}\`) to the store for **${priceNum}** Gold Coins.`);
    }
    if (subcommand === 'remove') {
        if (!isImmune(message.author)) return message.reply('❌ You are not authorized to manage the store.');
        const itemId = args[1];
        if (!itemId) return message.reply('❌ Usage: `$store remove <item_id>`');
        const item = findItem(itemId);
        if (!item) return message.reply('❌ Item not found.');
        delete botData.storeData[item.category][item.id];
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
        const actualPlayerData = botData.playerData[message.author.id] || getPlayerData(message.author.id);
        actualPlayerData.inventory.push(itemId);
        savePlayerData();
        saveEconomyData();
        return message.reply(`✅ You purchased **${item.name}** for **${item.price}** Gold Coins!`);
    }
    const storeEmbed = { color: 0x0099ff, title: '🏪 Item Store', description: 'Use `$store buy <item_id>` to purchase an item.', fields: [] };
    for (const category in botData.storeData) {
        const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        let itemsText = '';
        for (const itemId in botData.storeData[category]) {
            const item = botData.storeData[category][itemId];
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
    const invEmbed = { color: 0x34eb6b, title: `🛍️ ${target.username}'s Inventory`, description: '' };
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
        const actualPlayerData = botData.playerData[message.author.id];
        actualPlayerData.loadout[item.type] = item.id;
        savePlayerData();
        return message.reply(`✅ Equipped **${item.name}**.`);
    }
    if (subcommand === 'unequip') {
        const slot = args[1]?.toLowerCase();
        if (!['weapon', 'armor', 'throwable'].includes(slot)) {
            return message.reply("❌ Usage: `$loadout unequip <weapon|armor|throwable>`");
        }
        const actualPlayerData = botData.playerData[message.author.id];
        const equippedItemId = actualPlayerData.loadout[slot];
        if (!equippedItemId) return message.reply(`❌ You don't have a ${slot} equipped.`);
        const item = findItem(equippedItemId);
        actualPlayerData.loadout[slot] = null;
        savePlayerData();
        return message.reply(`✅ Unequipped **${item.name}**.`);
    }
    const target = message.mentions.users.first() || message.author;
    const userPData = getPlayerData(target.id);
    const loadout = userPData.loadout;
    const weapon = loadout.weapon ? findItem(loadout.weapon) : null;
    const armor = loadout.armor ? findItem(loadout.armor) : null;
    const throwable = loadout.throwable ? findItem(loadout.throwable) : null;
    const loadoutEmbed = { color: 0xf5b042, title: `⚔️ ${target.username}'s Loadout`, fields: [ { name: '❤️ Health', value: `${userPData.health}/${userPData.maxHealth}`, inline: false }, { name: '🔫 Weapon', value: weapon ? `**${weapon.name}** (\`${weapon.id}\`)` : 'None', inline: true }, { name: '🛡️ Armor', value: armor ? `**${armor.name}** (\`${armor.id}\`)` : 'None', inline: true }, { name: '💣 Throwable', value: throwable ? `**${throwable.name}** (\`${throwable.id}\`)` : 'None', inline: true }, ], footer: { text: "Use `$loadout equip <id>` or `$loadout unequip <slot>`" } };
    return message.channel.send({ embeds: [loadoutEmbed] });
}

else if (command === 'battle' || command === '1v1') {
    const target = message.mentions.users.first();
    if (!target) return message.reply('❌ Please mention someone to battle! Example: `$battle @user`');
    if (target.id === message.author.id) return message.reply('❌ You cannot battle yourself!');
    if (target.bot) return message.reply('❌ You cannot battle a bot!');
    const challengerData = getPlayerData(message.author.id);
    const defenderData = getPlayerData(target.id);
    if (!challengerData.loadout.weapon) return message.reply('❌ You need to equip a weapon first! Use `$loadout equip <item_id>`');
    if (!defenderData.loadout.weapon) return message.reply(`❌ ${target.username} doesn't have a weapon equipped!`);
    const challengeEmbed = new EmbedBuilder().setColor(0xff0000).setTitle('⚔️ AUTOMATED BATTLE CHALLENGE ⚔️').setDescription(`**${message.author.username}** has challenged **${target.username}** to an automated 1v1 battle!\n\n` + `**${target.username}**, react with ⚔️ to accept the challenge!\n\n` + `This battle will resolve automatically.`).addFields({ name: `${message.author.username}'s Loadout`, value: `🔫 ${challengerData.loadout.weapon ? findItem(challengerData.loadout.weapon).name : 'None'}`, inline: true }, { name: `${target.username}'s Loadout`, value: `🔫 ${defenderData.loadout.weapon ? findItem(defenderData.loadout.weapon).name : 'None'}`, inline: true }).setImage("https://i.imgur.com/yourTopBattle.gif").setFooter({ text: 'Challenge expires in 60 seconds' });
    const challengeMsg = await message.channel.send({ embeds: [challengeEmbed] });
    await challengeMsg.react('⚔️');
    botData.activeBattles[challengeMsg.id] = { challenger: message.author.id, defender: target.id, status: 'pending', timestamp: Date.now() };
    saveBattles();
    setTimeout(() => {
        if (botData.activeBattles[challengeMsg.id] && botData.activeBattles[challengeMsg.id].status === 'pending') {
            delete botData.activeBattles[challengeMsg.id];
            saveBattles();
            message.channel.send(`⏱️ The automated battle challenge from **${message.author.username}** to **${target.username}** has expired.`);
        }
    }, 60000);
}

else if (command === 'dw' || command === 'deadliestwarrior') {
    const target = message.mentions.users.first();
    if (!target) return message.reply('❌ Please mention someone to battle! Example: `$dw @user`');
    if (target.id === message.author.id) return message.reply('❌ You cannot battle yourself!');
    if (target.bot) return message.reply('❌ You cannot battle a bot!');
    const challengerData = getPlayerData(message.author.id);
    const defenderData = getPlayerData(target.id);
    if (!challengerData.loadout.weapon) return message.reply('❌ You need to equip a weapon first! Use `$loadout equip <item_id>`');
    if (!defenderData.loadout.weapon) return message.reply(`❌ ${target.username} doesn't have a weapon equipped!`);
    const challengeEmbed = new EmbedBuilder().setColor('#8B0000').setTitle("🔥 TX SOLDIER'S DEADLIEST WARRIOR 🔥").setDescription(`**${message.author.username}** has challenged **${target.username}** to a turn-based duel to the death!\n\n` + `**${target.username}**, react with ⚔️ to accept the challenge!\n\n` + `This is a turn-based battle. You will choose your actions each round.`).addFields({ name: `${message.author.username}'s Loadout`, value: `🔫 ${challengerData.loadout.weapon ? findItem(challengerData.loadout.weapon).name : 'None'}\n🛡️ ${challengerData.loadout.armor ? findItem(challengerData.loadout.armor).name : 'None'}\n💣 ${challengerData.loadout.throwable ? findItem(challengerData.loadout.throwable).name : 'None'}`, inline: true }, { name: `${target.username}'s Loadout`, value: `🔫 ${defenderData.loadout.weapon ? findItem(defenderData.loadout.weapon).name : 'None'}\n🛡️ ${defenderData.loadout.armor ? findItem(defenderData.loadout.armor).name : 'None'}\n💣 ${defenderData.loadout.throwable ? findItem(defenderData.loadout.throwable).name : 'None'}`, inline: true }).setImage('https://i.imgur.com/eT824xG.gif').setFooter({ text: 'Challenge expires in 60 seconds' });
    const challengeMsg = await message.channel.send({ embeds: [challengeEmbed] });
    await challengeMsg.react('⚔️');
    botData.activeDWGames[challengeMsg.id] = { channelId: message.channel.id, status: 'pending', p1: { id: message.author.id, name: message.author.username, weapon: findItem(challengerData.loadout.weapon), armor: findItem(challengerData.loadout.armor), throwable: findItem(challengerData.loadout.throwable) }, p2: { id: target.id, name: target.username, weapon: findItem(defenderData.loadout.weapon), armor: findItem(defenderData.loadout.armor), throwable: findItem(defenderData.loadout.throwable) }, };
    saveDWBattles();
    setTimeout(() => {
        if (botData.activeDWGames[challengeMsg.id] && botData.activeDWGames[challengeMsg.id].status === 'pending') {
            delete botData.activeDWGames[challengeMsg.id];
            saveDWBattles();
            message.channel.send(`⏱️ The Deadliest Warrior challenge from **${message.author.username}** to **${target.username}** has expired.`);
        }
    }, 60000);
}
  
else if (command === 'logmode') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
    const subcommand = args[0];
    const channel = message.mentions.channels.first() || message.channel;
    if (subcommand === 'on') {
      botData.logChannels[message.guild.id] = { channelId: channel.id, enabled: true };
      saveLogChannels();
      message.reply(`✅ Log mode has been **enabled** in ${channel}.`);
    } else if (subcommand === 'off') {
      if (!botData.logChannels[message.guild.id]) {
        return message.reply('❌ Log mode is not enabled in this server.');
      }
      botData.logChannels[message.guild.id].enabled = false;
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
      botData.masterLog.channelId = masterChannelId;
      saveMasterLog();
      message.reply(`✅ Master log channel has been set to ${masterChannel}.`);
    } else if (subcommand === 'masteron') {
      if (message.author.id !== OWNER_ID) {
        return message.reply('❌ Only the bot owner can manage the master log.');
      }
      if (!botData.masterLog.channelId) {
        return message.reply('❌ Master log channel is not set. Use `$logmode setmaster <channelID>`.');
      }
      botData.masterLog.enabled = true;
      saveMasterLog();
      message.reply('✅ Master log has been **enabled**.');
    } else if (subcommand === 'masteroff') {
      if (message.author.id !== OWNER_ID) {
        return message.reply('❌ Only the bot owner can manage the master log.');
      }
      if (!botData.masterLog.channelId) {
        return message.reply('❌ Master log channel is not set.');
      }
      botData.masterLog.enabled = false;
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
    botData.immuneUsers[target.id] = rank;
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
    if (botData.immuneUsers[target.id]) {
        delete botData.immuneUsers[target.id];
        saveImmunity();
        message.reply(`✅ **${target.tag}** has been demoted and no longer has immunity.`);
        target.send(`ℹ️ Your immunity status has been revoked.`).catch(err => {
          console.error(`Could not DM user ${target.tag}:`, err);
        });
    } else {
        message.reply(`❌ **${target.tag}** is not an immune user.`);
    }
}
// ===============================
// EMBED SYSTEM COMMAND (Mobile Friendly + GIF Only Compatible)
// ===============================

if (command === 'embed') {
  // Check permission (Owner or immune)
  if (!isImmune(message.author)) {
    return message.reply('❌ You do not have permission to use this command.');
  }

  const sub = args[0]?.toLowerCase();

  // Initialize data store if missing
  if (!botData.customEmbeds) botData.customEmbeds = {};

  // --- CREATE Command ---
  if (sub === 'create') {
    const parts = args.slice(1).join(' ').split('~').map(p => p.trim());
    const [name, title, description, imageUrl, color] = parts;

    // Require at least a name + one content field
    if (!name) {
      return message.reply('⚙️ Usage: `$embed create <name> ~ <title> ~ <description> ~ [image/gif URL] ~ [color]`');
    }

    if (!title && !description && !imageUrl) {
      return message.reply('⚠️ You must provide at least a title, description, or image URL.');
    }

    const embedColor = color ? parseInt(color.replace('#', ''), 16) : 0x00AEFF;
    const embed = new EmbedBuilder().setColor(embedColor).setTimestamp();

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);

    // ✅ Validate and attach image
    if (imageUrl && /^https?:\/\/[^\s]+$/.test(imageUrl)) {
      embed.setImage(imageUrl);
    } else if (imageUrl) {
      message.reply('⚠️ Invalid image URL detected — image skipped.');
    }

    // Save to botData
    botData.customEmbeds[name] = { title, description, imageUrl, color: embedColor };
    saveMasterLog(); // markDirty for JSONBin or your save system
    message.channel.send({ embeds: [embed] });
    message.reply(`✅ Embed **${name}** has been created and saved.`);

  // --- EDIT Command ---
  } else if (sub === 'edit') {
    const parts = args.slice(1).join(' ').split('/').map(p => p.trim());
    const [name, title, description, imageUrl, color] = parts;

    if (!name || !botData.customEmbeds[name]) {
      return message.reply('❌ Embed not found. Use `$embed list` to view saved embeds.');
    }

    const embedData = botData.customEmbeds[name];

    if (title !== undefined) embedData.title = title;
    if (description !== undefined) embedData.description = description;
    if (imageUrl !== undefined) embedData.imageUrl = imageUrl;
    if (color) embedData.color = parseInt(color.replace('#', ''), 16);

    const embed = new EmbedBuilder()
      .setColor(embedData.color || 0x00AEFF)
      .setTimestamp();

    if (embedData.title) embed.setTitle(embedData.title);
    if (embedData.description) embed.setDescription(embedData.description);

    // ✅ Validate and attach image
    if (embedData.imageUrl && /^https?:\/\/\S+\.\S+/.test(embedData.imageUrl)) {
      embed.setImage(embedData.imageUrl);
    } else if (embedData.imageUrl) {
      message.reply('⚠️ Invalid image URL detected — image skipped.');
    }

    saveMasterLog();
    message.channel.send({ embeds: [embed] });
    message.reply(`✏️ Embed **${name}** updated successfully.`);

  // --- DELETE Command ---
  } else if (sub === 'delete') {
    const name = args[1];
    if (!name || !botData.customEmbeds[name]) {
      return message.reply('❌ Embed not found.');
    }
    delete botData.customEmbeds[name];
    saveMasterLog();
    message.reply(`🗑️ Embed **${name}** deleted.`);

  // --- LIST Command ---
  } else if (sub === 'list') {
    const names = Object.keys(botData.customEmbeds);
    if (names.length === 0) return message.reply('No saved embeds yet.');
    message.reply(`📋 Saved embeds:\n\`\`\`${names.join(', ')}\`\`\``);

  // --- SEND Command ---
  } else if (sub === 'send') {
    const name = args[1];
    const channelMention = message.mentions.channels.first();

    if (!name || !botData.customEmbeds[name]) {
      return message.reply('❌ Embed not found. Use `$embed list` to see available ones.');
    }

    const embedData = botData.customEmbeds[name];
    const embed = new EmbedBuilder()
      .setColor(embedData.color || 0x00AEFF)
      .setTimestamp();

    if (embedData.title) embed.setTitle(embedData.title);
    if (embedData.description) embed.setDescription(embedData.description);

    if (embedData.imageUrl && /^https?:\/\/\S+\.\S+/.test(embedData.imageUrl)) {
      embed.setImage(embedData.imageUrl);
    } else if (embedData.imageUrl) {
      message.reply('⚠️ Invalid image URL detected — image skipped.');
    }

    const targetChannel = channelMention || message.channel;
    targetChannel.send({ embeds: [embed] });
    message.reply(`✅ Embed **${name}** sent to ${targetChannel}.`);

  // --- HELP Command ---
  } else {
    message.reply('🧾 Usage:\n```' +
      '$embed create <name> ~ <title> ~ <description> ~ [image/gif URL] ~ [color]\n' +
      '$embed edit <name> / [title] / [description] / [image/gif URL] / [color]\n' +
      '$embed delete <name>\n' +
      '$embed list\n' +
      '$embed send <name> [#channel]\n```');
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
        image: { url: 'https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyNjhnd2Q1dDB1bGxkMmQ4c3RiejB5NmRocTNiMWRmdjJnc2tzZXo1OCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JqTZqf0HTAy9yOo38W/giphy.gif' }, // START GIF
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
          const noWinnerEmbed = { color: 0xFF0000, title: '🎉 **GIVEAWAY ENDED** 🎉', description: `**Prize:** ${prize}\n\nNo one entered the giveaway. 😢`, footer: { text: 'Ended at' }, timestamp: new Date().toISOString(), };
          return giveawayMessage.edit({ embeds: [noWinnerEmbed] });
        }
        const winner = entrants.random();
        const winnerEmbed = { 
            color: 0x00FF00, 
            title: '🎉 **GIVEAWAY ENDED** 🎉', 
            description: `**Prize:** ${prize}\n**Winner:** ${winner}!`, 
            footer: { text: 'Ended at' }, 
            timestamp: new Date().toISOString(),
            image: { url: 'https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyYmpqN2Z2cDc3aDk1OXR0MGs1cW1hZ2RlbnB5d2ZidWVhemdzbWh0OSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Z2XIQz9AXISznANAbB/giphy.gif' }, // WINNER GIF
        };
        await giveawayMessage.edit({ embeds: [winnerEmbed] });
        message.channel.send(`Congratulations ${winner}! You won the **${prize}**!`);
      } catch (error) {
        console.error("Giveaway ending error:", error);
        message.channel.send('❌ There was an error determining the giveaway winner.');
      }
    }, durationMs);
} else if (command === 'continue') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
    const messageId = args[0];
    if (!messageId) {
      return message.reply('❌ **Usage:** `$continue <giveaway_message_id>`');
    }

    try {
        // Fetch the original message to get the end time and prize
        const giveawayMessage = await message.channel.messages.fetch(messageId);
        const embed = giveawayMessage.embeds[0];

        // Basic check to confirm it's a giveaway embed
        if (!embed || embed.title !== '🎉 **GIVEAWAY** 🎉' || embed.footer?.text !== 'Ends at') {
            return message.reply('❌ The message ID provided is not for an active giveaway.');
        }

        const endTime = new Date(embed.timestamp).getTime();
        const remainingDurationMs = endTime - Date.now();
        // Extract the prize from the description
        const prizeMatch = embed.description.match(/\*\*Prize:\*\*\s*(.*)/);
        const prize = prizeMatch ? prizeMatch[1].trim() : 'Unknown Prize';

        if (remainingDurationMs <= 0) {
            return message.reply('❌ This giveaway has already ended.');
        }

        message.reply(`✅ **Giveaway Continued!** The **${prize}** giveaway will now end in approximately **${Math.ceil(remainingDurationMs / 60000)} minutes**.`);

        // Set a new timeout for the remaining time
        setTimeout(async () => {
            try {
                // Re-fetch message to get latest reactions
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
                    return fetchedMessage.edit({ embeds: [noWinnerEmbed] });
                }

                const winner = entrants.random();
                const winnerEmbed = {
                    color: 0x00FF00,
                    title: '🎉 **GIVEAWAY ENDED** 🎉',
                    description: `**Prize:** ${prize}\n**Winner:** ${winner}!`,
                    footer: { text: 'Ended at' },
                    timestamp: new Date().toISOString(),
                    image: { url: 'https://i.imgur.com/u7B4DmJ.gif' }, // WINNER GIF
                };
                await fetchedMessage.edit({ embeds: [winnerEmbed] });
                message.channel.send(`Congratulations ${winner}! You won the **${prize}**!`);

            } catch (error) {
                console.error("Giveaway continuation ending error:", error);
                message.channel.send('❌ There was an error determining the giveaway winner after continuing.');
            }
        }, remainingDurationMs);

    } catch (error) {
        console.error("Giveaway continue error:", error);
        return message.reply('❌ Could not fetch the message. Check the ID and make sure it\'s in this channel.');
    }
} else if (command === 'endgiveaway') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
    const messageId = args[0];
    if (!messageId) {
      return message.reply('❌ **Usage:** `$endgiveaway <giveaway_message_id>`');
    }

    try {
        // Fetch the message to end
        const giveawayMessage = await message.channel.messages.fetch(messageId);
        const embed = giveawayMessage.embeds[0];

        // Basic check to confirm it's a giveaway embed
        if (!embed || embed.title !== '🎉 **GIVEAWAY** 🎉' || embed.footer?.text !== 'Ends at') {
            return message.reply('❌ The message ID provided is not for an active giveaway.');
        }

        const prizeMatch = embed.description.match(/\*\*Prize:\*\*\s*(.*)/);
        const prize = prizeMatch ? prizeMatch[1].trim() : 'Unknown Prize';
        
        // --- Giveaway ending logic ---
        const reactions = giveawayMessage.reactions.cache.get('🎉');
        const users = await reactions.users.fetch();
        const entrants = users.filter(user => !user.bot);

        if (entrants.size === 0) {
            const noWinnerEmbed = {
                color: 0xFF0000, // Red
                title: '🛑 **GIVEAWAY ENDED EARLY** 🛑',
                description: `**Prize:** ${prize}\n\nNo one entered the giveaway. 😢`,
                footer: { text: 'Ended by Moderator' },
                timestamp: new Date().toISOString(),
            };
            return giveawayMessage.edit({ embeds: [noWinnerEmbed] });
        }

        const winner = entrants.random();
        const winnerEmbed = {
            color: 0xFF0000, // Red color as requested for early end
            title: '🛑 **GIVEAWAY ENDED EARLY** 🛑',
            description: `**Prize:** ${prize}\n**Winner:** ${winner}!\n\n*(Giveaway ended by a moderator)*`,
            footer: { text: 'Ended by Moderator' },
            timestamp: new Date().toISOString(),
            image: { url: 'https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyYmpqN2Z2cDc3aDk1OXR0MGs1cW1hZ2RlbnB5d2ZidWVhemdzbWh0OSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Z2XIQz9AXISznANAbB/giphy.gif' }, // WINNER GIF
        };
        await giveawayMessage.edit({ embeds: [winnerEmbed] });
        message.channel.send(`Congratulations ${winner}! You won the **${prize}**! (Giveaway ended early)`);
        
    } catch (error) {
        console.error("Giveaway end early error:", error);
        return message.reply('❌ Could not fetch the message or an error occurred while ending the giveaway. Check the ID and make sure it\'s in this channel.');
    }
}

else if (command === 'ping') {
    const sent = await message.channel.send({ content: "🏓 Pinging..." });
    const pingEmbed = { color: 0x39FF14, title: "🏓 Pong!", description: `Latency is **${sent.createdTimestamp - message.createdTimestamp}ms**\nAPI Latency is **${Math.round(client.ws.ping)}ms**`, thumbnail: { url: "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUyM3NueW5kOHp4d3Y3Ymp3amljM21rZW9zYjlueGFucWtncjJiZDU1ZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/WEyJEtMeFAQDLmCf5H/giphy.gif" } };
    await sent.edit({ content: "", embeds: [pingEmbed] });
}

else if (command === 'stats') {
    message.channel.send(`📊 Server has ${message.guild.memberCount} members.`);
}

else if (command === 'uptime') {
    const uptime = Math.floor(process.uptime());
    message.channel.send(`⏱️ Bot uptime: ${uptime} seconds.`);
}

else if (command === 'botinfo') {
    const botInfoEmbed = new EmbedBuilder().setColor(0x00FFFF).setTitle(`🤖 ${client.user.tag} — Bot Info`).setDescription(`📡 [SECURE TRANSMISSION] 📡\n\n**Unit:** Discord Bot\n**Creator / Operator:** TX_SOLDIER\n**Status:** Mission-Ready. Armed.`).addFields({ name: 'Capabilities', value: `**Defense:** Active protection for allied servers.\n` + `**Offense:** Engage threats if provoked or mission parameters require.\n` + `**Recon:** Logging and monitoring activities\n` + `**Special Operations:** Classified.` }).setImage("https://i.imgur.com/yourTopGif.gif").setFooter({ text: 'End Transmission.', iconURL: "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUydGNjNGl3eTZlbTM4MzlxNDRtamFlMWpyaGNiejUzNHYyYXBxM2wxbCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/NsGhIiCIw6yP8UGg0e/giphy.gif" });
    message.channel.send({ embeds: [botInfoEmbed] });
}

else if (command === 'invite') {
    message.channel.send(`🔗 Invite me: https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);
}

else if (command === 'prefix') {
    message.channel.send(`📌 The current prefix is: \`${PREFIX}\` `);
}

else if (command === 'flip') {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    message.channel.send(`🪙 You flipped **${result}**!`);
} 

else if (command === 'flipbet') {
    const [sideArg, amountArg] = args;
    const side = sideArg ? sideArg.toLowerCase() : null;
    const amount = parseInt(amountArg);
    if (!side || (side !== 'heads' && side !== 'tails')) {
        return message.reply('❌ Invalid syntax. Use: `$flipbet <heads|tails> <amount>`');
    }
    if (isNaN(amount) || amount <= 0) {
        return message.reply('❌ The bet amount must be a positive number.');
    }
    const userId = message.author.id;
    const currentBalance = getBalance(userId);
    if (amount > currentBalance) {
        return message.reply(`❌ You only have **${currentBalance}** Gold Coins. You cannot bet **${amount}**.`);
    }
    const flipResult = Math.random() < 0.5 ? 'heads' : 'tails';
    const resultSide = flipResult.charAt(0).toUpperCase() + flipResult.slice(1);
    const userSide = side.charAt(0).toUpperCase() + side.slice(1);
    const coinEmoji = '🪙';
    let win = side === flipResult;
    let newBalance;
    if (win) {
        updateBalance(userId, amount);
        saveEconomyData();
        newBalance = getBalance(userId);
    } else {
        updateBalance(userId, -amount);
        saveEconomyData();
        newBalance = getBalance(userId);
    }
    const embed = new EmbedBuilder().setTitle(`${coinEmoji} Coin Flip Bet! ${coinEmoji}`).addFields({ name: 'Your Pick', value: userSide, inline: true }, { name: 'Bet Amount', value: `**${amount}** Gold Coins`, inline: true }, { name: 'Result', value: `The coin landed on **${resultSide}**!`, inline: false }).setTimestamp();
    if (win) {
        embed.setColor(0x00FF00).setDescription(`🎉 Congratulations, you won **${amount}** Gold Coins!`).setFooter({ text: `New Balance: ${newBalance} Gold Coins` });
    } else {
        embed.setColor(0xFF0000).setDescription(`😭 Too bad, you lost **${amount}** Gold Coins.`).setFooter({ text: `New Balance: ${newBalance} Gold Coins` });
    }
    message.reply({ embeds: [embed] });
}

 else if (command === 'challengeflip') {
    const challengedUser = message.mentions.users.first();
    const amountArg = args[1];
    const amount = parseInt(amountArg);
    const challenger = message.author;
    const challengerId = challenger.id;
    const challengedId = challengedUser ? challengedUser.id : null;
    if (!challengedUser || challengedUser.bot || challengedId === challengerId) {
        return message.reply('❌ You must mention a valid, non-bot user to challenge.');
    }
    if (isNaN(amount) || amount <= 0) {
        return message.reply('❌ The bet amount must be a positive number.');
    }
    if (activeFlipChallenges.has(challengerId) || activeFlipChallenges.has(challengedId)) {
        return message.reply('❌ One of the players is already involved in a coin flip challenge.');
    }
    const challengerBalance = getBalance(challengerId);
    if (amount > challengerBalance) {
        return message.reply(`❌ You only have **${challengerBalance}** Gold Coins. You cannot bet **${amount}**.`);
    }
    const challengedBalance = getBalance(challengedId);
    if (amount > challengedBalance) {
        return message.reply(`❌ **${challengedUser.tag}** only has **${challengedBalance}** Gold Coins and cannot cover the **${amount}** bet.`);
    }

    // mark active challenge & take challenger's stake immediately (same behavior as before)
    activeFlipChallenges.set(challengerId, challengedId);
    activeFlipChallenges.set(challengedId, challengerId);
    updateBalance(challengerId, -amount);
    saveEconomyData();

    const pot = amount * 2;
    const gifUrlDefault = 'https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyN2NxNHllNXJrY2Rwbm5xMGhsZ2trNjV5NXo0OXR5ZWJpMHN2azFvbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/DAYFPLM5fZ47O9c6Aj/giphy.gif'; // default Imgur GIF - replace later
    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🤝 Coin Flip Challenge Initiated!')
        .setDescription(`${challengedUser}, **${challenger.tag}** has challenged you to a coin flip for **${amount}** Gold Coins!`)
        .addFields(
            { name: 'Total Pot', value: `**${pot}** Gold Coins`, inline: true },
            { name: 'To Accept', value: 'React with ✅ (You must have the funds)', inline: true },
            { name: 'To Reject', value: 'React with ❌', inline: true }
        )
        .setFooter({ text: 'Challenge expires in 60 seconds.' })
        .setTimestamp()
        .setImage(gifUrlDefault);

    const challengeMessage = await message.reply({ embeds: [embed] });
    await challengeMessage.react('✅').catch(err => console.error("Could not react with ✅:", err));
    await challengeMessage.react('❌').catch(err => console.error("Could not react with ❌:", err));

    // Accept / Reject collector
    const filter = (reaction, user) => { return ['✅', '❌'].includes(reaction.emoji.name) && user.id === challengedId; };
    const collector = challengeMessage.createReactionCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async (reaction) => {
        collector.stop();
        if (reaction.emoji.name === '✅') {
            // Re-check challenged funds (in case they changed just before accepting)
            const finalChallengedBalance = getBalance(challengedId);
            if (amount > finalChallengedBalance) {
                // refund challenger and cancel
                updateBalance(challengerId, amount);
                saveEconomyData();
                activeFlipChallenges.delete(challengerId);
                activeFlipChallenges.delete(challengedId);
                return challengeMessage.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🛑 Challenge Failed: Insufficient Funds')
                        .setDescription(`**${challengedUser.tag}** no longer has **${amount}** Gold Coins. Challenge canceled and **${challenger.tag}** refunded.`)
                        .setImage(gifUrlDefault)
                        .setTimestamp()
                    ]
                }).catch(err => console.error("Error editing message after acceptance fail:", err));
            }

            // Deduct challenged user's stake
            updateBalance(challengedId, -amount);
            saveEconomyData();

            // Now prompt the challenged user to pick with emoji: 😎 = Heads, 🤠 = Tails
            const pickEmbed = new EmbedBuilder()
                .setColor(0x00BFFF)
                .setTitle('🪙 Choose Your Side')
                .setDescription(`${challengedUser}, react with **😎** for **Heads** or **🤠** for **Tails**.\n\nIf you don't pick in 60 seconds, the challenge will be canceled and the challenger refunded.`)
                .addFields(
                    { name: 'Challenger (auto-assigned)', value: `${challenger.tag}`, inline: true },
                    { name: 'Challenged (choose)', value: `${challengedUser.tag}`, inline: true },
                    { name: 'Total Pot', value: `**${pot}** Gold Coins`, inline: false }
                )
                .setFooter({ text: 'You have 60 seconds to pick.' })
                .setTimestamp()
                .setImage(gifUrlDefault);

            const pickMessage = await message.channel.send({ embeds: [pickEmbed] });
            await pickMessage.react('😎').catch(err => console.error("Could not react with 😎:", err));
            await pickMessage.react('🤠').catch(err => console.error("Could not react with 🤠:", err));

            const pickFilter = (reaction, user) => { return ['😎', '🤠'].includes(reaction.emoji.name) && user.id === challengedId; };
            const pickCollector = pickMessage.createReactionCollector({ pickFilter, time: 60000, max: 1 });

            pickCollector.on('collect', async (pickReaction) => {
                pickCollector.stop();
                // determine choices
                const challengedChoice = pickReaction.emoji.name === '😎' ? 'Heads' : 'Tails';
                const challengerChoice = challengedChoice === 'Heads' ? 'Tails' : 'Heads';

                // flip the coin
                const flipResult = Math.random() < 0.5 ? 'Heads' : 'Tails';
                let winner, loser;
                if (flipResult === challengedChoice) {
                    winner = challengedUser;
                    loser = challenger;
                } else {
                    winner = challenger;
                    loser = challengedUser;
                }

                // Award pot to winner (both stakes already deducted)
                updateBalance(winner.id, pot);
                saveEconomyData();

                const resultEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('💰 Coin Flip Battle Concluded! 🥇')
                    .setDescription(`The coin was flipped! It landed on **${flipResult}**!\n**Winner:** ${winner.tag}`)
                    .addFields(
                        { name: 'Challenger', value: `${challenger.tag} — ${challengerChoice}`, inline: true },
                        { name: 'Challenged', value: `${challengedUser.tag} — ${challengedChoice}`, inline: true },
                        { name: 'Prize', value: `**${pot}** Gold Coins`, inline: false }
                    )
                    .setFooter({ text: `New Balances | Winner: ${getBalance(winner.id)} | Loser: ${getBalance(loser.id)}` })
                    .setTimestamp()
                    .setImage(gifUrlDefault);

                await challengeMessage.edit({ embeds: [resultEmbed] }).catch(err => console.error("Error editing message after winner declared:", err));
                // also edit the pick message to show final result (optional)
                try { await pickMessage.edit({ embeds: [resultEmbed] }); } catch (e) {}

                activeFlipChallenges.delete(challengerId);
                activeFlipChallenges.delete(challengedId);
            });

            pickCollector.on('end', collectedPick => {
                if (collectedPick.size === 0) {
                    // no pick made — refund challenger, refund challenged (since we already deducted both stakes)
                    // challenger should be refunded (they paid at start) and challenged refunded (we deducted at accept)
                    updateBalance(challengerId, amount);
                    updateBalance(challengedId, amount);
                    saveEconomyData();
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle('⏳ Coin Flip Canceled')
                        .setDescription(`**${challengedUser.tag}** did not pick a side in time. **${challenger.tag}** has been refunded **${amount}** Gold Coins and **${challengedUser.tag}** has been refunded **${amount}** Gold Coins.`)
                        .setImage(gifUrlDefault)
                        .setTimestamp();
                    challengeMessage.edit({ embeds: [timeoutEmbed] }).catch(err => console.error("Error editing message after pick timeout:", err));
                    try { pickMessage.edit({ embeds: [timeoutEmbed] }); } catch (e) {}
                    activeFlipChallenges.delete(challengerId);
                    activeFlipChallenges.delete(challengedId);
                }
            });

        } else if (reaction.emoji.name === '❌') {
            // rejected: refund challenger only (challenged never paid)
            updateBalance(challengerId, amount);
            saveEconomyData();
            const rejectEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⚔️ Coin Flip Challenge Rejected')
                .setDescription(`**${challengedUser.tag}** has rejected the challenge. **${challenger.tag}** has been refunded **${amount}** Gold Coins.`)
                .setImage(gifUrlDefault)
                .setTimestamp();
            await challengeMessage.edit({ embeds: [rejectEmbed] }).catch(err => console.error("Error editing message after rejection:", err));
            activeFlipChallenges.delete(challengerId);
            activeFlipChallenges.delete(challengedId);
        }
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            // no response to accept/reject: refund challenger
            updateBalance(challengerId, amount);
            saveEconomyData();
            if (activeFlipChallenges.has(challengerId)) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('⏳ Coin Flip Challenge Timed Out')
                    .setDescription(`**${challengedUser.tag}** did not respond in time. **${challenger.tag}** has been refunded **${amount}** Gold Coins.`)
                    .setImage(gifUrlDefault)
                    .setTimestamp();
                challengeMessage.edit({ embeds: [timeoutEmbed] }).catch(err => console.error("Error editing message after timeout:", err));
                activeFlipChallenges.delete(challengerId);
                activeFlipChallenges.delete(challengedId);
            }
        }
    });
 }
            
  
else if (command === 'roulette') {
    if (!message.guild) return message.reply('❌ This command can only be used in a server.');
    const betAmount = parseInt(args[0]);
    let betTarget = args[1]?.toLowerCase();
    const gifUrl = 'https://i.imgur.com/G4Y2qXg.gif';
    if (isNaN(betAmount) || betAmount <= 0) {
        return message.reply('❌ Please specify a valid bet amount greater than 0. Usage: `$roulette <amount> <number|red|black|even|odd> [optional_gif_url]`');
    }
    if (!betTarget) {
        return message.reply('❌ Please specify your bet target (e.g., `red`, `black`, `odd`, `even`, or a number from 0-36).');
    }
    const balance = getBalance(message.author.id);
    if (balance < betAmount) {
        return message.reply(`❌ You only have **${balance}** Gold Coins. You cannot bet **${betAmount}**.`);
    }
    let payoutMultiplier = 0;
    let betType = 'unknown';
    const numBet = parseInt(betTarget);
    if (!isNaN(numBet) && numBet >= 0 && numBet <= 36) {
        betType = 'number';
        payoutMultiplier = 35;
    } 
    else if (betTarget === 'red' || betTarget === 'black') {
        betType = 'color';
        payoutMultiplier = 2;
    } else if (betTarget === 'even' || betTarget === 'odd') {
        betType = 'parity';
        payoutMultiplier = 2;
    } else {
        return message.reply('❌ Invalid bet target. Choose: `red`, `black`, `even`, `odd`, or a number from `0` to `36`.');
    }
    const resultNumber = Math.floor(Math.random() * 37);
    let resultColor = 'green';
    let isRed = (resultNumber % 2 !== 0 && resultNumber >= 1 && resultNumber <= 10) || (resultNumber % 2 === 0 && resultNumber >= 11 && resultNumber <= 18) || (resultNumber % 2 !== 0 && resultNumber >= 19 && resultNumber <= 28) || (resultNumber % 2 === 0 && resultNumber >= 29 && resultNumber <= 36);
    if (resultNumber !== 0) {
        resultColor = isRed ? 'red' : 'black';
    }
    const isEven = resultNumber !== 0 && resultNumber % 2 === 0;
    const resultParity = resultNumber === 0 ? 'green' : (isEven ? 'even' : 'odd');
    let win = false;
    let winDescription = '';
    if (betType === 'number' && numBet === resultNumber) {
        win = true;
        winDescription = `**Landed on your number!** ${resultNumber}`;
    } else if (betType === 'color' && betTarget === resultColor) {
        win = true;
        winDescription = `**Landed on your color!** ${resultColor.toUpperCase()}`;
    } else if (betType === 'parity' && betTarget === resultParity) {
        win = true;
        winDescription = `**Landed on your parity!** ${resultParity.toUpperCase()}`;
    }
    let newBalance;
    let finalMessage;
    let colorCode;
    if (win) {
        const winnings = betType === 'number' ? betAmount * payoutMultiplier : betAmount * (payoutMultiplier - 1);
        newBalance = updateBalance(message.author.id, winnings);
        saveEconomyData();
        finalMessage = `🎉 **YOU WON!** You bet on **${betTarget.toUpperCase()}**.\n${winDescription}!\n**Payout:** +${winnings} Gold Coins`;
        colorCode = 0x00FF00;
    } else {
        newBalance = updateBalance(message.author.id, -betAmount);
        saveEconomyData();
        finalMessage = `😭 **YOU LOST!** You bet on **${betTarget.toUpperCase()}**.\nIt landed on **${resultNumber} ${resultColor.toUpperCase()}**.\n**Loss:** -${betAmount} Gold Coins`;
        colorCode = 0xFF0000;
    }
    const resultEmbed = new EmbedBuilder().setColor(colorCode).setTitle(`🎰 Roulette: Spin Result`).setDescription(finalMessage).addFields({ name: '💰 Bet Amount', value: `\`${betAmount}\``, inline: true }, { name: '🎯 Bet Target', value: `\`${betTarget.toUpperCase()}\``, inline: true }, { name: '⚫ Result', value: `\`${resultNumber} ${resultColor.toUpperCase()}\``, inline: true }, { name: '💸 New Balance', value: `\`${newBalance}\` Gold Coins`, inline: false }).setImage(gifUrl);
    await message.channel.send({ embeds: [resultEmbed] });
}

else if (command === 'rr') {
    if (!message.guild || !message.member) return message.reply('❌ This command can only be used in a server.');
    if (rrCooldowns.has(message.author.id)) {
        const expirationTime = rrCooldowns.get(message.author.id) + RR_COOLDOWN_TIME;
        const timeLeft = expirationTime - Date.now();
        if (timeLeft > 0) {
            const seconds = Math.ceil(timeLeft / 1000);
            return message.reply(`⚠️ You must wait **${seconds}** seconds before playing Russian Roulette again.`);
        }
    }
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
        return message.reply('❌ I need the **Mute Members** permission to enforce the penalty for this game.');
    }
    const players = [message.author];
    const mentionedUsers = message.mentions.users.filter(u => u.id !== client.user.id && u.id !== message.author.id);
    if (mentionedUsers.size > 4) {
        return message.reply('❌ Russian Roulette is limited to 5 players (yourself + up to 4 others).');
    }
    mentionedUsers.forEach(user => players.push(user));
    const chamberCount = 6;
    const bulletChamber = Math.floor(Math.random() * chamberCount);
    const shotChamber = Math.floor(Math.random() * chamberCount);
    const muteDurationMs = 60 * 60 * 1000;
    const muteEndTimestamp = new Date(Date.now() + muteDurationMs).getTime();
    const gifUrl = args[args.length - 1]?.startsWith('http') ? args[args.length - 1] : 'https://i.imgur.com/8QG9s0G.gif';
    const immunePlayer = players.find(p => isImmune(p));
    if (immunePlayer) {
        return message.reply(`🛡️ **${immunePlayer.tag}** is immune and cannot be muted! The game is cancelled.`);
    }
    const playerList = players.map(p => `• <@${p.id}>`).join('\n');
    const embed = new EmbedBuilder().setColor(0x333333).setTitle('🔫 Russian Roulette: The Cylinder Spins...').setDescription(`**Chamber:** ${chamberCount} \n**Players:**\n${playerList}\n\n**The shot will fire on chamber:** \`${shotChamber + 1}\``).setImage(gifUrl).setFooter({ text: 'One player will be muted for 1 hour.' });
    const gameMessage = await message.channel.send({ embeds: [embed] });
    await new Promise(resolve => setTimeout(resolve, 3000));
    if (bulletChamber === shotChamber) {
        const loser = players[Math.floor(Math.random() * players.length)];
        const loserMember = await message.guild.members.fetch(loser.id);
        try {
            await loserMember.timeout(muteDurationMs, `Lost a game of Russian Roulette (Chamber ${shotChamber + 1}/${chamberCount})`);
            const loseEmbed = new EmbedBuilder().setColor(0xFF0000).setTitle('💥 BANG! The Chamber Fires!').setDescription(`The bullet was in chamber **${bulletChamber + 1}**!\n\n**💀 LOSER:** <@${loser.id}>\n**PENALTY:** You have been muted (timed out) for **1 hour**!`).setImage(gifUrl);
            await message.channel.send({ embeds: [loseEmbed] });
            rrCooldowns.set(message.author.id, Date.now());
            setTimeout(() => rrCooldowns.delete(message.author.id), RR_COOLDOWN_TIME);
        } catch (error) {
            console.error(`Error muting ${loser.tag}:`, error);
            await message.channel.send(`❌ **FATAL ERROR:** I couldn't mute <@${loser.id}>. I might be missing permissions, or their role is higher than mine. **The game results are void.**`);
        }
    } else {
        const winEmbed = new EmbedBuilder().setColor(0x00FF00).setTitle('✅ CLICK. The Chamber is Empty.').setDescription(`The bullet was in chamber **${bulletChamber + 1}**, but the cylinder was spun!\n            \n**🎉 EVERYONE WINS!** No one was muted today. You all live to spin another day.`).setImage(gifUrl);
        await message.channel.send({ embeds: [winEmbed] });
        rrCooldowns.set(message.author.id, Date.now());
        setTimeout(() => rrCooldowns.delete(message.author.id), RR_COOLDOWN_TIME);
    }
}

else if (command === '8ball') {
    const responses = ['Yes.', 'No.', 'Maybe.', 'Ask again later.', 'Definitely!', 'I dont think so.'];
    if (!args.length) return message.reply('🎱 Ask me a question.');
    message.channel.send(`🎱 ${responses[Math.floor(Math.random() * responses.length)]}`);
}

else if (command === 'dice') {
    const roll = Math.floor(Math.random() * 6) + 1;
    message.channel.send(`🎲 You rolled a **${roll}**!`);
}

else if (command === 'rate') {
    const user = message.mentions.users.first() || message.author;
    const rating = Math.floor(Math.random() * 11);
    message.channel.send(`🎯 I rate ${user.username} a **${rating}/10**!`);
}

else if (command === 'howgay') {
    const user = message.mentions.users.first() || message.author;
    const gayness = Math.floor(Math.random() * 101);
    message.channel.send(`🌈 ${user.username} is **${gayness}%** gay!`);
}

else if (command === 'sus') {
    const user = message.mentions.users.first() || message.author;
    const sus = Math.floor(Math.random() * 101);
    message.channel.send(`🕵️ ${user.username} is **${sus}%** sus!`);
}

else if (command === 'truth') {
    message.channel.send(`💬 Truth: ${spicyTruths[Math.floor(Math.random() * spicyTruths.length)]}`);
}

else if (command === 'dare') {
    message.channel.send(`😈 Dare: ${spicyDares[Math.floor(Math.random() * spicyDares.length)]}`);
}

else if (command === 'roast') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('🔥 Tag someone to roast.');
    message.channel.send(`🔥 ${user.username}, ${roasts[Math.floor(Math.random() * roasts.length)]}`);
}

else if (command === 'compliment') {
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
        const embed = { color: 0xFF5733, title: data.title, url: data.postLink, image: { url: data.url }, footer: { text: `From r/${data.subreddit} | 👍 ${data.ups}`}, };
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
        const embed = { color: 0xFF0000, title: data.title, url: data.postLink, image: { url: data.url }, footer: { text: `From r/${data.subreddit} | 👍 ${data.ups}`}, };
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
}

else if (command === 'unhaunt') {
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
    const msg = `🃏 **Blackjack Started!** 🃏\n\n` + `**Your hand:** ${formatHand(playerHand)} (Total: ${playerTotal})\n` + `**Dealer’s hand:** ${dealerHand[0].value}${dealerHand[0].suit} ??\n\n` + `👉 Type \`$hit\` or \`$stand\``;
    message.channel.send(msg);
}

else if (command === 'hit') {
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
}

else if (command === 'stand') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply('⚠️ No active game. Start one with `$blackjack`');
    const dealerHand = game.dealerHand;
    let dealerTotal = handValue(dealerHand);
    while (dealerTotal < 17) {
      dealerHand.push(drawCard());
      dealerTotal = handValue(dealerHand);
    }
    const playerTotal = handValue(game.playerHand);
    let result = `**Your hand:** ${formatHand(game.playerHand)} (Total: ${playerTotal})\n` + `**Dealer’s hand:** ${formatHand(dealerHand)} (Total: ${dealerTotal})\n\n`;
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

else if (!command && message.mentions.users.has(client.user.id)) {
  // 🛑 Prevent OpenRouter from responding to Debate messages
  if (message.reference) {
    try {
      const repliedTo = await message.channel.messages.fetch(message.reference.messageId);
      if (
        repliedTo.embeds?.length &&
        repliedTo.embeds[0].title?.startsWith("💬 Debate Topic")
      ) {
        return; // skip this message — it's part of a debate
      }
    } catch (err) {
      console.error("Debate skip check failed:", err);
    }
  }

  const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  if (!prompt) return message.reply('❓ What would you like to ask?');
  if (prompt.length > 300) {
    return message.reply('❌ Your question is too long. Please keep it under 300 characters.');
  }

  try {
    await message.channel.sendTyping();

    // 🧠 Get and update user's conversation memory
    const userId = message.author.id;
    const history = userConversations.get(userId) || [];

    // Add the new user message
    history.push({ role: "user", content: prompt });

    // Keep only last 6 messages
    if (history.length > 6) history.splice(0, history.length - 6);
    userConversations.set(userId, history);

    let data;
    let modelUsed = "deepseek/deepseek-chat-v3.1:free";

    try {
      // 🧠 Primary model call (DeepSeek)
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: modelUsed,
          messages: history
        })
      });

      data = await response.json();
      if (data.error || response.status >= 500) throw new Error(data.error?.message || "Model error");

    } catch (err) {
      // ⚠️ DeepSeek failed → fallback to Mistral silently
      sendLog(
        message.guild?.id || 'global',
        `⚠️ DeepSeek failed → switching to fallback model (mistralai/mistral-7b-instruct)\nReason: ${err.message}`
      );

      modelUsed = "mistralai/mistral-7b-instruct";

      const backupResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: modelUsed,
          messages: [
            {
              role: "system",
              content:
                "You are DeepSeek, a witty and calm assistant with a confident personality. Speak naturally and keep responses concise but engaging. Avoid robotic or overly formal tones."
            },
            ...history
          ]
        })
      });

      data = await backupResponse.json();
      if (data.error) throw new Error(data.error.message);
    }

    const reply = data.choices?.[0]?.message?.content || "⚠️ Sorry, I couldn’t generate a reply.";
    const output = reply.length > 2000 ? reply.slice(0, 1997) + "..." : reply;
    await message.reply(output);

    // 🧠 Save assistant reply in history
    const updatedHistory = userConversations.get(message.author.id) || [];
    updatedHistory.push({ role: "assistant", content: reply });
    if (updatedHistory.length > 6) updatedHistory.splice(0, updatedHistory.length - 6);
    userConversations.set(message.author.id, updatedHistory);

    // ✅ Log successful AI response
    sendLog(
      message.guild?.id || 'global',
      `🤖 **AI Reply Sent** | Model: ${modelUsed}\n👤 **User:** ${message.author.tag}\n💬 **Prompt:** ${prompt}\n📨 **Reply:** ${output.slice(
        0,
        400
      )}${reply.length > 400 ? "..." : ""}`
    );

  } catch (err) {
    await message.reply("🚫 Error talking to the AI. Try again later.");
    sendLog(message.guild?.id || 'global', `❌ OpenRouter request failed: ${err.message}`);
  }
}

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

else if (command === 'kick') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🔨 Tag a user to kick.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.KickMembers)) return;
    const reason = args.join(' ') || 'No reason provided';
    target.kick(reason).then(() => message.reply(`✅ Kicked ${target.user.tag}. Reason: ${reason}`)).catch(() => message.reply('❌ Cannot kick this user.'));
}

else if (command === 'ban') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🚫 Tag a user to ban.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.BanMembers)) return;
    const reason = args.join(' ') || 'No reason provided';
    target.ban({ reason }).then(() => message.reply(`✅ Banned ${target.user.tag}. Reason: ${reason}`)).catch(() => message.reply('❌ Cannot ban this user.'));
}

else if (command === 'mute') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🤐 Tag a user to mute.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.ModerateMembers)) return;
    const time = args[1] ? parseInt(args[1]) * 1000 : 600000;
    target.timeout(time, 'Muted by bot').then(() => message.reply(`✅ Muted ${target.user.tag}${time ? ` for ${args[1]} seconds` : ''}.`)).catch(() => message.reply('❌ Cannot mute this user.'));
}

else if (command === 'unmute') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('🔊 Tag a user to unmute.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.ModerateMembers)) return;
    target.timeout(null, 'Unmuted by bot').then(() => message.reply(`✅ Unmuted ${target.user.tag}.`)).catch(() => message.reply('❌ Cannot unmute this user.'));
}

else if (command === 'antiraid') {
      if (!isImmune(message.author)) {
          return message.reply('❌ You do not have permission to manage the anti-raid system.');
      }
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
      const channelsToDelete = message.guild.channels.cache.filter(channel => channel.type === 0 && channel.deletable).first(count);
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
      const channelsToRename = message.guild.channels.cache.filter(channel => channel.type === 0 && channel.manageable).first(count);
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

  // ---- AUTO-DELETE COMMAND SYSTEM ----
if (message.content.startsWith('$autodelete')) {
  // Only owner or immune users can use
  if (message.author.id !== OWNER_ID && !isImmune(message.author)) {
    return message.reply('❌ You do not have permission to use this command.');
  }

  const args = message.content.trim().split(/ +/);
  args.shift(); // remove "$autodelete"

  // 🖼️ Customize this GIF (shows at bottom of the list embed)
  const AUTO_DELETE_GIF = "https://media4.giphy.com/media/v1.Y2lkPTZjMDliOTUyc2I2NTRkY204aGEwcjRob2ZhbjU5ZDd1ZzF5NWFvMXBkc3ptYXEwOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/4AoU8U5hfS2meEXc3q/giphy.gif";

  // ---- LIST ----
  if (args[0]?.toLowerCase() === 'list') {
    const activeIds = Object.keys(botData.autoDeleteUsers || {});
    if (activeIds.length === 0) {
      return message.reply('📜 No users are currently marked for auto-deletion.');
    }

    // Build pretty list with cached usernames if possible
    const listed = activeIds.map(id => {
      const user = client.users.cache.get(id);
      return `• ${user ? `**${user.tag}** (${id})` : `\`${id}\``}`;
    });

    const { EmbedBuilder } = require('discord.js');
    const listEmbed = new EmbedBuilder()
      .setColor(0xff5555)
      .setTitle('🧾 Auto-Delete Active List')
      .setDescription(listed.join('\n'))
      .setFooter({ text: `Total Users: ${activeIds.length}` })
      .setImage(AUTO_DELETE_GIF)
      .setTimestamp();

    return message.reply({ embeds: [listEmbed], allowedMentions: { parse: [] } });
  }

  // ---- MAIN FUNCTIONALITY ----
  if (args.length === 0) {
    return message.reply(
      '⚠️ Usage: `$autodelete <userId> [on|off] [moreUserIds...]`\n' +
      'Example:\n`$autodelete 123456789 on`\n`$autodelete 111 222 333`\n`$autodelete list`'
    );
  }

  // Detect explicit ON/OFF mode
  let explicitMode = null;
  const modeIndex = args.findIndex(a => a.toLowerCase() === 'on' || a.toLowerCase() === 'off');
  if (modeIndex !== -1) {
    explicitMode = args[modeIndex].toLowerCase();
    args.splice(modeIndex, 1);
  }

  // Collect all valid user IDs
  const userIds = args.filter(id => /^\d+$/.test(id));
  if (userIds.length === 0) {
    return message.reply('⚠️ Please provide at least one valid **user ID**.');
  }

  let results = [];

  for (const id of userIds) {
    if (explicitMode === 'on') {
      botData.autoDeleteUsers[id] = true;
      results.push(`✅ Enabled for <@${id}>`);
    } else if (explicitMode === 'off') {
      delete botData.autoDeleteUsers[id];
      results.push(`❌ Disabled for <@${id}>`);
    } else {
      botData.autoDeleteUsers[id] = !botData.autoDeleteUsers[id];
      results.push(`${botData.autoDeleteUsers[id] ? '✅ Enabled' : '❌ Disabled'} for <@${id}>`);
    }
  }

  markDirty();
  const response = results.join('\n');
  await message.reply(`🧹 **Auto-delete settings updated:**\n${response}`);

  // Log to master/global log
  const logMsg = `\`[AUTO-DELETE TOGGLE]\` **${message.author.tag}** updated settings:\n${response}`;
  await sendLog(message.guild.id, logMsg);
  return;
}

else if (command === 'userinfo') {
    const user = message.mentions.users.first() || message.author;
    const member = message.guild.members.cache.get(user.id);
    message.channel.send(`🧑 User Info:\nUsername: ${user.username}\nTag: ${user.tag}\nID: ${user.id}\nJoined Server: ${member.joinedAt.toDateString()}\nAccount Created: ${user.createdAt.toDateString()}`);
}

else if (command === 'avatar') {
    const user = message.mentions.users.first() || message.author;
    message.channel.send(`${user.username}'s Avatar: ${user.displayAvatarURL({ dynamic: true, size: 1024 })}`);
}

else if (command === 'serverinfo') {
    const guild = message.guild;
    message.channel.send(`🏠 Server Info:\nName: ${guild.name}\nID: ${guild.id}\nMembers: ${guild.memberCount}\nCreated: ${guild.createdAt.toDateString()}`);
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
    channel.send(args.slice(1).join(' ')).then(() => message.reply(`✅ Message sent to #${channel.name} in ${channel.guild.name}.`)).catch(err => message.reply(`❌ Failed to send message. Error: ${err.message}`));
}

else if (command === 'warn') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Tag a user to warn.');
    if (isImmune(target.user)) return message.reply('❌ This user is immune!');
    if (!checkPermission(PermissionsBitField.Flags.KickMembers)) return;
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (!botData.warnings[target.id]) botData.warnings[target.id] = [];
    botData.warnings[target.id].push({ reason, date: new Date().toISOString(), mod: message.author.tag });
    saveWarnings();
    message.reply(`⚠️ Warned ${target.user.tag}. Reason: ${reason}`);
}

else if (command === 'warnings') {
    const target = message.mentions.members.first() || message.member;
    const userWarnings = botData.warnings[target.id] || [];
    if (!userWarnings.length) return message.reply('ℹ️ No warnings found.');
    let text = `⚠️ Warnings for ${target.user.tag}:\n`;
    userWarnings.forEach((w, i) => text += `${i + 1}. [${w.date}] ${w.mod}: ${w.reason}\n`);
    message.channel.send(text);
}

else if (command === 'clear') {
  // ✅ Owner or immune users only
  if (message.author.id !== OWNER_ID && !isImmune(message.author)) {
    return message.reply('❌ You do not have permission to use this command.')
      .then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000));
  }

  // ✅ Cooldown to prevent spam
  const clearCooldowns = global.clearCooldowns || (global.clearCooldowns = new Set());
  if (clearCooldowns.has(message.author.id)) {
    return message.reply('⏳ Please wait a few seconds before using this again.')
      .then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000));
  }
  clearCooldowns.add(message.author.id);
  setTimeout(() => clearCooldowns.delete(message.author.id), 5000); // 5 sec cooldown

  const count = parseInt(args[0]);
  if (!count || count < 1 || count > 100) {
    return message.reply('❌ Enter a number between 1–100.')
      .then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000));
  }

  try {
    // Delete command message first
    await message.delete().catch(() => {});

    // Perform the bulk deletion
    const requested = count;
    const deleted = await message.channel.bulkDelete(requested, true);
    const skipped = requested - deleted.size;

    // 🧹 Temporary confirmation
    const confirmMsg = await message.channel.send(
      skipped > 0
        ? `🧹 Deleted ${deleted.size} messages (skipped ${skipped} old messages).`
        : `🧹 Deleted ${deleted.size} messages.`
    );
    setTimeout(() => confirmMsg.delete().catch(() => {}), 4000);

    // 🪶 Log embed
    const logEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🧹 Message Clear Executed')
      .addFields(
        { name: 'Server', value: `${message.guild.name}`, inline: false },
        { name: 'Moderator', value: `${message.author.tag} (<@${message.author.id}>)`, inline: false },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
        { name: 'Messages Deleted', value: `${deleted.size}`, inline: true },
        { name: 'Skipped (Old Messages)', value: `${skipped}`, inline: true }
      )
      .setFooter({ text: `User ID: ${message.author.id}` })
      .setTimestamp();

    // ✅ Send log to all log systems
    await sendLog(message.guild.id, { embeds: [logEmbed] });

  } catch (err) {
    console.error('❌ Clear command error:', err);
    message.reply('❌ Cannot delete messages (they may be older than 14 days or I lack permissions).')
      .then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000));
  }
}

else if (command === 'lock') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).then(() => message.reply('🔒 Channel locked.')).catch(() => message.reply('❌ Cannot lock this channel.'));
}

else if (command === 'unlock') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true }).then(() => message.reply('🔓 Channel unlocked.')).catch(() => message.reply('❌ Cannot unlock this channel.'));
}

else if (command === 'slowmode') {
    if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
    const time = parseInt(args[0]);
    if (isNaN(time) || time < 0 || time > 21600) return message.reply('❌ Enter a valid number (0-21600 seconds).');
    message.channel.setRateLimitPerUser(time).then(() => message.reply(`🐌 Slowmode set to ${time} seconds.`)).catch(() => message.reply('❌ Cannot set slowmode.'));
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
      target.roles.add(role).then(() => message.reply(`✅ Added role ${role.name} to ${target.user.tag}.`)).catch(() => message.reply('❌ Cannot add role.'));
    } else if (subcommand === 'remove') {
      target.roles.remove(role).then(() => message.reply(`✅ Removed role ${role.name} from ${target.user.tag}.`)).catch(() => message.reply('❌ Cannot remove role.'));
    } else {
      message.reply('❌ Use `$role add @user <role>` or `$role remove @user <role>`');
    }
}

  // ===============================
// XP + Prestige System — Full Command Suite
// ===============================

// ---- RANK CARD (Prestige Frames + Gradient Bar) ----
if (command === 'rank') {
  const user = message.mentions.users.first() || message.author;
  const xpData = getXPData(user.id);
  const balance = getBalance(user.id);
  const xpToLevel =
    botData.xpSettings.xpToNext * Math.pow(xpData.level, botData.xpSettings.levelMultiplier);

  const { Rank } = require('canvacord');

const prestigeIcon = ['⭐','🌟','💫','🔥','⚡','👑','💎','🏆','🪙','🎖️'][xpData.prestige] || '⭐';

// ✅ Safe fallback backgrounds (Imgur — guaranteed online)
const prestigeBackgrounds = {
  0: 'https://i.imgur.com/Qm9X9jN.png',
  1: 'https://i.imgur.com/Qm9X9jN.png',
  2: 'https://i.imgur.com/Qm9X9jN.png',
  3: 'https://i.imgur.com/Qm9X9jN.png',
  4: 'https://i.imgur.com/Qm9X9jN.png',
  5: 'https://i.imgur.com/Qm9X9jN.png',
  6: 'https://i.imgur.com/Qm9X9jN.png',
  7: 'https://i.imgur.com/Qm9X9jN.png',
  8: 'https://i.imgur.com/Qm9X9jN.png',
  9: 'https://i.imgur.com/Qm9X9jN.png',
};

const background = xpData.background || prestigeBackgrounds[Math.min(xpData.prestige, 9)] || 'https://i.imgur.com/Qm9X9jN.png';

  const rank = new Rank()
    .setAvatar(user.displayAvatarURL({ extension:'png' }))
    .setUsername(`${user.username} ${prestigeIcon.repeat(Math.min(xpData.prestige,5))}`)
    .setDiscriminator(user.discriminator)
    .setLevel(xpData.level).setRank(xpData.prestige)
    .setCurrentXP(xpData.xp).setRequiredXP(xpToLevel)
    .setProgressBar(['#FFD700','#FFA500','#FF4500'],'GRADIENT')
    .setBackground('IMAGE',background)
    .setOverlay('#000',0.3,false)
    .setLevelColor('#FFD700','#FFF').setRankColor('#00BFFF','#FFF');
    
  const card = await rank.build();
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(`${user.username}'s Profile`)
    .setDescription(
      `🧠 **Level:** ${xpData.level}\n⭐ **Prestige:** ${xpData.prestige}\n` +
      `💰 **Coins:** ${balance}\n📈 **Total XP:** ${xpData.totalXp.toLocaleString()}`
    )
    .setFooter({ text:'XP & Prestige System — Prestige Frames Edition' });

  message.channel.send({ embeds:[embed], files:[{ attachment:card, name:'rank.png' }] });
}

// ---- SET BACKGROUND ----
if (command === 'setbg') {
  const url = args[0];
  if (!url || !/^https?:\/\/[^\s]+$/.test(url))
    return message.reply('⚠️ Provide a valid image URL.');
  const data = getXPData(message.author.id);
  data.background = url; saveXPData();
  message.reply('✅ Background image updated for your rank card!');
}

// ---- PRESTIGE ----
if (command === 'prestige') {
  const data = getXPData(message.author.id);
  if (data.level < botData.xpSettings.maxLevel)
    return message.reply(`⛔ Reach level ${botData.xpSettings.maxLevel} to prestige!`);
  if (data.prestige >= botData.xpSettings.maxPrestige)
    return message.reply('🏁 You have reached max prestige!');
  handlePrestige(message.author.id, data);
  message.reply(`⭐ You have prestiged! Now Prestige ${data.prestige}.`);
}

// ---- XP LEADERBOARD ----
if (command === 'xpleaderboard' || command === 'xplb') {
  const top = Object.entries(botData.xpData)
    .filter(([id]) => message.guild.members.cache.has(id))
    .sort(([,a],[,b]) => b.totalXp - a.totalXp).slice(0,10);
  if (!top.length) return message.reply('📉 No XP data found yet.');
  const embed = new EmbedBuilder()
    .setTitle(`🏆 XP Leaderboard — ${message.guild.name}`)
    .setColor(0xFFD700)
    .setDescription(top.map(([id,d],i)=>{
      const coins=getBalance(id);
      const icon=['⭐','🌟','💫','🔥','⚡','👑','💎','🏆','🪙','🎖️'][d.prestige]||'⭐';
      return `**${i+1}.** <@${id}> — 🧠 Lvl **${d.level}** (${icon}${d.prestige}) • 💰 **${coins}**`;
    }).join('\n'))
    .setFooter({ text:'Prestige = total resets, Level resets every 100.' });
  message.channel.send({ embeds:[embed] });
}

// ---- XPINFO ----
if (command === 'xpinfo') {
  const target = message.mentions.users.first() || message.author;
  const data = getXPData(target.id); const coins=getBalance(target.id);
  const xpToNext=Math.floor(botData.xpSettings.xpToNext*Math.pow(data.level,botData.xpSettings.levelMultiplier));
  const remaining=Math.max(0,xpToNext-data.xp);
  const percent=Math.min(100,((data.xp/xpToNext)*100).toFixed(1));
  const totalBars=20, filled=Math.round((percent/100)*totalBars);
  const bar=`\`${'█'.repeat(filled)}${'░'.repeat(totalBars-filled)}\` ${percent}%`;
  const s=botData.xpSettings;
  const embed=new EmbedBuilder()
    .setColor(0x00bfff).setTitle(`📘 XP & CP Information — ${target.username}`)
    .setThumbnail(target.displayAvatarURL({ dynamic:true }))
    .setDescription(
      `**🧠 Level:** ${data.level}\n⭐ **Prestige:** ${data.prestige}\n💰 **Coins (CP):** ${coins.toLocaleString()}\n`+
      `**📈 XP:** ${data.xp.toLocaleString()} / ${xpToNext.toLocaleString()}\n${bar}\n`+
      `**⬆️ Needed:** ${remaining.toLocaleString()} XP\n\n`+
      `**🎯 XP Earn Rate:**\n• ${s.baseXp}–${s.baseXp+10} XP per message\n• Cooldown: ${s.cooldown}s\n• Growth: ${s.levelMultiplier}× per level\n• Reward: ${s.coinRewardPerLevel} CP/level\n• Prestige bonus: ${s.coinRewardPerPrestige}×tier CP\n\n`+
      `**🏅 How to Earn:**\n• Chat every ${s.cooldown}s\n• Join events & commands\n• Level up & prestige\n• Max level ${s.maxLevel} → new prestige\n\n`+
      `**📖 Tips:**\n• Prestige resets level but boosts rewards\n• Use $rank & $xpleaderboard to track progress`
    )
    .setFooter({ text:'XP & Prestige System — Player Guide' }).setTimestamp();
  message.channel.send({ embeds:[embed] });
}

// ===============================
// Level-Up Announcement Controls
// ===============================

// ---- SET LEVEL-UP CHANNEL ----
if (command === 'setlevelupchannel') {
  if (!isImmune(message.author)) return message.reply('❌ No permission.');
  const ch = message.mentions.channels.first();
  if (!ch) return message.reply('⚙️ Usage: `$setlevelupchannel #channel`');
  botData.levelUpChannel = ch.id; markDirty();
  message.reply(`✅ Level-up announcements will now appear in ${ch}.`);
}

// ---- DISABLE LEVEL-UP ANNOUNCEMENTS ----
if (command === 'disablelevelup') {
  if (!isImmune(message.author)) return message.reply('❌ No permission.');
  botData.levelUpChannel = null; markDirty();
  message.reply('🚫 Level-up announcements disabled.');
}

// ===============================
// XP Management & Admin Commands
// ===============================

if (command === 'addxp') {
  if (!isImmune(message.author)) return message.reply('❌ No permission.');
  const u=message.mentions.users.first(); const amt=parseInt(args[1]);
  if(!u||isNaN(amt))return message.reply('⚙️ `$addxp @user <amount>`');
  addXP(u.id,amt); message.reply(`✅ Added **${amt} XP** to ${u.username}.`);
}

if (command === 'removexp') {
  if (!isImmune(message.author)) return message.reply('❌ No permission.');
  const u=message.mentions.users.first(); const amt=parseInt(args[1]);
  if(!u||isNaN(amt))return message.reply('⚙️ `$removexp @user <amount>`');
  const d=getXPData(u.id); d.xp=Math.max(0,d.xp-amt); saveXPData();
  message.reply(`🧹 Removed **${amt} XP** from ${u.username}.`);
}

if (command === 'setlevel') {
  if (!isImmune(message.author)) return message.reply('❌ No permission.');
  const u=message.mentions.users.first(); const lvl=parseInt(args[1]);
  if(!u||isNaN(lvl))return message.reply('⚙️ `$setlevel @user <level>`');
  const d=getXPData(u.id); d.level=Math.min(lvl,botData.xpSettings.maxLevel); saveXPData();
  message.reply(`🔧 Set ${u.username}'s level to **${d.level}**.`);
}

if (command === 'setprestige') {
  if (!isImmune(message.author)) return message.reply('❌ No permission.');
  const u=message.mentions.users.first(); const p=parseInt(args[1]);
  if(!u||isNaN(p))return message.reply('⚙️ `$setprestige @user <prestige>`');
  const d=getXPData(u.id); d.prestige=Math.min(p,botData.xpSettings.maxPrestige); saveXPData();
  message.reply(`👑 Set ${u.username}'s prestige to **${d.prestige}**.`);
}

if (command === 'resetxp') {
  if (!isImmune(message.author)) return message.reply('❌ No permission.');
  const u=message.mentions.users.first();
  if(!u)return message.reply('⚙️ `$resetxp @user`');
  delete botData.xpData[u.id]; saveXPData();
  message.reply(`♻️ Reset all XP data for ${u.username}.`);
}

if (command === 'xpsettings') {
  const s=botData.xpSettings;
  const embed=new EmbedBuilder()
    .setTitle('⚙️ XP System Settings').setColor(0x00bfff)
    .setDescription(
      `Base XP/msg: ${s.baseXp}\nCooldown: ${s.cooldown}s\nXP Next(base): ${s.xpToNext}\nMultiplier: ${s.levelMultiplier}\nCoins/Level: ${s.coinRewardPerLevel}\nCoins/Prestige: ${s.coinRewardPerPrestige}\nMax Level: ${s.maxLevel}\nMax Prestige: ${s.maxPrestige}`
    ).setFooter({ text:'Use $setxpsetting <key> <value> to modify.' });
  message.channel.send({ embeds:[embed] });
}

if (command === 'setxpsetting') {
  if (!isImmune(message.author)) return message.reply('❌ No permission.');
  const k=args[0]; const v=parseFloat(args[1]);
  if(!k||isNaN(v))return message.reply('⚙️ `$setxpsetting <key> <value>`');
  if(!(k in botData.xpSettings))return message.reply('⚠️ Invalid key.');
  botData.xpSettings[k]=v; markDirty();
  message.reply(`✅ Updated **${k}** → **${v}**.`);
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
      const sendInitialQuestion = () => {
        const question = qotdQuestions[Math.floor(Math.random() * qotdQuestions.length)];
        channel.send(`**❓ Question of the Day:** ${question}`);
        logToGlobal(question, message.guild.name, channel.name);
      };
      sendInitialQuestion();
      const interval = setInterval(() => sendQuestion(channelId), 24 * 60 * 60 * 1000);
      qotdIntervals.set(channelId, interval);
    } else if (subcommand === 'off') {
      if (!activeQotdChannels.has(channelId)) {
        return message.reply('❌ QOTD is not currently active in this channel.');
      }
      stopQotd(channelId); // Use the helper function
      message.reply('✅ Question of the Day has been disabled in this channel.');
    } else if (subcommand === 'everyone') {
        const toggle = args[1]?.toLowerCase();
        if (toggle !== 'on' && toggle !== 'off') {
            return message.reply('❌ Usage: `$qotd everyone <on|off>`');
        }
        botData.qotdSettings[channelId] = { everyone: toggle === 'on' };
        saveQotdSettings();
        message.reply(`✅ @everyone pings for QOTD have been turned **${toggle}** in this channel.`);
    } else {
      message.reply('❌ Usage: `$qotd on`, `$qotd off`, or `$qotd everyone <on|off>`.');
    }
}

else if (command === 'setwelcome') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
    const channel = message.mentions.channels.first() || message.channel;
    
    let welcomeMessage = '';
    let gifUrl = null;
    
    // Check if the last argument is a URL
    const potentialUrl = args[args.length - 1];
    if (potentialUrl && (potentialUrl.startsWith('http://') || potentialUrl.startsWith('https://'))) {
        gifUrl = potentialUrl;
        welcomeMessage = args.slice(1, -1).join(' '); // All args except channel mention and URL
    } else {
        welcomeMessage = args.slice(1).join(' '); // All args except channel mention
    }

    if (!welcomeMessage) return message.reply('❌ Please provide a welcome message. Usage: `$setwelcome [#channel] <message> [gif_url]`');

    botData.welcomeMessages[message.guild.id] = { 
        channelId: channel.id, 
        message: welcomeMessage,
        gifUrl: gifUrl // Store the URL (can be null)
    };
    saveWelcomeMessages();
    
    let confirmation = `✅ Welcome message set for ${channel}.`;
    if (gifUrl) {
        confirmation += `\nThe GIF will also be displayed.`;
    }
    message.reply(confirmation + `\nUse \`{user}\` to tag the user, \`{server}\` for the server name, and \`{membercount}\` for the member count.`);
}

else if (command === 'clearwelcome') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
    if (!botData.welcomeMessages[message.guild.id]) {
      return message.reply('❌ No welcome message is currently set for this server.');
    }
    delete botData.welcomeMessages[message.guild.id];
    saveWelcomeMessages();
    message.reply('✅ Welcome message has been cleared for this server.');
}

else if (command === 'setleave') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
    const channel = message.mentions.channels.first() || message.channel;
    
    let leaveMessage = '';
    let gifUrl = null;

    // Check if the last argument is a URL
    const potentialUrl = args[args.length - 1];
    if (potentialUrl && (potentialUrl.startsWith('http://') || potentialUrl.startsWith('https://'))) {
        gifUrl = potentialUrl;
        leaveMessage = args.slice(1, -1).join(' ');
    } else {
        leaveMessage = args.slice(1).join(' ');
    }

    if (!leaveMessage) return message.reply('❌ Please provide a leave message. Usage: `$setleave [#channel] <message> [gif_url]`');
    
    botData.leaveMessages[message.guild.id] = { 
        channelId: channel.id, 
        message: leaveMessage,
        gifUrl: gifUrl // Store the URL (can be null)
    };
    saveLeaveMessages();

    let confirmation = `✅ Leave message set for ${channel}.`;
    if (gifUrl) {
        confirmation += `\nThe GIF will also be displayed.`;
    }
    message.reply(confirmation + `\nUse \`{user}\` for the user's tag, \`{server}\` for the server name, and \`{membercount}\` for the member count.`);
      }

else if (command === 'clearleave') {
    if (!checkPermission(PermissionsBitField.Flags.ManageGuild)) return;
    if (!botData.leaveMessages[message.guild.id]) {
      return message.reply('❌ No leave message is currently set for this server.');
    }
    delete botData.leaveMessages[message.guild.id];
    saveLeaveMessages();
    message.reply('✅ Leave message has been cleared for this server.');
} 

});

// Track how many times data has been saved this session

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const prefix = "$"; // Your bot's prefix
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---- Force Save Command ----
  if (command === "forcesave") {
    // Only the bot owner or immune users can use this
    if (message.author.id !== OWNER_ID && !isImmune(message.author)) {
      return message.reply("❌ You don’t have permission to force save.");
    }

    try {
      const before = Date.now();
      await saveData();
      const duration = ((Date.now() - before) / 1000).toFixed(2);

      saveCount++;
      lastSaveTime = new Date().toLocaleTimeString();

      // Build an info message
      const infoMsg = `💾 **Force Save Complete!**  
**User:** ${message.author.tag} (${message.author.id})
**Save Count (this session):** ${saveCount}
**Last Save:** ${lastSaveTime}
**Duration:** ${duration}s`;

      await message.reply(infoMsg);

      // --- Log it globally and/or to master log ---
      const logMsg = `💾 **Force Save Triggered**
👤 User: **${message.author.tag}** (${message.author.id})
🏠 Server: **${message.guild?.name || 'DM'}**
🕒 Time: ${lastSaveTime}
💾 Total Saves This Session: ${saveCount}
⚙️ Duration: ${duration}s`;

      await sendLog(message.guild?.id, logMsg);
      console.log(`[DATA] Force save by ${message.author.tag} (${duration}s) — total saves: ${saveCount}`);
    } catch (err) {
      console.error("Force save failed:", err);
      message.reply("⚠️ Failed to save data. Check console for details.");
    }

    // ✅ Stop here after handling $forcesave
    return;
  }

}); // ---- End of messageCreate ----

// ---- Login ----
client.login(process.env.BOT_TOKEN);
