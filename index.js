require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('✅ Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

const PREFIX = '$';

client.on('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // ✅ HELP Command (Split into 3 parts so Discord won’t cut it off)
        if (command === 'help') {
            const helpPart1 = `
📜 **Bot Commands (1/3)**

😀 **Fun Commands**
- 🎃 \`$haunt @user\` → Haunt someone
- 🎤 \`$say <message>\` → Make the bot say something
- 📢 \`$shout <message>\` → Shout in caps
- 🙊 \`$spoiler <message>\` → Spoiler text
- ❤️ \`$ship @user1 @user2\` → Ship two users
- 🎲 \`$blackjack\` → Play Blackjack
- 👻 \`$truth\` → Get a truth question
- 😈 \`$dare\` → Get a dare
- 💬 \`$compliment @user\` → Compliment someone
- 🔥 \`$roast @user\` → Roast someone
`;
            const helpPart2 = `
🛠️ **Utility Commands (2/3)**
- 🖼️ \`$avatar @user\` → Show user avatar
- 👤 \`$userinfo @user\` → Show info about a user
- 🏠 \`$serverinfo\` → Show server info
- ⏱️ \`$ping\` → Check bot latency
- ⚙️ \`$prefix <newPrefix>\` → Change bot prefix
`;
            const helpPart3 = `
🔨 **Moderator Commands (3/3)**
- 👢 \`$kick @user\` → Kick a user
- 🔨 \`$ban @user\` → Ban a user
- 🧹 \`$clear <number>\` → Delete messages

🤖 **AI Chat**
- Tag the bot \`@${client.user.username}\` to chat with AI
`;

            await message.channel.send(helpPart1);
            await message.channel.send(helpPart2);
            await message.channel.send(helpPart3);
        }

        // ✅ SAY Command
        else if (command === 'say') {
            const text = args.join(' ');
            if (!text) return message.reply('❌ Please provide a message.');
            message.channel.send(text);
        }

        // ✅ SHOUT Command
        else if (command === 'shout') {
            const text = args.join(' ');
            if (!text) return message.reply('❌ Please provide a message.');
            message.channel.send(text.toUpperCase());
        }

        // ✅ SPOILER Command
        else if (command === 'spoiler') {
            const text = args.join(' ');
            if (!text) return message.reply('❌ Please provide a message.');
            message.channel.send(`||${text}||`);
        }

        // ✅ HAUNT Command
        else if (command === 'haunt') {
            const user = message.mentions.users.first();
            if (!user) return message.reply('❌ Mention someone to haunt!');
            message.channel.send(`👻 ${message.author} is haunting ${user}!`);
        }
      // ✅ AVATAR Command
        else if (command === 'avatar') {
            const user = message.mentions.users.first() || message.author;
            message.channel.send(`${user.username}'s avatar: ${user.displayAvatarURL({ dynamic: true, size: 512 })}`);
        }

        // ✅ USERINFO Command
        else if (command === 'userinfo') {
            const user = message.mentions.users.first() || message.author;
            const member = await message.guild.members.fetch(user.id);
            const roles = member.roles.cache.map(r => r.name).join(', ') || 'No roles';
            message.channel.send(
                `**User Info for ${user.tag}**\n` +
                `🆔 ID: ${user.id}\n` +
                `📅 Joined: ${member.joinedAt}\n` +
                `👤 Created: ${user.createdAt}\n` +
                `🎭 Roles: ${roles}`
            );
        }

        // ✅ SERVERINFO Command
        else if (command === 'serverinfo') {
            message.channel.send(
                `**Server Info**\n` +
                `🏠 Name: ${message.guild.name}\n` +
                `👑 Owner: <@${message.guild.ownerId}>\n` +
                `👥 Members: ${message.guild.memberCount}\n` +
                `📅 Created: ${message.guild.createdAt}`
            );
        }

        // ✅ PING Command
        else if (command === 'ping') {
            message.channel.send(`🏓 Pong! Latency is ${Date.now() - message.createdTimestamp}ms.`);
        }

        // ✅ PREFIX Command
        else if (command === 'prefix') {
            const newPrefix = args[0];
            if (!newPrefix) return message.reply('❌ Please provide a new prefix.');
            PREFIX = newPrefix;
            message.channel.send(`✅ Prefix updated to \`${PREFIX}\``);
        }

        // ✅ SHIP Command
        else if (command === 'ship') {
            if (args.length < 2 || message.mentions.users.size < 2) {
                return message.reply('❌ Please mention two users to ship!');
            }
            const users = message.mentions.users.map(u => u.username);
            const lovePercent = Math.floor(Math.random() * 100) + 1;
            let heart = "💔";
            if (lovePercent > 70) heart = "❤️";
            else if (lovePercent > 40) heart = "💖";

            message.channel.send(
                `💘 Shipping **${users[0]}** and **${users[1]}**...\n` +
                `💟 Compatibility: **${lovePercent}%** ${heart}`
            );
        }

        // ✅ COMPLIMENT Command
        else if (command === 'compliment') {
            const user = message.mentions.users.first();
            if (!user) return message.reply('❌ Mention someone to compliment!');
            const compliments = [
                "You're amazing! 🌟",
                "You light up the room! ✨",
                "You're a true legend! 👑",
                "You're unstoppable! 🚀"
            ];
            const random = compliments[Math.floor(Math.random() * compliments.length)];
            message.channel.send(`${user}, ${random}`);
        }

        // ✅ ROAST Command
        else if (command === 'roast') {
            const user = message.mentions.users.first();
            if (!user) return message.reply('❌ Mention someone to roast!');
            const roasts = [
                "You're proof that even evolution takes breaks. 😂",
                "You're like a cloud. When you disappear, it’s a beautiful day. 🌤️",
                "You bring everyone so much joy… when you leave the room. 🚪",
                "If I had a dollar for every brain cell you had, I’d be broke. 💸"
            ];
            const random = roasts[Math.floor(Math.random() * roasts.length)];
            message.channel.send(`${user}, ${random}`);
        }
      // ✅ BLACKJACK Command (simplified)
        else if (command === 'blackjack') {
            const cards = ['A♠', '2♦', '3♣', '4♥', '5♠', '6♦', '7♣', '8♥', '9♠', '10♦', 'J♣', 'Q♥', 'K♠'];
            const getCard = () => cards[Math.floor(Math.random() * cards.length)];
            const playerCards = [getCard(), getCard()];
            const dealerCards = [getCard(), getCard()];
            message.channel.send(
                `🃏 **Blackjack Game**\n` +
                `You: ${playerCards.join(', ')}\n` +
                `Dealer: ${dealerCards.join(', ')}`
            );
        }

        // ✅ TRUTH Command
        else if (command === 'truth') {
            const truths = [
                "What’s your biggest fear? 😱",
                "What’s a secret you’ve never told anyone? 🤫",
                "Who was your first crush? 💘",
                "What’s the most embarrassing thing you’ve done? 🙈"
            ];
            const random = truths[Math.floor(Math.random() * truths.length)];
            message.channel.send(random);
        }

        // ✅ DARE Command
        else if (command === 'dare') {
            const dares = [
                "Send a message using only emojis! 🤯",
                "Say something nice about the person above you 💕",
                "Change your nickname for 10 minutes 🤡",
                "Do 10 pushups and report back 💪"
            ];
            const random = dares[Math.floor(Math.random() * dares.length)];
            message.channel.send(random);
        }

        // ✅ CLEAR Command
        else if (command === 'clear') {
            if (!message.member.permissions.has('ManageMessages')) {
                return message.reply("❌ You don't have permission to clear messages.");
            }
            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount < 1 || amount > 100) {
                return message.reply('❌ Please provide a number between 1 and 100.');
            }
            await message.channel.bulkDelete(amount, true);
            message.channel.send(`✅ Cleared ${amount} messages.`).then(msg => {
                setTimeout(() => msg.delete(), 3000);
            });
        }

        // ✅ KICK Command
        else if (command === 'kick') {
            if (!message.member.permissions.has('KickMembers')) {
                return message.reply("❌ You don't have permission to kick.");
            }
            const member = message.mentions.members.first();
            if (!member) return message.reply('❌ Mention a user to kick.');
            await member.kick();
            message.channel.send(`👢 ${member.user.tag} was kicked.`);
        }

        // ✅ BAN Command
        else if (command === 'ban') {
            if (!message.member.permissions.has('BanMembers')) {
                return message.reply("❌ You don't have permission to ban.");
            }
            const member = message.mentions.members.first();
            if (!member) return message.reply('❌ Mention a user to ban.');
            await member.ban();
            message.channel.send(`🔨 ${member.user.tag} was banned.`);
        }

        // ✅ AI CHAT (when bot is tagged)
        else if (message.mentions.has(client.user) && !message.author.bot) {
            const prompt = message.content.replace(/<@!?(\d+)>/, '').trim();
            if (!prompt) return message.reply("👋 Hi! Mention me with a question or message.");

            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model: "openai/gpt-4.1-mini",
                        messages: [{ role: "user", content: prompt }],
                    }),
                });
                const data = await response.json();
                const reply = data.choices?.[0]?.message?.content || "⚠️ No response from AI.";
                message.reply(reply);
            } catch (err) {
                console.error(err);
                message.reply("⚠️ Error contacting AI service.");
            }
        }
    }
});

// ✅ Keep bot alive
app.listen(PORT, () => {
    console.log(`🌐 Express server running on port ${PORT}`);
});

client.login(process.env.TOKEN);
