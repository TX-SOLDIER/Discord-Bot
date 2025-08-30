require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('✅ Bot is running!'));

// Properly bind to Render's port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Keep-alive server running on port ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ---- Data ----
const hauntedChannels = new Set();
const hauntIntervals = new Map();
const blackjackGames = new Map();
const warnings = {};

const spookyMessages = [
  '👻 Boo...', '💀 I see you...', '🩸 The shadows are watching...',
  '🔪 Behind you...', '🕷️ Something crawled across your screen...',
];

const spicyTruths = [
  "What's your biggest fear?", "Have you ever lied to your best friend?", 
  "What's your secret talent?", "Who do you have a crush on?", 
  "What's the most embarrassing thing you've done?"
];

const spicyDares = [
  "Do 20 pushups.", "Sing a song loudly.", "Dance like a chicken for 30 seconds.", 
  "Prank call a friend.", "Post a funny selfie in the chat."
];

const compliments = [
  "You're amazing just the way you are!", "Your smile lights up the room!", 
  "You're a true friend.", "You have a great sense of humor.", 
  "You inspire people around you!"
];

const roleplayGifs = {
  hug: ['offline_url/hug1.gif', 'offline_url/hug2.gif'],
  kiss: ['offline_url/kiss1.gif', 'offline_url/kiss2.gif'],
  slap: ['offline_url/slap1.gif', 'offline_url/slap2.gif'],
  pat: ['offline_url/pat1.gif', 'offline_url/pat2.gif'],
  poke: ['offline_url/poke1.gif', 'offline_url/poke2.gif'],
  cuddle: ['offline_url/cuddle1.gif', 'offline_url/cuddle2.gif'],
};

function drawCard() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  return { suit: suits[Math.floor(Math.random()*suits.length)], value: values[Math.floor(Math.random()*values.length)] };
}

