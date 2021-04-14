/*
  PelosiBot 1.2 - serves a random raunchy image of Nancy Pelosi
  Now with some other pointless stuff!
  Note to self, this code needs serious refactoring...
*/

const Discord = require('discord.js');
const fs = require('fs');
let STATE = {};

const PELOSIBOT_VERSION = '1.2';
const PELOSI_ONLY_EXPR = /(^|\s)!pelosi($|\s)/; // if !pelosi appears
const FUD_ONLY_EXPR = /(^|\s)!fud($|\s)/; // if !fud appears
const TIME_WINDOW = 60000; // ms
const RATE_LIMIT = 3;
const PELOSI_ERROR_MSG = 'too thirsty! {} seconds until you can summon Pelosi again';
const FUD_ERROR_MSG = 'too bearish! {} seconds until you can shill again';
const DICE_EXPR = /^!roll (\d+)d(\d+)$/;
const DICE_SIDES = {'4': true, '6': true, '8': true, '10': true, '12': true, '20': true};
const MAX_DICE = 20;
const PELOSIBOT_EXPR = /^!pelosibot (.+)/;

const SECRET = process.env.PELOSI_BOT_SECRET;
const DATA_FILE_PATH = process.env.YOUR_PATH_HERE_1;
const FUD_FILE_PATH = process.env.YOUR_PATH_HERE_2;

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

// the big ugly pelosi routine
const doPelosi = (msg, userId, timestamp, state, items, errorMsg) => {
  if (!userId) {
    // theoretically not supposed to happen
    return;
  }

  // ignore messages from self
  if (userId == client.user.id) {
    return;
  }

  if (!(userId in state)) {
    state[userId] = {
      'times': [],
      'last': null,
    };
  }

  // rate limit
  let times = state[userId]['times'];
  if (times.length >= RATE_LIMIT) {
    const diff = timestamp - times[0];
    if (diff < TIME_WINDOW) {
      const secs = Math.ceil((TIME_WINDOW - diff) / 1000);
      sendTo(msg, userId, errorMsg.replace('{}', secs));
      return null;
    }
    let n = RATE_LIMIT - times.length + 1;
    while (n-- > 0) {
      times.shift();
    }
  }
  times.push(timestamp);

  // fancy stragety to avoid duplication... once, at least
  let index = rand(items.length);
  if (items[index] === state[userId]['last']) {
    index = (index + 1 + rand(items.length - 1)) % items.length;
  }
  state[userId]['last'] = items[index];

  // send out the Pelosi!
  if (index !== null) {
    send(msg, items[index]);
  }
};

