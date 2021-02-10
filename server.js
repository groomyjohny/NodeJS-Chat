const WebSocketServer = new require('ws');
const Static = require('node-static');
const { Socket } = require('dgram');
const mysql = require('mysql2/promise');
const http = require('http');

async function main() 
{
const ports = [8080, 8081];

// подключенные клиенты
let clients = {};

const dbname = `localhost`;
const dbuser = `root`;
const dbdatabase = `chat`;
const dbpassword = ``;

const sqlConnection = await mysql.createConnection({
    host: dbname,
    user: dbuser,
    database: dbdatabase,
    password: dbpassword
}); 

const webSocketServer = new WebSocketServer.Server({ port: ports[1] });
function sendToAll(message)
{
    for (let key in clients) 
        clients[key].send(message);
}

webSocketServer.on('connection', async (ws) => {
    let id = Math.random();

    clients[id] = ws;
    console.log(`Hовое соединение: id = ${id}`);

    const limit = 30;
    const subquery = `SELECT AUTO_INCREMENT
    FROM  INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'chat'
    AND   TABLE_NAME   = 'messages'`;
    const query = "SELECT id, datetime, nick, message FROM messages WHERE id > " + "( "+subquery+")-?" ;

    try
    {
        let result = await sqlConnection.query(query, [limit]);
        result[0].forEach(el =>
        {
            let data = el;
            data.type = 'chat-message';
            sendToAll(JSON.stringify(data));
        });
    }
    catch (err)
    {
        console.log(err);
    }

    ws.on('message', async (message) => {
        try
        {
            console.log(`Получено сообщение: ${message}`);
            const arr = JSON.parse(message);
            if (arr.replyList) arr.replyList.sort();

            if (arr.type == 'chat-message')
            {
                const query = "INSERT INTO messages (nick, message) VALUES (?,?)";
                let insertResult = await sqlConnection.query(query, [arr.nick, arr.message])

                arr.id = insertResult[0].insertId;
                if (arr.replyList.length)
                {
                    let replyValuesArr = [];
                    arr.replyList.forEach(element => {
                        replyValuesArr.push([arr.id, element]);
                    });
                    sqlConnection.query("INSERT INTO replies (parentId, childId) VALUES ?",[replyValuesArr]);
                }

                let datetimeResult = await sqlConnection.query("SELECT datetime FROM messages WHERE id=?",[arr.id]);
                arr.datetime = datetimeResult[0][0].datetime;
                sendToAll(JSON.stringify(arr));
            }        
            else if (arr.type == "load-more-messages")
            {
                const newQuery = "SELECT id, datetime, nick, message FROM messages WHERE id BETWEEN ? AND ? ORDER BY id DESC";
                let selectResults = await sqlConnection.query(newQuery, [arr.currentMinId - limit, arr.currentMinId-1]);
                selectResults[0].forEach(el =>
                {
                    let data = el;
                    data.type = 'old-messages';
                    ws.send(JSON.stringify(data));
                });
            }
        }
        catch (err)
        {
            console.log(err);
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
}

console.log(process.env.NODE_OPTIONS, process.env.VSCODE_INSPECTOR_OPTIONS)
try
{
main();
}
catch (err)
{
    console.error(err);
}