require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');
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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
});

// ---- Data ----
const hauntedChannels = new Set();
const hauntIntervals = new Map();

const spookyMessages = [
  '👻 Boo...', '💀 I see you...', '🩸 The shadows are watching...',
  '🔪 Behind you...', '🕷️ Something crawled across your screen...',
];

const spicyTruths = [
  'What is your deepest secret?',
  'Have you ever lied to your best friend?',
  'What is your biggest fear?',
  'Who was your first crush?',
  'What is a guilty pleasure you have?',
  'Have you ever cheated on a test?',
  'What is the most embarrassing thing that happened to you?',
];

const spicyDares = [
  'Do 10 push-ups right now.',
  'Sing the chorus of your favorite song.',
  'Send a funny selfie in the chat.',
  'Text your crush something random.',
  'Eat something weird right now.',
  'Post an embarrassing photo of yourself.',
  'Dance for 30 seconds on camera.',
];

const compliments = [
  'You have an amazing sense of humor!',
  'You are incredibly talented!',
  'Your positivity is contagious.',
  'You have a heart of gold!',
  'You light up the room!',
  'You are a true friend.',
  'Your creativity is inspiring.',
];

// Roleplay Images (offline URLs)
const hugImages = ['./images/hug1.png','./images/hug2.png','./images/hug3.png'];
const kissImages = ['./images/kiss1.png','./images/kiss2.png','./images/kiss3.png'];
const slapImages = ['./images/slap1.png','./images/slap2.png','./images/slap3.png'];
const patImages = ['./images/pat1.png','./images/pat2.png','./images/pat3.png'];
const shipImages = ['./images/ship1.png','./images/ship2.png','./images/ship3.png'];

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

