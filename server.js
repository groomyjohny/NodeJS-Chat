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
function sendToAll(message)
{
    for (let key in clients) 
        clients[key].send(message);
}

webSocketServer.on('connection', (ws) => {
    let id = Math.random();

    clients[id] = ws;
    console.log(`Hовое соединение: id = ${id}`);

    const limit = 30;
    const subquery = `SELECT AUTO_INCREMENT
    FROM  INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'chat'
    AND   TABLE_NAME   = 'messages'`;
    const query = "SELECT id, datetime, nick, message FROM messages WHERE id > " + "( "+subquery+")-?" ;

    sqlConnection.query(query, [limit], (err, result, fields) => {
        if (err) 
            return console.error(err);
        else
            for (i in result)
            {
                let data = result[i];
                data.type = 'chat-message';
                sendToAll(JSON.stringify(data));
            }
    });

    ws.on('message', (message) => {
        console.log(`Получено сообщение: ${message}`);
        const arr = JSON.parse(message);

        if (arr.type == 'chat-message')
        {
            const query = "INSERT INTO messages (nick, message) VALUES (?,?)";
            sqlConnection.query(query, [arr.nick, arr.message]);
            sendToAll(message);
        }
        else if (arr.type == "load-more-messages")
        {
            let newQuery = "SELECT id, datetime, nick, message FROM messages WHERE id BETWEEN ? AND ? ORDER BY id DESC";
            sqlConnection.query(newQuery, [arr.currentMinId - limit, arr.currentMinId-1], (err, result, fields) => {
                if (err) 
                    return console.error(err);
                else
                {
                    for (i in result)
                    {
                        let data = result[i];
                        data.type = 'old-messages';
                        ws.send(JSON.stringify(data));
                    }
                }
            });
        }
    });

    ws.on('close', () => {
        console.log(`Cоединение закрыто: ${id}`);
        delete clients[id];
    });
});

// обычный сервер (статика) на порту 8080
const fileServer = new Static.Server('.');

http.createServer( (req, res) => { 
    fileServer.serve(req, res); 
}).listen(ports[0]);

console.log(`Сервер запущен на портах ${ports[0]}, ${ports[1]}`);