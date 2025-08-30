require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// ====== HAUNT COMMAND DATA ======
const hauntedChannels = new Set();
const hauntIntervals = new Map();
const spookyMessages = [
  '👻 Boo...', '💀 I see you...', '🩸 The shadows are watching...',
  '🔪 Behind you...', '🕷️ Something crawled across your screen...',
];

// ====== ARRAYS ======
const spicyTruths = [
  "What's the most embarrassing thing you've done in public?",
  "What's a secret you've never told anyone?",
  "Who was your first crush?",
  "What’s the most awkward date you’ve ever been on?",
];

const spicyDares = [
  "Send a random emoji in the chat right now!",
  "Say the alphabet backward in VC (if you’re brave).",
  "Ping someone randomly in chat and say 'hi bestie ❤️'.",
  "Change your nickname to 'Potato' for 10 minutes.",
];

const compliments = [
  "You're looking sharp today!",
  "You're an awesome friend.",
  "Your positivity is contagious.",
  "You're smarter than you think!",
];

// ====== ROLEPLAY GIFS (offline URLs) ======
const roleplayGifs = {
  hug: ["https://i.imgur.com/r9aU2xv.gif","https://i.imgur.com/wOmoeF8.gif","https://i.imgur.com/nrdYNtL.gif"],
  kiss: ["https://i.imgur.com/QGc8F6g.gif","https://i.imgur.com/R9aU2xv.gif","https://i.imgur.com/6qYOUQF.gif"],
  slap: ["https://i.imgur.com/fm49srQ.gif","https://i.imgur.com/Agwwaj6.gif","https://i.imgur.com/o2SJYUS.gif"],
  pat: ["https://i.imgur.com/4ssddEQ.gif","https://i.imgur.com/L3WQjD0.gif","https://i.imgur.com/lxD9vK5.gif"],
  poke: ["https://i.imgur.com/9J0Y0lX.gif","https://i.imgur.com/VgP7Ztr.gif","https://i.imgur.com/TnZ8r2n.gif"],
  cuddle: ["https://i.imgur.com/svK7cMJ.gif","https://i.imgur.com/8YVi3lV.gif","https://i.imgur.com/IpEsYSH.gif"]
};

// ====== WARNINGS SYSTEM ======
const warnings = {};

// ====== CUSTOM PREFIX ======
const prefix = "$";

// ====== BLACKJACK DATA ======
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

