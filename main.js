/*
  PelosiBot 1.1 - serves a random raunchy image of Nancy Pelosi
  Now with some other pointless stuff!
*/

const Discord = require('discord.js');
const fs = require('fs');
let STATE = {};

const PELOSIBOT_VERSION = '1.1';
const PELOSI_ONLY_EXPR = /(^|\s)!pelosi($|\s)/;
const TIME_WINDOW = 60000; // ms
const RATE_LIMIT = 3;
const DICE_EXPR = /^!roll (\d+)d(\d+)$/;
const DICE_SIDES = {'4': true, '6': true, '8': true, '10': true, '12': true, '20': true};
const MAX_DICE = 20;
const PELOSIBOT_EXPR = /^!pelosibot (.+)/;

const SECRET = process.env.PELOSI_BOT_SECRET;
const DATA_FILE_PATH = process.env.PELOSI_BOT_FILE_PATH;

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
  usageMsg += '!pelosi \u2022 sends out a raunchy image\n'
  usageMsg += '!roll <X>d<Y> \u2022 rolls X dice with Y sides\n'
  usageMsg += '!pelosibot \u2022 this command\n'
  if (msg.member.hasPermission('ADMINISTRATOR')) {
    usageMsg += '\nAdmin commands:\n'
    usageMsg += '!pelosibot list \u2022 lists current image URLs\n'
    usageMsg += '!pelosibot add <URL> \u2022 adds an image URL to the list\n'
    usageMsg += '!pelosibot remove <ID> \u2022 removes an image from the list\n'
  }
  usageMsg += '```';
  sendTo(msg, userId, usageMsg);
};

const addImageUrl = (msg, userId, url) => {
  if (PELOSI_ALL.indexOf(url) != -1) {
    sendTo(msg, userId, 'already in the list.');
    return;
  }

  PELOSI_ALL.push(url);
  sendTo(msg, userId, `added image.`);

  writeData(PELOSI_ALL.join('\n'));
};

const removeImage = (msg, userId, id) => {
  if (!(id in PELOSI_ALL)) {
    sendTo(msg, userId, 'please specify a valid ID.');
    return;
  }

  if (id == PELOSI_ALL.length - 1) {
    PELOSI_ALL.pop();
  } else {
    PELOSI_ALL[id] = PELOSI_ALL.pop();
  }

  sendTo(msg, userId, `removed image ${id}.`);

  writeData(PELOSI_ALL.join('\n'));
};

const doInfoAndAdmin = (msg, userId, text) => {
  const groups = PELOSIBOT_EXPR.exec(text);
  if (!groups) {
    sendUsageInfo(msg, userId);
    return;
  }

  if (!msg.member.hasPermission('ADMINISTRATOR')) {
    sendTo(msg, userId, 'only an admin can run this command.');
    return;
  }

  const cmd = groups[1].split(' ');
  if (cmd[0] === 'list') {
    if (!PELOSI_ALL.length) {
      sendTo(msg, userId, 'no image URLs available!');
      return;
    }

    let listMsg = '```';
    for (let i = 0; i < PELOSI_ALL.length; i++) {
      listMsg += `[${i}] ${PELOSI_ALL[i]}\n`;
    }
    listMsg += '```';

    sendTo(msg, userId, listMsg);
  } else if (cmd[0] === 'add') {
    if (!cmd[1]) {
      sendTo(msg, userId, 'please specify an image URL to add.');
      return;
    }

    addImageUrl(msg, userId, cmd[1]);
  } else if (cmd[0] === 'remove') {
    if (!cmd[1]) {
      sendTo(msg, userId, 'please specify an image ID to remove.');
      return;
    }

    removeImage(msg, userId, cmd[1]);
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
    if (!userId) {
      // theoretically not supposed to happen
      return;
    }

    // ignore messages from self
    if (userId == client.user.id) {
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
  } else if (lower.startsWith('!roll')) {
    doDice(msg, userId, lower);
  } else if (lower.startsWith('!pelosibot')) {
    doInfoAndAdmin(msg, userId, text);
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

const readData = () => {
  const data = readFile(DATA_FILE_PATH);
  if (!data) {
    console.error('failed to read data file!');
    return false;
  }
  // filter out empties
  return data.split(/\s+/).filter((x) => x);
};

const writeData = (body, encoding) => {
  if (!encoding) {
    encoding = 'utf8';
  }
  fs.writeFile(DATA_FILE_PATH, body, encoding, (err) => {
    console.error('failed to write out to data file!');
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

let PELOSI_ALL = readData();
if (!PELOSI_ALL) {
  PELOSI_ALL = [];
}

client.login(SECRET);