const rollDice = (msg, userId, count, sides) => {
  let rolls = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const roll = rand(sides) + 1;
    rolls.push(roll);
    sum += roll;
  }

  let rollsMsg = '`' + count + 'd' + sides + '`: ';
  if (count == 1) {
    rollsMsg += 'you rolled a `' + rolls[0] + '`';
  } else {
    rollsMsg += 'you rolled `' + rolls.join(', ') + '` for a total of `' + sum + '`';
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

const sendUsageInfo = (msg, userId) => {
  let usageMsg = '\n```';
  usageMsg += 'PelosiBot v' + PELOSIBOT_VERSION + '\n';
  usageMsg += '~-~-~-~-~-~-~-~\n';
  usageMsg += '!pelosi \u2022 sends out a raunchy image\n';
  usageMsg += '!fud \u2022 let out your inner shill\n';
  usageMsg += '!roll <X>d<Y> \u2022 rolls X dice with Y sides\n';
  usageMsg += '!pelosibot \u2022 this command\n';
  if (msg.member.hasPermission('BAN_MEMBERS')) { // has moderator permission
    usageMsg += '\nAdmin commands:\n';
    usageMsg += '!pelosibot list \u2022 lists current image URLs\n';
    usageMsg += '!pelosibot add <URL> \u2022 adds an image URL to the list\n';
    usageMsg += '!pelosibot remove <ID> \u2022 removes an image from the list\n';
  }
  usageMsg += '```';
  sendTo(msg, userId, usageMsg);
};

const addItem = (msg, userId, item, items) => {
  if (items.indexOf(item) != -1) {
    sendTo(msg, userId, 'already in the list.');
    return;
  }

  items.push(item);
  sendTo(msg, userId, `added image.`);

  writeData(DATA_FILE_PATH, items.join('\n'));
};

const removeItem = (msg, userId, id, items) => {
  if (!(id in items)) {
    sendTo(msg, userId, 'please specify a valid ID.');
    return;
  }

  if (id == items.length - 1) {
    items.pop();
  } else {
    items[id] = items.pop();
  }

  sendTo(msg, userId, `removed image ${id}.`);

  writeData(DATA_FILE_PATH, items.join('\n'));
};

const doInfoAndAdmin = (msg, userId, text, items) => {
  const groups = PELOSIBOT_EXPR.exec(text);
  if (!groups) {
    sendUsageInfo(msg, userId);
    return;
  }

  if (!msg.member.hasPermission('BAN_MEMBERS')) {
    sendTo(msg, userId, 'no permission to run this command.');
    return;
  }

  const cmd = groups[1].split(' ');
  if (cmd[0] === 'list') {
    if (!items.length) {
      sendTo(msg, userId, 'no image URLs available!');
      return;
    }

    let listMsg = '```';
    for (let i = 0; i < items.length; i++) {
      listMsg += `[${i}] ${items[i]}\n`;
    }
    listMsg += '```';

    sendTo(msg, userId, listMsg);
  } else if (cmd[0] === 'add') {
    if (!cmd[1]) {
      sendTo(msg, userId, 'please specify an image URL to add.');
      return;
    }

    addItem(msg, userId, cmd[1], items);
  } else if (cmd[0] === 'remove') {
    if (!cmd[1]) {
      sendTo(msg, userId, 'please specify an image ID to remove.');
      return;
    }

    removeItem(msg, userId, cmd[1], items);
  }
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

  const text = msg.content.trim();
  const lower = text.toLowerCase();

  if (PELOSI_ONLY_EXPR.exec(lower)) {
    doPelosi(msg, userId, timestamp, STATE, PELOSI_ALL, PELOSI_ERROR_MSG);
  } else if (FUD_ONLY_EXPR.exec(lower)) {
    doPelosi(msg, userId, timestamp, STATE, FUD_ALL, FUD_ERROR_MSG);
  } else if (lower.startsWith('!roll')) {
    doDice(msg, userId, lower);
  } else if (lower.startsWith('!pelosibot')) {
    doInfoAndAdmin(msg, userId, text, PELOSI_ALL);
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

const readData = (filename) => {
  const data = readFile(filename);
  if (!data) {
    console.error(`failed to read data file: ${filename}`);
    return false;
  }
  // filter out empties
  return data.split(/\n/).filter((x) => x);
};

const writeData = (filename, body, encoding) => {
  if (!encoding) {
    encoding = 'utf8';
  }
  fs.writeFile(filename, body, encoding, (err) => {
    console.error(`failed to write out to data file: ${filename}`);
  });
};

// ================================ //

const client = new Discord.Client();

client.on('ready', () => {
  console.log(`PelosiBot logged in as ${client.user.tag} with user ID ${client.user.id}`);
});

client.on('message', msg => {
  processMsg(msg);
});

if (!SECRET) {
  console.error('PELOSI_BOT_SECRET not set!');
  process.exit(1);
}

// pelosi list
let PELOSI_ALL = readData(DATA_FILE_PATH);
if (!PELOSI_ALL) {
  PELOSI_ALL = [];
}

// fud list
let FUD_ALL = readData(FUD_FILE_PATH);
if (!FUD_ALL) {
  FUD_ALL = [];
}

client.login(SECRET);
