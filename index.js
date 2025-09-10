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

// ---- Question of the Day ----
const qotdChannels = new Set();
const qotdIntervals = new Map();
const qotdQuestions = [
    "What's your favorite childhood memory?",
    "If you could travel anywhere right now, where would it be?",
    "What's a skill you wish you had?",
    "What's the most unusual food you've tried?",
    "What's your dream job?",
    "What's something you've done that you're proud of?",
    "If you could meet any celebrity, who would it be?",
    "What's your guilty pleasure TV show or movie?",
    "What's a habit you want to break?",
    "What's the weirdest thing you've ever collected?"
];
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
    // Extra questions omitted for brevity in this explanation
];

// ---- Spicy Dares ----
const spicyDares = [
    "Change your nickname to something silly for 10 minutes.",
    "Type your next 3 messages in ALL CAPS.",
    "Send a random emoji in the chat every 10 seconds for 1 minute.",
    "Say something nice about the last person who spoke.",
    "Do 10 pushups (or pretend to and tell us how it went).",
    // Extra dares omitted for brevity
];

// ---- Compliments ----
const compliments = [
    "You have great taste in music.",
    "Your energy makes the chat better.",
    "You are so damn fine.",
    "If you were a snack id eat u up.",
    "You have an amazing vibe.",
    // Extra compliments omitted for brevity
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
    const values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    return { suit: suits[Math.floor(Math.random() * suits.length)], value: values[Math.floor(Math.random() * values.length)] };
}
function cardValue(card) {
    if (['J','Q','K'].includes(card.value)) return 10;
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

// ---- Prefix ----
const PREFIX = '$';

// ---- Message Handler ----
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX) && !message.mentions.users.has(client.user.id)) return;

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

    // ---- Question of the Day Commands ----
    if (command === 'qotd') {
        const subcommand = args.shift()?.toLowerCase();
        if (subcommand === 'on') {
            if (qotdChannels.has(message.channel.id)) return message.channel.send('📝 QOTD is already active in this channel!');
            qotdChannels.add(message.channel.id);
            message.channel.send('📝 Question of the Day is now active in this channel.');
            const interval = setInterval(() => {
                if (!qotdChannels.has(message.channel.id)) return clearInterval(interval);
                const question = qotdQuestions[Math.floor(Math.random() * qotdQuestions.length)];
                message.channel.send(`📝 Question of the Day: ${question}`);
            }, 86400000); // 24 hours in milliseconds
            qotdIntervals.set(message.channel.id, interval);
        } else if (subcommand === 'off') {
            if (!qotdChannels.has(message.channel.id)) return message.channel.send('📝 QOTD is not active in this channel.');
            qotdChannels.delete(message.channel.id);
            if (qotdIntervals.has(message.channel.id)) {
                clearInterval(qotdIntervals.get(message.channel.id));
                qotdIntervals.delete(message.channel.id);
            }
            message.channel.send('📝 Question of the Day has been turned off in this channel.');
        } else {
            message.reply('❌ Use `$qotd on` or `$qotd off`');
        }
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
        if (blackjackGames.has(message.author.id)) return message.reply('⚠️ You already have a game! Use $hit or $stand.');
        const playerHand = [drawCard(), drawCard()];
        const dealerHand = [drawCard(), drawCard()];
        blackjackGames.set(message.author.id, { playerHand, dealerHand });
        const playerTotal = handValue(playerHand);
        const msg = `🃏 **Blackjack Started!** 🃏\n\n**Your hand:** ${formatHand(playerHand)} (Total: ${playerTotal})\n**Dealer’s hand:** ${dealerHand[0].value}${dealerHand[0].suit} ??\n\n👉 Type $hit or $stand`;
        message.channel.send(msg);
    } else if (command === 'hit') {
        const game = blackjackGames.get(message.author.id);
        if (!game) return message.reply('⚠️ No active game. Start one with $blackjack.');
        game.playerHand.push(drawCard());
        const playerTotal = handValue(game.playerHand);
        let msg = `Your hand: ${formatHand(game.playerHand)} (Total: ${playerTotal})`;
        if (playerTotal > 21) {
            msg += '\n💥 You busted! Dealer wins.';
            blackjackGames.delete(message.author.id);
        } else {
            msg += '\n👉 Type $hit or $stand';
        }
        message.channel.send(msg);
    } else if (command === 'stand') {
        const game = blackjackGames.get(message.author.id);
        if (!game) return message.reply('⚠️ No active game. Start one with $blackjack.');
        const dealerHand = game.dealerHand;
        let dealerTotal = handValue(dealerHand);
        while (dealerTotal < 17) {
            dealerHand.push(drawCard());
            dealerTotal = handValue(dealerHand);
        }
        const playerTotal = handValue(game.playerHand);
        let result = `Your hand: ${formatHand(game.playerHand)} (Total: ${playerTotal})\nDealer’s hand: ${formatHand(dealerHand)} (Total: ${dealerTotal})\n\n`;
        if (playerTotal > 21) result += '💥 You busted! Dealer wins.';
        else if (dealerTotal > 21) result += '🎉 Dealer busted! You win!';
        else if (playerTotal > dealerTotal) result += '🎉 You win!';
        else if (playerTotal < dealerTotal) result += '😢 Dealer wins.';
        else result += '🤝 It’s a tie!';
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
                    model: "openai/gpt-3.5-turbo",  
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
        if (!prompt) return message.reply('❓ Please provide a prompt. Example: $ai tell me a story');

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
    } else if (command === 'avatar') {
        const user = message.mentions.users.first() || message.author;
        message.channel.send(`${user.username}'s Avatar: ${user.displayAvatarURL({ dynamic: true, size: 1024 })}`);
    } else if (command === 'serverinfo') {
        const guild = message.guild;
        message.channel.send(`🏠 Server Info: 
Name: ${guild.name} 
ID: ${guild.id} 
Members: ${guild.memberCount} 
Created: ${guild.createdAt.toDateString()}`);
    } else if (command === 'shout') {
        if (!args.length) return message.reply('📢 Provide a message to shout.');
        message.channel.send(args.join(' ').toUpperCase());
    } else if (command === 'spoiler') {
        if (!args.length) return message.reply('🤐 Provide a message to hide as spoiler.');
        message.channel.send(`||${args.join(' ')}||`);
    } else if (command === 'say') {
        if (!args.length) return message.reply('📣 Provide a message to echo.');
        message.channel.send(args.join(' '));
    } else if (command === 'send') {
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

    // ---- Question of the Day (QOTD) ----
    else if (command === 'qotd') {
        if (!checkPermission(PermissionsBitField.Flags.ManageChannels)) return;
        const sub = args[0];
        if (sub === 'on') {
            if (qotdChannels.has(message.channel.id)) return message.reply('✅ QOTD is already active in this channel.');
            qotdChannels.add(message.channel.id);
            message.channel.send('🌟 QOTD has been enabled in this channel.');
        } else if (sub === 'off') {
            if (!qotdChannels.has(message.channel.id)) return message.reply('✅ QOTD is already disabled in this channel.');
            qotdChannels.delete(message.channel.id);
            message.channel.send('🛑 QOTD has been disabled in this channel.');
        } else {
            message.reply('ℹ️ Usage: $qotd <on/off>');
        }
    }

    // ---- Unknown command ----
    else {
        if (message.content.startsWith('$')) {
            message.reply('❌ Unknown command or you do not have permission.');
        }
    }

}); // ---- End of messageCreate ----

// ---- Keep-alive QOTD Interval ----
setInterval(() => {
    qotdChannels.forEach(async (channelId) => {
        const channel = client.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased()) return;
        const question = qotdQuestions[Math.floor(Math.random() * qotdQuestions.length)];
        await channel.send(`🌟 **Question of the Day:** ${question}`);
    });
}, 12 * 60 * 60 * 1000); // every 12 hours

// ---- Login ----
client.login(process.env.BOT_TOKEN);
