const WebSocketServer = new require('ws');
const Static = require('node-static');
const { Socket } = require('dgram');
const mysql = require('mysql2');
const http = require('http');

const ports = [8080, 8081];

// подключенные клиенты
let clients = {};

const dbname = `localhost`;
const dbuser = `root`;
const dbdatabase = `chat`;
const dbpassword = ``;

const sqlConnection = mysql.createConnection({
    host: dbname,
    user: dbuser,
    database: dbdatabase,
    password: ""
}); 

// WebSocket-сервер на порту 8081
const webSocketServer = new WebSocketServer.Server({ port: ports[1] });
const sendToAll = (message) => {
    for (let key in clients) 
        clients[key].send(message);
    }

webSocketServer.on('connection', (ws) => {

    let id = Math.random();

    clients[id] = ws;

    console.log(`Hовое соединение: ${id}`);

    sqlConnection.query("SELECT nick, message FROM messages", (err, result, fields) => {
        if (err) 
            return console.err(err);
        else
            for (i in result)
                sendToAll(JSON.stringify(result[i]));
    });

    ws.on('message', (message) => {
        console.log(`Получено сообщение: ${message}`);

        const arr = JSON.parse(message);

        const query = "INSERT INTO messages (nick, message) VALUES (?,?)";

        sqlConnection.query(query, [arr.nick, arr.message]);

        sendToAll(message);
    });

    ws.on('close', () => {
        console.log(`Cоединение закрыто: ${id}`);
        delete clients[id];
    });
});


// обычный сервер (статика) на порту 8080
const fileServer = new Static.Server('.');

http.createServer( (req, res) => { fileServer.serve(req, res); }).listen(ports[0]);

console.log(`Сервер запущен на портах ${ports[0]}, ${ports[1]}`);