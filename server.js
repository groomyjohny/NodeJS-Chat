const WebSocketServer = new require('ws');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const { query } = require('express');
require('console-stamp')(console, 'dd.mm.yyyy HH:MM:ss.l');

const ports = [8080, 8081];
const app = express();

app.get('/', (req,res)=>{
    res.render("index.hbs", {roomId: null});
})

app.get('/room/:roomId', (req,res)=>{
    let roomId = req.params.roomId;
    res.render("index.hbs",{roomId: roomId});
})

app.use('/public',express.static('public'));

app.listen(ports[0], (req,res) => {
    
})

async function main() 
{    
    const sqlConnectionData = {
        host: `localhost`,
        user: `root`,
        database: `chat_prod`,
        password: ``
    }

    const webSocketServer = new WebSocketServer.Server({ port: ports[1] });
    let clients = {};    
    
    function sendToAllInRoom(message, roomId = null)
    {
        for (let key in clients) 
            if (clients[key].roomId == roomId)
                clients[key].send(message);
    }

    webSocketServer.on('connection', async (ws) => {
        let id = uuidv4();

        clients[id] = ws;
        console.log(`Hовое соединение: id = ${id}`);        

        ws.on('message', async (message) => {
            try
            {
                console.log(`Получено сообщение: ${message}`);
                const arr = JSON.parse(message);                

                if (arr.type == "room-id")
                {
                    clients[id].roomId = arr.roomId;
                }
                else if (arr.type == 'chat-message')
                {
                    const sqlConnection = await mysql.createConnection(sqlConnectionData);
                    if (arr.replyList) arr.replyList.sort();

                    await sqlConnection.query("START TRANSACTION");
                    const query = "INSERT INTO messages (nick, message, encrypted, roomId) VALUES (?,?,?,?)";
                    let insertResult = await sqlConnection.query(query, [arr.nick, arr.message, arr.encrypted, arr.roomId]);

                    arr.id = insertResult[0].insertId;
                    if (arr.replyList && arr.replyList.length)
                    {
                        let replyValuesArr = [];
                        arr.replyList.forEach(el => { replyValuesArr.push([arr.id, el]);});
                        sqlConnection.query("INSERT INTO replies (parentId, childId) VALUES ?",[replyValuesArr]);
                    }
                    await sqlConnection.query("COMMIT");

                    let datetimeResult = await sqlConnection.query("SELECT datetime FROM messages WHERE id=?",[arr.id]);
                    sqlConnection.end();
                    arr.datetime = datetimeResult[0][0].datetime;                    
                    sendToAllInRoom(JSON.stringify(arr), arr.roomId);
                }        

                else if (arr.type == "get-messages")
                {
                    const sqlConnection = await mysql.createConnection(sqlConnectionData);
                    let queryBase = 'SELECT id, datetime, nick, message, encrypted FROM messages WHERE roomId';

                    let query = queryBase;
                    let queryParams = [];

                    if (clients[id].roomId)
                    {
                        queryParams.push(clients[id].roomId);
                        query += "=? ";
                    }
                    else query += " IS NULL ";
        
                    if (arr.range) //get messages with id in range, limit is optional
                    {
                        query += "AND id BETWEEN ? AND ? ORDER BY id DESC ";
                        queryParams.push(arr.range[0] ? arr.range[0] : 0);
                        queryParams.push(arr.range[1] ? arr.range[1] : 18446744073709551615n);

                        if (arr.limit)
                        {
                            query += " LIMIT ? ";
                            queryParams.push(arr.limit);
                        }
                    }
                    else query += "ORDER BY id DESC";
                    
                    let selectResults = await sqlConnection.query(query,queryParams);
                    if (selectResults[0].length == 0) ws.send(JSON.stringify({type: 'no-more-messages'}));
                    selectResults[0].forEach(async el =>
                    {
                        let data = el;
                        data.type = 'chat-message';
                        data.isOld = arr.range && (!arr.range[0] || !arr.range[1] || (arr.range[1]-arr.range[0] > 0));
                        let replyListSelectResults = await sqlConnection.query("SELECT childId FROM replies WHERE parentId = ?",[el.id]);
                        data.replyList = [];
                        replyListSelectResults[0].forEach(el => { data.replyList.push(el.childId) });
                        ws.send(JSON.stringify(data));
                    });
                    sqlConnection.end();
                }
            }
            catch (err)
            {
                console.error(err);
            }
        });

        ws.on('close', () => {
            console.log(`Cоединение закрыто: ${id}`);
            delete clients[id];
        });
    });
    console.log(`Порт express-сервера: ${ports[0]}`);
    console.log(`Порт WebSocket-сервера: ${ports[1]}`);
}

try
{
    main();
}
catch (err)
{
    console.error(err);
}