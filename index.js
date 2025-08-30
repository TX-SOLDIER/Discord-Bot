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
  ],
});

// ---- Data ----
const hauntedChannels = new Set();
const hauntIntervals = new Map();
const warningsMap = new Map();

const spookyMessages = [
  '👻 Boo...', '💀 I see you...', '🩸 The shadows are watching...',
  '🔪 Behind you...', '🕷️ Something crawled across your screen...',
];

const spicyTruths = [
  'What is your biggest fear?', 
  'Have you ever lied to your best friend?', 
  'What is your most embarrassing moment?',
];

const spicyDares = [
  'Do 20 push-ups', 
  'Send a funny selfie', 
  'Text your crush “I like you”',
];

const compliments = [
  'You have a great sense of humor!', 
  'Your smile is contagious!', 
  'You are an amazing friend!',
];

// ---- Roleplay Images ----
const hugImages = ['images/hug1.png','images/hug2.png'];
const kissImages = ['images/kiss1.png','images/kiss2.png'];
const slapImages = ['images/slap1.png','images/slap2.png'];
const patImages = ['images/pat1.png','images/pat2.png'];
const shipImages = ['images/ship1.png','images/ship2.png'];

// ---- Blackjack Game ----
const blackjackGames = new Map();

function drawCard() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  return {
    suit: suits[Math.floor(Math.random()*suits.length)],
    value: values[Math.floor(Math.random()*values.length)],
  };
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
// ---- Commands ----
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---- Help (3 messages) ----
  if (command === '$help') {
    const helpText1 = `📖 **Bot Commands — Utility**\n\n` +
      `🏓 \`$ping\` — Check bot response time\n` +
      `📊 \`$stats\` — Server member stats\n` +
      `⏱️ \`$uptime\` — Bot active time\n` +
      `🤖 \`$botinfo\` — Info about the bot\n` +
      `🔗 \`$invite\` — Get bot invite link\n` +
      `🧑‍💼 \`$userinfo\` — User info\n` +
      `🖼️ \`$avatar @user\` — Avatar\n` +
      `🏠 \`$serverinfo\` — Server info\n` +
      `💻 \`$prefix\` — Show bot prefix`;
    message.channel.send(helpText1);

    const helpText2 = `\n📖 **Fun & Games**\n\n` +
      `🪙 \`$flip\` — Flip a coin\n` +
      `🎱 \`$8ball [question]\` — Magic 8-ball\n` +
      `🎲 \`$dice\` — Roll a die\n` +
      `🎯 \`$rate @user\` — Rate someone\n` +
      `🌈 \`$howgay @user\` — Gay meter\n` +
      `🕵️ \`$sus @user\` — Sus meter\n` +
      `💬 \`$truth\` — Truth question\n` +
      `😈 \`$dare\` — Dare\n` +
      `🔥 \`$roast @user\` — Roast\n` +
      `💖 \`$compliment @user\` — Compliment\n` +
      `👻 \`$haunt\` / \`$unhaunt\` — Haunting\n` +
      `🃏 \`$blackjack\`, \`$hit\`, \`$stand\` — Play Blackjack`;
    message.channel.send(helpText2);

    const helpText3 = `\n📖 **Moderation & Tools**\n\n` +
      `📢 \`$shout [msg]\` — Shout\n` +
      `🤐 \`$spoiler [msg]\` — Spoiler\n` +
      `📣 \`$say [msg]\` — Echo\n` +
      `✉️ \`$send <channelID> <msg>\` — Send to another channel\n` +
      `🛡️ \`$kick @user\` — Kick user\n` +
      `⛔ \`$ban @user\` — Ban user\n` +
      `🔒 \`$lock\`, \`$unlock\` — Lock/Unlock channel\n` +
      `⏱️ \`$slowmode <seconds>\` — Set slowmode\n` +
      `🔇 \`$mute @user\`, \`$unmute @user\` — Mute/Unmute\n` +
      `⚠️ \`$warn @user <reason>\` — Warn\n` +
      `📋 \`$warnings @user\` — Check warnings\n` +
      `🎭 \`$role add/remove @user <role>\` — Manage roles\n` +
      `🧡 \`$ship @user1 @user2\` — Ship two users\n` +
      `🤗 \`$hug @user\`, \`$kiss @user\`, \`$slap @user\`, \`$pat @user\` — Roleplay`;
    message.channel.send(helpText3);
  }

  // ---- Utility ----
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
    message.channel.send('🔗 Invite me: https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands');
  } else if (command === '$prefix') {
    message.channel.send(`📌 My prefix is \`$\``);
  }

  // ---- Fun & Games ----
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
             }
  // ---- Truth, Dare, Roast, Compliment ----
  else if (command === '$truth') {
    message.channel.send(`💬 Truth: ${spicyTruths[Math.floor(Math.random() * spicyTruths.length)]}`);
  } else if (command === '$dare') {
    message.channel.send(`😈 Dare: ${spicyDares[Math.floor(Math.random() * spicyDares.length)]}`);
  } else if (command === '$roast') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('🔥 Tag someone to roast.');
    const roasts = [
      'You bring everyone so much joy… when you leave the room.',
      'If I had a face like yours, I’d sue my parents.',
      'You’re as useless as the “ueue” in “queue.”',
      'You have something on your chin... no, the third one down.',
    ];
    message.channel.send(`🔥 ${user.username}, ${roasts[Math.floor(Math.random() * roasts.length)]}`);
  } else if (command === '$compliment') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('💖 Tag someone to compliment.');
    message.channel.send(`💖 ${user.username}, ${compliments[Math.floor(Math.random() * compliments.length)]}`);
  }

  // ---- Roleplay ----
  else if (['$hug','$kiss','$slap','$pat'].includes(command)) {
    const user = message.mentions.users.first();
    if (!user) return message.reply(`🤗 Tag someone to ${command.slice(1)}.`);
    let imageArray = hugImages;
    if (command === '$kiss') imageArray = kissImages;
    if (command === '$slap') imageArray = slapImages;
    if (command === '$pat') imageArray = patImages;
    const image = imageArray[Math.floor(Math.random() * imageArray.length)];
    message.channel.send({ content: `${message.author} ${command.slice(1)}s ${user}!`, files: [image] });
  } else if (command === '$ship') {
    const mentions = message.mentions.users.first(2);
    if (!mentions || mentions.length < 2) return message.reply('💞 Please mention two users to ship.');
    const [user1, user2] = mentions;
    const love = Math.floor(Math.random() * 101);
    const image = shipImages[Math.floor(Math.random() * shipImages.length)];
    message.channel.send({ content: `💞 ${user1.username} ❤️ ${user2.username} — ${love}% compatible!`, files: [image] });
  }

  // ---- Moderation ----
  else if (command === '$kick') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to kick.');
    if (!member.kickable) return message.reply('❌ I cannot kick this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    member.kick(reason)
      .then(() => message.channel.send(`✅ Kicked ${member.user.tag} | Reason: ${reason}`))
      .catch(err => message.reply(`❌ Failed to kick: ${err}`));
  } else if (command === '$ban') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to ban.');
    if (!member.bannable) return message.reply('❌ I cannot ban this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    member.ban({ reason })
      .then(() => message.channel.send(`✅ Banned ${member.user.tag} | Reason: ${reason}`))
      .catch(err => message.reply(`❌ Failed to ban: ${err}`));
  } else if (command === '$clear') {
    const deleteCount = parseInt(args[0]);
    if (!deleteCount || deleteCount < 1 || deleteCount > 100)
      return message.reply('⚠️ Provide a number between 1 and 100.');
    message.channel.bulkDelete(deleteCount, true)
      .then(deleted => message.channel.send(`🗑️ Deleted ${deleted.size} messages.`))
      .catch(err => message.reply('❌ Cannot delete messages older than 14 days.'));
  } else if (command === '$lock') {
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
    message.channel.send('🔒 Channel locked.');
  } else if (command === '$unlock') {
    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true });
    message.channel.send('🔓 Channel unlocked.');
  } else if (command === '$slowmode') {
    const seconds = parseInt(args[0]);
    if (isNaN(seconds)) return message.reply('⚠️ Provide seconds for slowmode.');
    message.channel.setRateLimitPerUser(seconds, `Set by ${message.author.tag}`)
      .then(() => message.channel.send(`⏱️ Slowmode set to ${seconds} seconds.`))
      .catch(err => message.reply('❌ Failed to set slowmode.'));
  } else if (command === '$mute') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Mention a user to mute.');
    const muteRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole) return message.reply('❌ No "Muted" role found.');
    member.roles.add(muteRole).then(() => message.channel.send(`🔇 ${member.user.tag} has been muted.`));
  } else if (command === '$unmute') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Mention a user to unmute.');
    const muteRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole) return message.reply('❌ No "Muted" role found.');
    member.roles.remove(muteRole).then(() => message.channel.send(`🔊 ${member.user.tag} has been unmuted.`));
  } else if (command === '$warn') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Mention a user to warn.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    const userWarnings = warningsMap.get(member.id) || [];
    userWarnings.push(reason);
    warningsMap.set(member.id, userWarnings);
    message.channel.send(`⚠️ ${member.user.tag} has been warned. Total warnings: ${userWarnings.length}`);
  } else if (command === '$warnings') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Mention a user to check warnings.');
    const userWarnings = warningsMap.get(member.id) || [];
    if (userWarnings.length === 0) message.channel.send(`${member.user.tag} has no warnings.`);
    else message.channel.send(`${member.user.tag} warnings:\n- ${userWarnings.join('\n- ')}`);
  } else if (command === '$role') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Mention a user.');
    const subCommand = args[0];
    const roleName = args.slice(1).join(' ');
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (!role) return message.reply('❌ Role not found.');
    if (subCommand === 'add') {
      member.roles.add(role).then(() => message.channel.send(`✅ Added role ${role.name} to ${member.user.tag}`));
    } else if (subCommand === 'remove') {
      member.roles.remove(role).then(() => message.channel.send(`✅ Removed role ${role.name} from ${member.user.tag}`));
    } else {
      message.reply('⚠️ Use `add` or `remove`.');
    }
  }

  // ---- Send to another server/channel ----
  else if (command === '$send') {
    const channelId = args.shift();
    if (!channelId) return message.reply('⚠️ Provide the channel ID.');
    const text = args.join(' ');
    if (!text) return message.reply('⚠️ Provide a message to send.');
    const channel = client.channels.cache.get(channelId);
    if (!channel || channel.type !== 0) return message.reply('⚠️ Channel not found or not text-based.');
    channel.send(text).then(() => message.reply(`✅ Message sent to <#${channelId}>`))
      .catch(err => message.reply('❌ Failed to send message. Check bot permissions.'));
  }

  // ---- Haunt & AI Chat handled in Part 1 & 2 ----
});

client.login(process.env.BOT_TOKEN);
