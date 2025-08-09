require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch'); // <== added this line
const express = require('express');

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

const hauntedChannels = new Set();
const spookyMessages = [
  '👻 Boo...', '💀 I see you...', '🩸 The shadows are watching...',
  '🔪 Behind you...', '🕷️ Something crawled across your screen...',
];

const spicyTruths = [
  "Have you ever had a crush on someone in this server?",
  "What’s your biggest guilty pleasure?",
  "What's the wildest thing you've done in public?",
  "Have you ever sent a risky text and regretted it?",
  "Who here do you secretly stalk the most?",
  "What’s your biggest turn-on?",
  "What’s something you've done that you’d never admit to your parents?",
  "What’s the dirtiest thought you've had today?",
  "Have you ever lied to get out of trouble recently?",
  "What's something you're glad your ex doesn't know?",
  "If you could kiss anyone in this server, who would it be?",
  "What’s something you pretend to like but actually hate?",
  "Have you ever hooked up with someone and regretted it?",
  "Have you ever flirted with someone just to get something?",
  "Have you ever been caught watching something... spicy?",
];

const spicyDares = [
  "Send a flirty DM to the last person you messaged 😏",
  "Change your nickname to ‘Thirst Trap’ for 10 minutes 🔥",
  "Confess a secret crush (real or fake) in this server ❤️",
  "Send ‘I'm single and ready to mingle 😉’ in a random channel",
  "Record yourself saying something embarrassing and post it!",
  "DM someone ‘I had a dream about you last night…’ 👀",
  "Type your last Google search here, no deleting! 😳",
  "Write 'I'm feeling spicy today 🌶️' as your status for 15 mins",
  "Send a random pickup line to any online user",
  "Say 'I'm in love with chaos' in all caps in general chat",
  "Post your most recent emoji used and explain why 😅",
  "Pretend to be a bot and say ‘System error. Love detected.’",
  "Say ‘Who wants to play 7 Minutes in Heaven?’ in any channel",
  "Type a flirty message using only emojis 👅🔥🍑💦",
  "Voice message a moan and send it in voice chat (or fake it lol)",
];

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === '$help') {
    try {
      await message.channel.send(`📖 **Bot Commands (1/3) — Utility**\n\n` +
        `🏓 \`$ping\` — Check bot response time\n` +
        `📊 \`$stats\` — Server member stats\n` +
        `⏱️ \`$uptime\` — Bot active time\n` +
        `🤖 \`$botinfo\` — Info about the bot\n` +
        `🔗 \`$invite\` — Get bot invite link`);
      await message.channel.send(`📖 **Bot Commands (2/3) — Fun & Games**\n\n` +
        `🪙 \`$flip\` — Flip a coin\n` +
        `🎱 \`$8ball [question]\` — Ask the magic 8-ball\n` +
        `🎲 \`$dice\` — Roll a die\n` +
        `🎯 \`$rate @user\` — Rate someone 0–10\n` +
        `🌈 \`$howgay @user\` — Check how gay someone is\n` +
        `🕵️ \`$sus @user\` — How sus are they?\n` +
        `💬 \`$truth\` — Get a truth question\n` +
        `😈 \`$dare\` — Get a dare\n` +
        `🔥 \`$roast @user\` — Roast someone\n` +
        `💖 \`$compliment @user\` — Compliment someone\n` +
        `👻 \`$haunt\` / \`$unhaunt\` — Spooky haunting messages`);
      await message.channel.send(`📖 **Bot Commands (3/3) — Info & Tools**\n\n` +
        `🧑‍💼 \`$userinfo\` — Show user info\n` +
        `🖼️ \`$avatar @user\` — Show user avatar\n` +
        `🏠 \`$serverinfo\` — Show server info\n\n` +
        `📢 \`$shout [msg]\` — Shout a message\n` +
        `🤐 \`$spoiler [msg]\` — Hide a message\n` +
        `📣 \`$say [msg]\` — Echo your message`);
    } catch (err) {
      console.error('❌ Help command error:', err);
    }
  }

  // Utility Commands
  else if (command === '$ping') {
    const sent = await message.channel.send('Pinging...');
    sent.edit(`🏓 Pong! Latency is ${sent.createdTimestamp - message.createdTimestamp}ms`);
  } else if (command === '$stats') {
    message.channel.send(`📊 Server has ${message.guild.memberCount} members.`);
  } else if (command === '$uptime') {
    const uptime = Math.floor(process.uptime());
    message.channel.send(`⏱️ Bot uptime: ${uptime} seconds.`);
  } else if (command === '$botinfo') {
    message.channel.send(`🤖 I am ${client.user.tag}, your friendly bot helper!`);
  } else if (command === '$invite') {
    message.channel.send('🔗 Invite me to your server: https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands');
  }

  // Fun & Games
  else if (command === '$flip') {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    message.channel.send(`🪙 You flipped **${result}**!`);
  } else if (command === '$8ball') {
    const responses = ['Yes.', 'No.', 'Maybe.', 'Ask again later.', 'Definitely!', 'I don’t think so.'];
    if (!args.length) return message.reply('🎱 Ask me a question.');
    message.channel.send(`🎱 ${responses[Math.floor(Math.random() * responses.length)]}`);
  } else if (command === '$dice') {
    const roll = Math.floor(Math.random() * 6) + 1;
    message.channel.send(`🎲 You rolled a **${roll}**!`);
  } else if (command === '$rate') {
    const user = message.mentions.users.first() || message.author;
    const rating = Math.floor(Math.random() * 11);
    message.channel.send(`🎯 I rate ${user.username} a **${rating}/10**!`);
  } else if (command === '$howgay') {
    const user = message.mentions.users.first() || message.author;
    const gayness = Math.floor(Math.random() * 101);
    message.channel.send(`🌈 ${user.username} is **${gayness}%** gay!`);
  } else if (command === '$sus') {
    const user = message.mentions.users.first() || message.author;
    const sus = Math.floor(Math.random() * 101);
    message.channel.send(`🕵️ ${user.username} is **${sus}%** sus!`);
  } else if (command === '$truth') {
    message.channel.send(`💬 Truth: ${spicyTruths[Math.floor(Math.random() * spicyTruths.length)]}`);
  } else if (command === '$dare') {
    message.channel.send(`😈 Dare: ${spicyDares[Math.floor(Math.random() * spicyDares.length)]}`);
  } else if (command === '$roast') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('🔥 Tag someone to roast.');
    const roasts = ['You bring everyone so much joy… when you leave the room.', 'If I had a face like yours, I’d sue my parents.'];
    message.channel.send(`🔥 ${user.username}, ${roasts[Math.floor(Math.random() * roasts.length)]}`);
  } else if (command === '$compliment') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('💖 Tag someone to compliment.');
    const compliments = ['You have amazing energy!', 'Your smile lights up the room.', 'You’re incredibly smart.'];
    message.channel.send(`💖 ${user.username}, ${compliments[Math.floor(Math.random() * compliments.length)]}`);
  }

  // Info & Tools
  else if (command === '$userinfo') {
    const user = message.mentions.users.first() || message.author;
    message.channel.send(`🧑‍💼 Username: ${user.username}\nID: ${user.id}`);
  } else if (command === '$avatar') {
    const user = message.mentions.users.first() || message.author;
    message.channel.send(`🖼️ Avatar for ${user.username}: ${user.displayAvatarURL({ dynamic: true })}`);
  } else if (command === '$serverinfo') {
    message.channel.send(`🏠 Server: ${message.guild.name}\nMembers: ${message.guild.memberCount}`);
  } else if (command === '$shout') {
    const text = args.join(' ');
    if (!text) return message.reply('📢 What should I shout?');
    message.channel.send(`📢 **${text.toUpperCase()}**`);
  } else if (command === '$spoiler') {
    const text = args.join(' ');
    if (!text) return message.reply('🤐 What should I hide?');
    message.channel.send(`||${text}||`);
  } else if (command === '$say') {
    const text = args.join(' ');
    if (!text) return message.reply('📣 What should I say?');
    message.channel.send(text);
  }

  // Haunt
  else if (command === '$haunt') {
    if (hauntedChannels.has(message.channel.id)) {
      return message.channel.send('👻 Haunting is already active in this channel!');
    }
    hauntedChannels.add(message.channel.id);
    message.channel.send('💀 The haunting has begun...');
    const interval = setInterval(() => {
      if (!hauntedChannels.has(message.channel.id)) return clearInterval(interval);
      message.channel.send(spookyMessages[Math.floor(Math.random() * spookyMessages.length)]);
    }, 30000);
  } else if (command === '$unhaunt') {
    hauntedChannels.delete(message.channel.id);
    message.channel.send('🕯️ The spirits have left this place...');
  }

  // AI Chat via Mention
  else if (message.mentions.has(client.user)) {
    const prompt = message.content.replace(`<@${client.user.id}>`, '').trim();
    if (!prompt) return message.reply('❓ What would you like to ask?');

    try {
      await message.channel.sendTyping();
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openrouter/auto',
          max_tokens: 500,
          messages: [
            { role: 'system', content: 'You are a helpful and fun AI assistant living inside a Discord bot.' },
            { role: 'user', content: prompt }
          ]
        }),
      });

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;

      if (reply) {
        await message.reply(reply);
      } else if (data?.error?.message) {
        await message.reply(`⚠️ AI error: ${data.error.message}`);
      } else {
        await message.reply('⚠️ Sorry, I couldn’t come up with a reply.');
      }
    } catch (err) {
      console.error('❌ AI request failed:', err);
      await message.reply('🚫 There was an error talking to the AI. Try again later.');
    }
  }
});

client.login(process.env.BOT_TOKEN);