// ====== READY ======
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
// ====== MESSAGE HANDLER ======
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ====== HELP COMMAND ======
  if (command === "help") {
    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("📜 Bot Commands")
      .setDescription("Here’s a list of all available commands:")
      .addFields(
        { name: "🎉 Fun", value: "`$truth`, `$dare`, `$compliment`, `$mock [text]`, `$reverse [text]`, `$ship @user1 @user2`, `$flip`, `$8ball [question]`, `$dice`, `$rate @user`, `$howgay @user`, `$sus @user`, `$roast @user`" },
        { name: "🤗 Roleplay", value: "`$hug @user`, `$kiss @user`, `$slap @user`, `$pat @user`, `$poke @user`, `$cuddle @user`" },
        { name: "👻 Haunting", value: "`$haunt`, `$unhaunt`" },
        { name: "🎲 Games", value: "`$blackjack`, `$hit`, `$stand`" },
        { name: "⚙️ Utility", value: "`$servericon`, `$serverbanner`, `$boosters`, `$prefix`, `$emojis`, `$userinfo @user`, `$avatar @user`, `$serverinfo`, `$shout [msg]`, `$spoiler [msg]`, `$say [msg]`, `$send <channelID> <msg>`" },
        { name: "🛠 Moderation", value: "`$kick @user`, `$ban @user`, `$mute @user`, `$unmute @user`, `$warn @user`, `$warnings @user`, `$clear [number]`, `$lock`, `$unlock`, `$slowmode [time]`, `$roleadd @user [role]`, `$roleremove @user [role]`" }
      )
      .setFooter({ text: "Use $ before every command." });
    return message.reply({ embeds: [embed] });
  }

  // ====== TRUTH / DARE / COMPLIMENT ======
  if (command === "truth") return message.reply(spicyTruths[Math.floor(Math.random() * spicyTruths.length)]);
  if (command === "dare") return message.reply(spicyDares[Math.floor(Math.random() * spicyDares.length)]);
  if (command === "compliment") return message.reply(compliments[Math.floor(Math.random() * compliments.length)]);

  // ====== MOCK / REVERSE ======
  if (command === "mock") {
    if (!args.length) return message.reply("Provide text to mock!");
    const mocked = args.join("").split("").map((c,i) => i%2 ? c.toUpperCase() : c.toLowerCase()).join("");
    return message.reply(mocked);
  }
  if (command === "reverse") {
    if (!args.length) return message.reply("Provide text to reverse!");
    return message.reply(args.join(" ").split("").reverse().join(""));
  }

  // ====== HAUNT / UNHAUNT ======
  if (command === 'haunt') {
    if (hauntedChannels.has(message.channel.id)) return message.channel.send('👻 Already haunting this channel!');
    hauntedChannels.add(message.channel.id);
    message.channel.send('💀 The haunting has begun...');
    const interval = setInterval(() => {
      if (!hauntedChannels.has(message.channel.id)) return clearInterval(interval);
      const spooky = spookyMessages[Math.floor(Math.random() * spookyMessages.length)];
      message.channel.send(spooky);
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

  // ====== SHIP COMMAND ======
  if (command === "ship") {
    const mentions = [...message.mentions.users.values()];
    const user1 = mentions[0];
    const user2 = mentions[1] || message.author;

    if (!user1) return message.reply("💞 Mention at least one user to ship with!");

    const score = Math.floor(Math.random() * 101);
    const hearts = Math.round((score / 100) * 10);
    const bar = "💖".repeat(hearts) + "🖤".repeat(10 - hearts);
    const shipName =
      user1.username.slice(0, Math.ceil(user1.username.length / 2)) +
      user2.username.slice(Math.floor(user2.username.length / 2));

    let verdict = "";
    if (score >= 90) verdict = "Absolute endgame! 💍";
    else if (score >= 75) verdict = "Great match! 💘";
    else if (score >= 55) verdict = "There’s a spark! ✨";
    else if (score >= 35) verdict = "It’s complicated… 😅";
    else verdict = "Maybe just friends. 😬";

    return message.reply(
      `💞 **Ship Results:** ${user1} × ${user2}\n` +
      `**Compatibility:** ${score}%\n${bar}\n` +
      `**Ship name:** ${shipName}\n${verdict}`
    );
  }

  // ====== ROLEPLAY COMMANDS ======
  if (["hug", "kiss", "slap", "pat", "poke", "cuddle"].includes(command)) {
    const target = message.mentions.users.first();
    if (!target) return message.reply(`Tag someone to ${command}!`);

    const gifs = roleplayGifs[command];
    const gif = gifs[Math.floor(Math.random() * gifs.length)];

    return message.channel.send({
      content: `${message.author} ${command}s ${target}!`,
      embeds: [{ image: { url: gif } }]
    });
  }
  // ====== BLACKJACK COMMANDS ======
  if (command === "blackjack") {
    if (blackjackGames.has(message.author.id)) return message.reply('⚠️ You already have a game! Use `$hit` or `$stand`.');
    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];
    blackjackGames.set(message.author.id, { playerHand, dealerHand });
    const playerTotal = handValue(playerHand);
    return message.channel.send(
      `🃏 **Blackjack Started!** 🃏\n\n` +
      `**Your hand:** ${formatHand(playerHand)} (Total: ${playerTotal})\n` +
      `**Dealer’s hand:** ${dealerHand[0].value}${dealerHand[0].suit} ??\n\n` +
      `👉 Type \`$hit\` or \`$stand\``
    );
  }

  if (command === "hit") {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply('⚠️ No active game. Start one with `$blackjack`.');
    game.playerHand.push(drawCard());
    const playerTotal = handValue(game.playerHand);
    let msg = `**Your hand:** ${formatHand(game.playerHand)} (Total: ${playerTotal})`;
    if (playerTotal > 21) {
      msg += `\n💥 You busted! Dealer wins.`;
      blackjackGames.delete(message.author.id);
    } else msg += `\n👉 Type \`$hit\` or \`$stand\``;
    return message.channel.send(msg);
  }

  if (command === "stand") {
    const game = blackjackGames.get(message.author.id);
    if (!game) return message.reply('⚠️ No active game. Start one with `$blackjack`.');
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
    return message.channel.send(result);
  }

  // ====== SERVER INFO / UTILITY ======
  if (command === "servericon") {
    if (!message.guild.iconURL()) return message.reply("No server icon set!");
    return message.channel.send({ files: [message.guild.iconURL({ size: 1024 })] });
  }

  if (command === "serverbanner") {
    if (!message.guild.bannerURL()) return message.reply("No server banner set!");
    return message.channel.send({ files: [message.guild.bannerURL({ size: 1024 })] });
  }

  if (command === "boosters") {
    const boosters = message.guild.members.cache.filter(m => m.premiumSince);
    return message.channel.send(`Server Boosters:\n${boosters.map(m => m.user.tag).join("\n") || "None"}`);
  }

  if (command === "prefix") return message.channel.send(`Current prefix is: \`${prefix}\``);
  if (command === "emojis") return message.channel.send(message.guild.emojis.cache.map(e => e.toString()).join(" ") || "No emojis found!");
  if (command === "userinfo") {
    const user = message.mentions.users.first() || message.author;
    return message.channel.send(`🧑‍💼 Username: ${user.username}\nID: ${user.id}`);
  }
  if (command === "avatar") {
    const user = message.mentions.users.first() || message.author;
    return message.channel.send({ files: [user.displayAvatarURL({ dynamic: true, size: 1024 })] });
  }
  if (command === "serverinfo") {
    return message.channel.send(`🏠 Server: ${message.guild.name}\nMembers: ${message.guild.memberCount}`);
  }
  if (command === "shout") {
    const text = args.join(" ");
    if (!text) return message.reply('📢 What should I shout?');
    return message.channel.send(`📢 **${text.toUpperCase()}**`);
  }
  if (command === "spoiler") {
    const text = args.join(" ");
    if (!text) return message.reply('🤐 What should I hide?');
    return message.channel.send(`||${text}||`);
  }
  if (command === "say") {
    const text = args.join(" ");
    if (!text) return message.reply('📣 What should I say?');
    return message.channel.send(text);
  }

  // ====== MODERATION ======
  if (command === "kick") {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to kick.');
    if (!member.kickable) return message.reply('❌ I cannot kick this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    member.kick(reason)
      .then(() => message.channel.send(`✅ Kicked ${member.user.tag} | Reason: ${reason}`))
      .catch(err => message.reply(`❌ Failed to kick: ${err}`));
  }

  if (command === "ban") {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Please mention a user to ban.');
    if (!member.bannable) return message.reply('❌ I cannot ban this user.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    member.ban({ reason })
      .then(() => message.channel.send(`✅ Banned ${member.user.tag} | Reason: ${reason}`))
      .catch(err => message.reply(`❌ Failed to ban: ${err}`));
  }

  if (command === "mute") {
    const member = message.mentions.members.first();
    if (!member) return message.reply("Tag someone to mute.");
    const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole) return message.reply("No 'Muted' role found.");
    await member.roles.add(muteRole);
    return message.channel.send(`${member.user.tag} has been muted.`);
  }

  if (command === "warn") {
    const member = message.mentions.members.first();
    if (!member) return message.reply("Tag someone to warn.");
    if (!warnings[member.id]) warnings[member.id] = [];
    warnings[member.id].push(args.slice(1).join(" ") || "No reason provided.");
    return message.channel.send(`${member.user.tag} has been warned.`);
  }

  if (command === "warnings") {
    const member = message.mentions.members.first();
    if (!member) return message.reply("Tag someone to check warnings.");
    return message.channel.send(`${member.user.tag} Warnings:\n${warnings[member.id]?.join("\n") || "None"}`);
  }

  if (command === "clear") {
    const amount = parseInt(args[0]);
    if (!amount || isNaN(amount)) return message.reply("Provide a number of messages to delete.");
    await message.channel.bulkDelete(amount, true);
    return message.channel.send(`Cleared ${amount} messages.`).then(msg => setTimeout(() => msg.delete(), 3000));
  }

  if (command === "lock") {
    await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
    return message.channel.send("🔒 Channel locked.");
  }

  if (command === "unlock") {
    await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: true });
    return message.channel.send("🔓 Channel unlocked.");
  }

  if (command === "slowmode") {
    const seconds = parseInt(args[0]) || 0;
    await message.channel.setRateLimitPerUser(seconds);
    return message.channel.send(`Slowmode set to ${seconds} seconds.`);
  }

  if (command === "roleadd") {
    const member = message.mentions.members.first();
    const roleName = args.slice(1).join(" ");
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (!member || !role) return message.reply("Usage: $roleadd @user [role]");
    await member.roles.add(role);
    return message.channel.send(`Role ${role.name} added to ${member.user.tag}.`);
  }

  if (command === "roleremove") {
    const member = message.mentions.members.first();
    const roleName = args.slice(1).join(" ");
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (!member || !role) return message.reply("Usage: $roleremove @user [role]");
    await member.roles.remove(role);
    return message.channel.send(`Role ${role.name} removed from ${member.user.tag}.`);
  }

  // ====== AI CHAT ======
  if (message.mentions.has(client.user)) {
    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
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
          max_tokens: 100,
          messages: [
            { role: 'system', content: 'You are a helpful and fun AI assistant living inside a Discord bot.' },
            { role: 'user', content: prompt }
          ]
        }),
      });

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;

      if (reply) await message.reply(reply);
      else if (data?.error?.message) await message.reply(`⚠️ AI error: ${data.error.message}`);
      else await message.reply('⚠️ Sorry, I couldn’t come up with a reply.');
    } catch (err) {
      console.error('❌ AI request failed:', err);
      await message.reply('🚫 Error talking to the AI. Try again later.');
    }
  }
});

// ====== LOGIN ======
client.login(process.env.BOT_TOKEN);
