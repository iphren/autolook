require('dotenv').config();
const net = require('net');
const ms = require('./ms');

const server = net.createServer((socket) => {

  let data = '';

  socket.on('data', (chunk) => {
    data += chunk;
  });

  socket.on('end', () => {
    let mail;
    try {
      mail = JSON.parse(data);
    } catch (e) {
      console.error(`mail error: ${e.message}`);
      return;
    };
    ms.send(mail);
  });

});

server.on('error', (e) => {
  console.error(`server error: ${e.message}`);
});

server.listen(process.env.NOTE_PORT, 'localhost', () => {
  console.log('server bound');
});