// ---- Ready ----
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
// ---- Commands ----
client.on('messageCreate', async (message) => {
  if(message.author.bot) return;
  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---- Help ----
  if(command === '$help'){
    const help1 = `📖 **Bot Commands — Utility**\n\n` +
      `🏓 \`$ping\` — Check bot response time\n` +
      `📊 \`$stats\` — Server member stats\n` +
      `⏱️ \`$uptime\` — Bot active time\n` +
      `🤖 \`$botinfo\` — Info about the bot\n` +
      `🔗 \`$invite\` — Get bot invite link\n` +
      `💠 \`$prefix\` — Show bot prefix\n\n` +
      `📖 **Fun & Games**\n\n` +
      `🪙 \`$flip\` — Flip a coin\n` +
      `🎱 \`$8ball [question]\` — Magic 8-ball\n` +
      `🎲 \`$dice\` — Roll a die\n` +
      `🎯 \`$rate @user\` — Rate someone\n` +
      `🌈 \`$howgay @user\` — Gay meter\n` +
      `🕵️ \`$sus @user\` — Sus meter`;

    const help2 = `💬 \`$truth\` — Truth question\n` +
      `😈 \`$dare\` — Dare\n` +
      `🔥 \`$roast @user\` — Roast\n` +
      `💖 \`$compliment @user\` — Compliment\n` +
      `👻 \`$haunt\` / \`$unhaunt\` — Haunting\n` +
      `🃏 \`$blackjack\`, \`$hit\`, \`$stand\` — Play Blackjack\n\n` +
      `🤗 Roleplay & Fun Images\n` +
      `🤗 \`$hug @user\`, \`$kiss @user\`, \`$slap @user\`, \`$pat @user\`\n` +
      `💞 \`$ship @user1 @user2\` — Ship users`;

    const help3 = `📖 **Info & Tools**\n\n` +
      `🧑‍💼 \`$userinfo\` — User info\n` +
      `🖼️ \`$avatar @user\` — Avatar\n` +
      `🏠 \`$serverinfo\` — Server info\n` +
      `📢 \`$shout [msg]\` — Shout\n` +
      `🤐 \`$spoiler [msg]\` — Spoiler\n` +
      `📣 \`$say [msg]\` — Echo\n\n` +
      `⚙️ Moderation commands are available too!`;

    await message.channel.send(help1);
    await message.channel.send(help2);
    await message.channel.send(help3);
  }

  // ---- Utility ----
  else if(command === '$ping'){
    const sent = await message.channel.send('Pinging...');
    sent.edit(`🏓 Pong! Latency is ${sent.createdTimestamp - message.createdTimestamp}ms`);
  } else if(command === '$stats'){
    message.channel.send(`📊 Server has ${message.guild.memberCount} members.`);
  } else if(command === '$uptime'){
    const uptime = Math.floor(process.uptime());
    message.channel.send(`⏱️ Bot uptime: ${uptime} seconds.`);
  } else if(command === '$botinfo'){
    message.channel.send(`🤖 I am ${client.user.tag}, your friendly bot helper!`);
  } else if(command === '$invite'){
    message.channel.send('🔗 Invite me: https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands');
  } else if(command === '$prefix'){
    message.channel.send('ℹ️ Current prefix: `$`');

  // ---- Fun & Games ----
  } else if(command === '$flip'){
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    message.channel.send(`🪙 You flipped **${result}**!`);
  } else if(command === '$8ball'){
    const responses = ['Yes.','No.','Maybe.','Ask again later.','Definitely!','I don’t think so.'];
    if(!args.length) return message.reply('🎱 Ask me a question.');
    message.channel.send(`🎱 ${responses[Math.floor(Math.random()*responses.length)]}`);
  } else if(command === '$dice'){
    const roll = Math.floor(Math.random()*6)+1;
    message.channel.send(`🎲 You rolled a **${roll}**!`);
  } else if(command === '$rate'){
    const user = message.mentions.users.first() || message.author;
    const rating = Math.floor(Math.random()*11);
    message.channel.send(`🎯 I rate ${user.username} a **${rating}/10**!`);
  } else if(command === '$howgay'){
    const user = message.mentions.users.first() || message.author;
    const gayness = Math.floor(Math.random()*101);
    message.channel.send(`🌈 ${user.username} is **${gayness}%** gay!`);
  } else if(command === '$sus'){
    const user = message.mentions.users.first() || message.author;
    const sus = Math.floor(Math.random()*101);
    message.channel.send(`🕵️ ${user.username} is **${sus}%** sus!`);
  } else if(command === '$truth'){
    message.channel.send(`💬 Truth: ${spicyTruths[Math.floor(Math.random()*spicyTruths.length)]}`);
  } else if(command === '$dare'){
    message.channel.send(`😈 Dare: ${spicyDares[Math.floor(Math.random()*spicyDares.length)]}`);
  } else if(command === '$roast'){
    const user = message.mentions.users.first();
    if(!user) return message.reply('🔥 Tag someone to roast.');
    const roasts = [
      'You bring everyone so much joy… when you leave the room.',
      'If I had a face like yours, I’d sue my parents.',
      'You’re as useless as the “ueue” in “queue.”',
      'You have something on your chin... no, the third one down.',
    ];
    message.channel.send(`🔥 ${user.username}, ${roasts[Math.floor(Math.random()*roasts.length)]}`);
  } else if(command === '$compliment'){
    const user = message.mentions.users.first();
    if(!user) return message.reply('💖 Tag someone to compliment.');
    message.channel.send(`💖 ${user.username}, ${compliments[Math.floor(Math.random()*compliments.length)]}`);
    // ---- Kick & Ban ----
  else if(command === '$kick'){
    const member = message.mentions.members.first();
    if(!member) return message.reply('⚠️ Please mention a user to kick.');
    if(!member.kickable) return message.reply('❌ I cannot kick this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    member.kick(reason)
      .then(() => message.channel.send(`✅ Kicked ${member.user.tag} | Reason: ${reason}`))
      .catch(err => message.reply(`❌ Failed to kick: ${err}`));
  } else if(command === '$ban'){
    const member = message.mentions.members.first();
    if(!member) return message.reply('⚠️ Please mention a user to ban.');
    if(!member.bannable) return message.reply('❌ I cannot ban this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    member.ban({ reason })
      .then(() => message.channel.send(`✅ Banned ${member.user.tag} | Reason: ${reason}`))
      .catch(err => message.reply(`❌ Failed to ban: ${err}`));
  }

  // ---- Mute / Unmute ----
  else if(command === '$mute'){
    const member = message.mentions.members.first();
    if(!member) return message.reply('⚠️ Mention a user to mute.');
    const muteRole = message.guild.roles.cache.find(r => r.name === 'Muted');
    if(!muteRole) return message.reply('❌ No role named "Muted" exists.');
    member.roles.add(muteRole).then(() => message.channel.send(`🔇 ${member.user.tag} has been muted.`));
  } else if(command === '$unmute'){
    const member = message.mentions.members.first();
    if(!member) return message.reply('⚠️ Mention a user to unmute.');
    const muteRole = message.guild.roles.cache.find(r => r.name === 'Muted');
    if(!muteRole) return message.reply('❌ No role named "Muted" exists.');
    member.roles.remove(muteRole).then(() => message.channel.send(`🔊 ${member.user.tag} has been unmuted.`));
  }

  // ---- Lock / Unlock / Slowmode ----
  else if(command === '$lock'){
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false })
      .then(() => message.channel.send('🔒 Channel locked.'))
      .catch(err => message.reply('❌ Failed to lock channel.'));
  } else if(command === '$unlock'){
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true })
      .then(() => message.channel.send('🔓 Channel unlocked.'))
      .catch(err => message.reply('❌ Failed to unlock channel.'));
  } else if(command === '$slowmode'){
    const seconds = parseInt(args[0]);
    if(isNaN(seconds)) return message.reply('⏱️ Enter the slowmode time in seconds.');
    message.channel.setRateLimitPerUser(seconds)
      .then(() => message.channel.send(`⏱️ Slowmode set to ${seconds} seconds.`))
      .catch(err => message.reply('❌ Failed to set slowmode.'));
  }

  // ---- Warn / Warnings ----
  else if(command === '$warn'){
    const member = message.mentions.members.first();
    if(!member) return message.reply('⚠️ Mention a user to warn.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if(!member.warnings) member.warnings = [];
    member.warnings.push(reason);
    message.channel.send(`⚠️ ${member.user.tag} has been warned. Reason: ${reason}`);
  } else if(command === '$warnings'){
    const member = message.mentions.members.first();
    if(!member) return message.reply('⚠️ Mention a user to see warnings.');
    const warns = member.warnings || [];
    message.channel.send(`⚠️ ${member.user.tag} has ${warns.length} warnings:\n${warns.join('\n') || 'None'}`);
  }

  // ---- Clear Messages ----
  else if(command === '$clear'){
    const count = parseInt(args[0]);
    if(isNaN(count)) return message.reply('⚠️ Enter the number of messages to delete.');
    message.channel.bulkDelete(count, true)
      .then(deleted => message.channel.send(`🗑️ Deleted ${deleted.size} messages.`))
      .catch(err => message.reply('❌ Failed to delete messages.'));

  // ---- Role Add / Remove ----
  } else if(command === '$roleadd'){
    const member = message.mentions.members.first();
    const role = message.guild.roles.cache.find(r => r.name === args.slice(1).join(' '));
    if(!member || !role) return message.reply('⚠️ Mention a user and a valid role name.');
    member.roles.add(role).then(() => message.channel.send(`✅ Added role ${role.name} to ${member.user.tag}.`));
  } else if(command === '$roleremove'){
    const member = message.mentions.members.first();
    const role = message.guild.roles.cache.find(r => r.name === args.slice(1).join(' '));
    if(!member || !role) return message.reply('⚠️ Mention a user and a valid role name.');
    member.roles.remove(role).then(() => message.channel.send(`✅ Removed role ${role.name} from ${member.user.tag}.`));
  }

  // ---- AI Chat ----
  else if(message.mentions.has(client.user)){
    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    if(!prompt) return message.reply('❓ What would you like to ask?');

    try{
      await message.channel.sendTyping();
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions',{
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model:'openrouter/auto',
          max_tokens:100,
          messages:[
            {role:'system', content:'You are a helpful and fun AI assistant living inside a Discord bot.'},
            {role:'user', content:prompt}
          ]
        })
      });

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;
      if(reply) await message.reply(reply);
      else if(data?.error?.message) await message.reply(`⚠️ AI error: ${data.error.message}`);
      else await message.reply('⚠️ Sorry, I couldn’t come up with a reply.');
    } catch(err){
      console.error('❌ AI request failed:', err);
      await message.reply('🚫 Error talking to the AI. Try again later.');
    }
  }
});

client.login(process.env.BOT_TOKEN);