function cardValue(card) {
  if (['J','Q','K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return parseInt(card.value);
}

function handValue(hand) {
  let total = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = hand.filter(c => c.value === 'A').length;
  while(total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function formatHand(hand) { return hand.map(c => `${c.value}${c.suit}`).join(' '); }

// ---- Ready ----
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---- HELP ----
  if (command === '$help') {
    const helpText = `📖 **Bot Commands — Utility**\n\n` +
      `🏓 \`$ping\` — Check bot response time\n` +
      `📊 \`$stats\` — Server member stats\n` +
      `⏱️ \`$uptime\` — Bot active time\n` +
      `🤖 \`$botinfo\` — Info about the bot\n` +
      `🔗 \`$invite\` — Get bot invite link\n\n` +
      `📖 **Fun & Games**\n\n` +
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
      `💌 Roleplay: \`$hug\`, \`$kiss\`, \`$slap\`, \`$pat\`, \`$poke\`, \`$cuddle\`\n` +
      `💘 \`$ship @user1 @user2\` — Ship two users\n` +
      `👻 \`$haunt\` / \`$unhaunt\` — Haunting\n` +
      `🃏 \`$blackjack\`, \`$hit\`, \`$stand\` — Play Blackjack\n\n` +
      `📖 **Info & Tools**\n\n` +
      `🧑‍💼 \`$userinfo\` — User info\n` +
      `🖼️ \`$avatar @user\` — Avatar\n` +
      `🏠 \`$serverinfo\` — Server info\n` +
      `🏢 \`$servericon\` — Server icon\n` +
      `🏞️ \`$serverbanner\` — Server banner\n` +
      `🚀 \`$boosters\` — Server boosters\n` +
      `🎨 \`$emojis\` — List emojis\n` +
      `📢 \`$shout [msg]\` — Shout\n` +
      `🤐 \`$spoiler [msg]\` — Spoiler\n` +
      `📣 \`$say [msg]\` — Echo\n` +
      `✉️ \`$send <channelID> <message>\` — Send to another server/channel\n\n` +
      `🛠️ **Moderation**\n\n` +
      `⚡ \`$kick\`, \`$ban\`, \`$mute\`, \`$unmute\`, \`$warn\`, \`$warnings\`\n` +
      `🧹 \`$clear <number>\` — Delete messages\n` +
      `🔒 \`$lock\`, \`$unlock\` — Channel lock/unlock\n` +
      `🐢 \`$slowmode <seconds>\` — Set slowmode\n` +
      `➕ \`$roleadd @user <role>\` — Add role\n` +
      `➖ \`$roleremove @user <role>\` — Remove role`;

    return message.channel.send(helpText);
  }

  // ---- PING / STATS / UPTIME ----
  if (command === '$ping') {
    const sent = await message.channel.send('Pinging...');
    return sent.edit(`🏓 Pong! Latency is ${sent.createdTimestamp - message.createdTimestamp}ms`);
  }

  if (command === '$stats') return message.channel.send(`📊 Server has ${message.guild.memberCount} members.`);
  if (command === '$uptime') return message.channel.send(`⏱️ Bot uptime: ${Math.floor(process.uptime())} seconds.`);
  if (command === '$botinfo') return message.channel.send(`🤖 I am ${client.user.tag}, your friendly bot helper!`);
  if (command === '$invite') return message.channel.send('🔗 Invite me: https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands');

  // ---- FUN ----
  if (command === '$flip') return message.channel.send(`🪙 You flipped **${Math.random()<0.5?'Heads':'Tails'}**!`);
  if (command === '$8ball') {
    if (!args.length) return message.reply('🎱 Ask me a question.');
    const responses = ['Yes.', 'No.', 'Maybe.', 'Ask again later.', 'Definitely!', 'I don’t think so.'];
    return message.channel.send(`🎱 ${responses[Math.floor(Math.random()*responses.length)]}`);
  }
  if (command === '$dice') return message.channel.send(`🎲 You rolled a **${Math.floor(Math.random()*6)+1}**!`);
  if (command === '$rate') {
    const user = message.mentions.users.first() || message.author;
    return message.channel.send(`🎯 I rate ${user.username} a **${Math.floor(Math.random()*11)}/10**!`);
  }
  if (command === '$howgay') {
    const user = message.mentions.users.first() || message.author;
    return message.channel.send(`🌈 ${user.username} is **${Math.floor(Math.random()*101)}%** gay!`);
  }
  if (command === '$sus') {
    const user = message.mentions.users.first() || message.author;
    return message.channel.send(`🕵️ ${user.username} is **${Math.floor(Math.random()*101)}%** sus!`);
  }
  if (command === '$truth') return message.channel.send(`💬 Truth: ${spicyTruths[Math.floor(Math.random()*spicyTruths.length)]}`);
  if (command === '$dare') return message.channel.send(`😈 Dare: ${spicyDares[Math.floor(Math.random()*spicyDares.length)]}`);
  if (command === '$compliment') {
    const user = message.mentions.users.first();
    if (!user) return message.reply('💖 Tag someone to compliment.');
    return message.channel.send(`💖 ${user.username}, ${compliments[Math.floor(Math.random()*compliments.length)]}`);
  }

  // ---- ROLEPLAY ----
  const roleplayCommands = ['hug','kiss','slap','pat','poke','cuddle'];
  if (roleplayCommands.includes(command)) {
    const user = message.mentions.users.first();
    if (!user) return message.reply(`Tag someone to ${command}.`);
    const gifs = roleplayGifs[command];
    const gif = gifs[Math.floor(Math.random()*gifs.length)];
    return message.channel.send({ content: `${message.author} ${command}s ${user}`, files: [gif] });
  }

  // ---- SHIP ----
  if (command === '$ship') {
    const user1 = message.mentions.users.first();
    const user2 = message.mentions.users.last();
    if (!user1 || !user2) return message.reply("Tag two users to ship.");
    const love = Math.floor(Math.random()*101);
    return message.channel.send(`💘 ${user1.username} + ${user2.username} = **${love}%** compatible!`);
  }

  // ---- HAUNT ----
  if (command === '$haunt') {
    if (hauntedChannels.has(message.channel.id)) return message.channel.send('👻 Already haunting this channel!');
    hauntedChannels.add(message.channel.id);
    message.channel.send('💀 The haunting has begun...');
    const interval = setInterval(() => {
      if (!hauntedChannels.has(message.channel.id)) return clearInterval(interval);
      message.channel.send(spookyMessages[Math.floor(Math.random()*spookyMessages.length)]);
    }, 30000);
    hauntIntervals.set(message.channel.id, interval);
  }

  if (command === '$unhaunt') {
    hauntedChannels.delete(message.channel.id);
    if (hauntIntervals.has(message.channel.id)) {
      clearInterval(hauntIntervals.get(message.channel.id));
      hauntIntervals.delete(message.channel.id);
    }
    message.channel.send('🕯️ The spirits have left...');
      }
  // ---- MODERATION ----
  if (command === '$kick') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to kick.');
    if (!member.kickable) return message.reply('❌ I cannot kick this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    return member.kick(reason).then(() => message.channel.send(`✅ Kicked ${member.user.tag} | Reason: ${reason}`))
      .catch(err => message.reply(`❌ Failed to kick: ${err}`));
  }

  if (command === '$ban') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to ban.');
    if (!member.bannable) return message.reply('❌ I cannot ban this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    return member.ban({ reason }).then(() => message.channel.send(`✅ Banned ${member.user.tag} | Reason: ${reason}`))
      .catch(err => message.reply(`❌ Failed to ban: ${err}`));
  }

  if (command === '$mute') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Mention someone to mute.');
    const muteRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole) return message.reply('⚠️ No "Muted" role found.');
    member.roles.add(muteRole).then(() => message.channel.send(`🔇 ${member.user.tag} has been muted.`));
  }

  if (command === '$unmute') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Mention someone to unmute.');
    const muteRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole) return message.reply('⚠️ No "Muted" role found.');
    member.roles.remove(muteRole).then(() => message.channel.send(`🔊 ${member.user.tag} has been unmuted.`));
  }

  if (command === '$warn') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Mention someone to warn.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    warnings[member.id] = warnings[member.id] ? [...warnings[member.id], reason] : [reason];
    return message.channel.send(`⚠️ ${member.user.tag} has been warned. Reason: ${reason}`);
  }

  if (command === '$warnings') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Mention someone to view warnings.');
    const userWarnings = warnings[member.id] || [];
    return message.channel.send(`⚠️ ${member.user.tag} has ${userWarnings.length} warnings:\n${userWarnings.join('\n') || 'None'}`);
  }

  if (command === '$clear') {
    const num = parseInt(args[0]);
    if (!num || num < 1) return message.reply('⚠️ Provide a number of messages to delete.');
    return message.channel.bulkDelete(num).catch(err => message.reply(`❌ Failed: ${err}`));
  }

  if (command === '$lock') {
    return message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false })
      .then(() => message.channel.send('🔒 Channel locked.'))
      .catch(err => message.reply(`❌ Failed: ${err}`));
  }

  if (command === '$unlock') {
    return message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true })
      .then(() => message.channel.send('🔓 Channel unlocked.'))
      .catch(err => message.reply(`❌ Failed: ${err}`));
  }

  if (command === '$slowmode') {
    const seconds = parseInt(args[0]);
    if (!seconds || seconds < 0) return message.reply('⚠️ Provide slowmode seconds.');
    return message.channel.setRateLimitPerUser(seconds).then(() => message.channel.send(`🐢 Slowmode set to ${seconds} seconds.`));
  }

  if (command === '$roleadd') {
    const member = message.mentions.members.first();
    const roleName = args.slice(1).join(' ');
    if (!member || !roleName) return message.reply('⚠️ Mention user and role name.');
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (!role) return message.reply('⚠️ Role not found.');
    return member.roles.add(role).then(() => message.channel.send(`✅ Added role ${role.name} to ${member.user.tag}`));
  }

  if (command === '$roleremove') {
    const member = message.mentions.members.first();
    const roleName = args.slice(1).join(' ');
    if (!member || !roleName) return message.reply('⚠️ Mention user and role name.');
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (!role) return message.reply('⚠️ Role not found.');
    return member.roles.remove(role).then(() => message.channel.send(`✅ Removed role ${role.name} from ${member.user.tag}`));
  }

  // ---- BLACKJACK ----
  if (command === '$blackjack') {
    if (blackjackGames.has(message.author.id)) return message.reply('⚠️ You already have a game! Use `$hit` or `$stand`.');
    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];
    blackjackGames.set(message.author.id, { playerHand, dealerHand });
    const playerTotal = handValue(playerHand);
    return message.channel.send(`🃏 **Blackjack Started!**\nYour hand: ${formatHand(playerHand)} (Total: ${playerTotal})\nDealer shows: ${dealerHand[0].value}${dealerHand[0].suit}\nType \`$hit\` or \`$stand\``);
  }

  if (command === '$hit') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply('⚠️ No active game. Start with `$blackjack`.');
    game.playerHand.push(drawCard());
    const total = handValue(game.playerHand);
    let msg = `Your hand: ${formatHand(game.playerHand)} (Total: ${total})`;
    if (total > 21) { msg += '\n💥 You busted! Dealer wins.'; blackjackGames.delete(message.author.id); }
    else msg += '\nType `$hit` or `$stand`';
    return message.channel.send(msg);
  }

  if (command === '$stand') {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply('⚠️ No active game.');
    const dealerHand = game.dealerHand;
    let dealerTotal = handValue(dealerHand);
    while(dealerTotal < 17) { dealerHand.push(drawCard()); dealerTotal = handValue(dealerHand); }
    const playerTotal = handValue(game.playerHand);
    let result = `Your hand: ${formatHand(game.playerHand)} (Total: ${playerTotal})\nDealer: ${formatHand(dealerHand)} (Total: ${dealerTotal})\n`;
    if(playerTotal>21) result+='💥 You busted! Dealer wins.';
    else if(dealerTotal>21) result+='🎉 Dealer busted! You win!';
    else if(playerTotal>dealerTotal) result+='🎉 You win!';
    else if(playerTotal<dealerTotal) result+='😢 Dealer wins.';
    else result+='🤝 It’s a tie!';
    blackjackGames.delete(message.author.id);
    return message.channel.send(result);
  }

  // ---- INFO & UTILITIES ----
  if (command === '$userinfo') {
    const user = message.mentions.users.first() || message.author;
    return message.channel.send(`🧑‍💼 Username: ${user.username}\nID: ${user.id}`);
  }

  if (command === '$avatar') {
    const user = message.mentions.users.first() || message.author;
    return message.channel.send(`🖼️ Avatar for ${user.username}: ${user.displayAvatarURL({ dynamic: true })}`);
  }

  if (command === '$serverinfo') return message.channel.send(`🏠 Server: ${message.guild.name}\nMembers: ${message.guild.memberCount}`);
  if (command === '$servericon') return message.channel.send(message.guild.iconURL({ dynamic:true }) || 'No server icon.');
  if (command === '$serverbanner') return message.channel.send(message.guild.bannerURL({ dynamic:true }) || 'No server banner.');
  if (command === '$boosters') return message.channel.send(`🚀 Server Boosters: ${message.guild.premiumSubscriptionCount}`);

  if (command === '$emojis') return message.channel.send(`🎨 Emojis: ${message.guild.emojis.cache.map(e => e.toString()).join(' ') || 'None'}`);

  // ---- SHOUT / SPOILER / SAY / SEND ----
  if (command === '$shout') {
    const text = args.join(' ');
    if (!text) return message.reply('📢 What should I shout?');
    return message.channel.send(`📢 **${text.toUpperCase()}**`);
  }

  if (command === '$spoiler') {
    const text = args.join(' ');
    if (!text) return message.reply('🤐 What should I hide?');
    return message.channel.send(`||${text}||`);
  }

  if (command === '$say') {
    const text = args.join(' ');
    if (!text) return message.reply('📣 What should I say?');
    return message.channel.send(text);
  }

  if (command === '$send') {
    const channelId = args.shift();
    if (!channelId) return message.reply('⚠️ Provide the channel ID.');
    const text = args.join(' ');
    if (!text) return message.reply('⚠️ Provide a message to send.');
    const channel = client.channels.cache.get(channelId);
    if (!channel || channel.type !== 0) return message.reply('⚠️ Channel not found or not text-based.');
    return channel.send(text).then(()=>message.reply(`✅ Message sent to <#${channelId}>`))
      .catch(()=>message.reply('❌ Failed to send message. Check bot permissions.'));
  }

  // ---- AI Chat ----
  if (message.mentions.has(client.user)) {
    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    if(!prompt) return message.reply('❓ What would you like to ask?');
    try {
      await message.channel.sendTyping();
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method:'POST',
        headers:{ 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:'openrouter/auto',
          max_tokens:100,
          messages:[{role:'system',content:'You are a helpful AI inside a Discord bot.'},{role:'user',content:prompt}]
        }),
      });
      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;
      if(reply) await message.reply(reply);
      else if(data?.error?.message) await message.reply(`⚠️ AI error: ${data.error.message}`);
      else await message.reply('⚠️ Sorry, I couldn’t come up with a reply.');
    } catch(err) { console.error(err); await message.reply('🚫 Error talking to AI.'); }
  }

});

client.login(process.env.BOT_TOKEN);
