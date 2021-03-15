/*
  PelosiBot 1.0 - serves a random raunchy image of Nancy Pelosi
  Now with some other pointless stuff!
*/

const Discord = require('discord.js');
const fs = require('fs');
let STATE = {};

const TIME_WINDOW = 60000; // ms
const RATE_LIMIT = 3;

const DICE_EXPR = new RegExp(/^!roll (\d+)d(\d+)$/);
const DICE_SIDES = {'4': true, '6': true, '8': true, '10': true, '12': true, '20': true};
const MAX_DICE = 20;

// ================================ //

const rand = (n) => Math.floor(n * Math.random());

const pad = (x) => x < 10 ? '0' + x : x;

const formatDate = (d) => {
  return [
    d.getFullYear(), '-', pad(d.getMonth() + 1), '-', pad(d.getDate()), ' ',
    pad(d.getHours()), ':', pad(d.getMinutes()), ':', pad(d.getSeconds()),
  ].join('');
};

const send = (msg, body) => {
  msg.channel.send(body);
};

const sendTo = (msg, userId, body) => {
  msg.channel.send(`<@!${userId}> ${body}`);
};

const doPelosi = (msg, userId, timestamp) => {
  // rate limit
  let times = STATE[userId]['times'];
  if (times.length >= RATE_LIMIT) {
    const diff = timestamp - times[0];
    if (diff < TIME_WINDOW) {
      const secs = Math.ceil((TIME_WINDOW - diff) / 1000);
      const errorMsg = `too thirsty! ${secs} seconds until you can summon Pelosi again`;
      sendTo(msg, userId, errorMsg);
      return null;
    }
    let n = RATE_LIMIT - times.length + 1;
    while (n-- > 0) {
      times.shift();
    }
  }
  times.push(timestamp);

  // fancy stragety to avoid duplication... once, at least
  let index = rand(PELOSI_ALL.length);
  if (PELOSI_ALL[index] === STATE[userId]['last']) {
    index = (index + 1 + rand(PELOSI_ALL.length - 1)) % PELOSI_ALL.length;
  }
  STATE[userId]['last'] = PELOSI_ALL[index];

  return index;
};

const rollDice = (msg, userId, count, sides) => {
  let rolls = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const roll = rand(sides) + 1;
    rolls.push(roll);
    sum += roll;
  }
  let rollsMsg;
  if (count == 1) {
    rollsMsg = 'you rolled a `' + rolls[0] + '`';
  } else {
    rollsMsg = 'you rolled `' + rolls.join(', ') + '` for a total of `' + sum + '`';
  }
  sendTo(msg, userId, rollsMsg);
};

const doDice = (msg, userId, text) => {
  const groups = DICE_EXPR.exec(text);
  if (!groups) {
    const usageMsg = '`!roll XdY`';
    sendTo(msg, userId, `usage: ${usageMsg} where you roll X dice with Y sides`);
    return;
  }

  if (!(groups[2] in DICE_SIDES)) {
    sendTo(msg, userId, 'dice can only have 4, 6, 8, 10, 12, or 20 sides');
    return;
  }
  const sides = parseInt(groups[2]);

  const count = parseInt(groups[1]);
  if (count > MAX_DICE) {
    sendTo(msg, userId, `you can only roll up to ${MAX_DICE} dice... why do you need that many anyways?`);
    return;
  }

  rollDice(msg, userId, count, sides);
};

const processMsg = (msg) => {
  const user = msg.author;

  let userId;
  let authorStr;

  if (user) {
    authorStr = `${user.username} #${user.id}`;
    userId = user.id;
  } else {
    authorStr = 'unknown';
  }

  // log the message
  const timestamp = msg.createdTimestamp;
  const dateStr = formatDate(new Date(timestamp));
  console.log(`[${dateStr}] [${authorStr}] ${msg.content}`);

  const text = msg.content.trim().toLowerCase();

  if (text === '!pelosi') {
    if (!userId) {
      // theoretically not supposed to happen
      return;
    }

    if (!(userId in STATE)) {
      STATE[userId] = {
        'times': [],
        'last': null,
      };
    }

    // send out the Pelosi!
    const index = doPelosi(msg, userId, timestamp);
    if (index !== null) {
      send(msg, PELOSI_ALL[index]);
    }
  } else if (text.startsWith('!roll')) {
    doDice(msg, userId, text);
  }
};

const readFile = (filename, encoding) => {
  if (!encoding) {
    encoding = 'utf8';
  }
  try {
    return fs.readFileSync(filename, encoding);
  } catch (err) {
    console.error(err);
    return null;
  }
};

// ================================ //

const client = new Discord.Client();

client.on('ready', () => {
  console.log(`PelosiBot logged in as ${client.user.tag}`);
});

client.on('message', msg => {
  processMsg(msg);
});

const SECRET = process.env.PELOSI_BOT_SECRET;
if (!SECRET) {
  console.error('PELOSI_BOT_SECRET not set!');
  process.exit(1);
}

const data = readFile('/var/www/pelosibot/pelosi.txt');
if (!data) {
  process.exit(1);
}

// filter out empties
let PELOSI_ALL = data.split(/\s+/).filter((x) => x);

client.login(SECRET);
