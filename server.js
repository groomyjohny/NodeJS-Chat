const WebSocketServer = new require('ws');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
require('console-stamp')(console, 'dd.mm.yyyy HH:MM:ss.l');

const ports = [8080, 8081];
const app = express();

app.use(express.static('public'));

app.listen(ports[0], (req,res) => {
    
})

async function main() 
{    
    const sqlConnectionData = {
        host: `localhost`,
        user: `root`,
        database: `chat_rooms`,
        password: ``
    }

    const webSocketServer = new WebSocketServer.Server({ port: ports[1] });
    let clients = {};    
    
    function sendToAll(message)
    {
        for (let key in clients) 
            clients[key].send(message);
    }

    webSocketServer.on('connection', async (ws) => {
        let id = uuidv4();

        clients[id] = ws;
        console.log(`Hовое соединение: id = ${id}`);

        try
        {
            const sqlConnection = await mysql.createConnection(sqlConnectionData);
            const query = "SELECT id FROM messages";
            let result = await sqlConnection.query(query);
            sqlConnection.end();

            let msgIdList = [];
            result[0].forEach(el => {
                msgIdList.push(el.id);
            })
            let data = { type: "msg-id-list", idList: msgIdList };
            ws.send(JSON.stringify(data));
        }
        catch (err)
        {
            console.error(err);
        }

        ws.on('message', async (message) => {
            try
            {
                console.log(`Получено сообщение: ${message}`);
                const arr = JSON.parse(message);                

                if (arr.type == 'chat-message')
                {
                    const sqlConnection = await mysql.createConnection(sqlConnectionData);
                    if (arr.replyList) arr.replyList.sort();

                    await sqlConnection.query("START TRANSACTION");
                    const query = "INSERT INTO messages (nick, message, encrypted) VALUES (?,?,?)";
                    let insertResult = await sqlConnection.query(query, [arr.nick, arr.message, arr.encrypted]);

                    arr.id = insertResult[0].insertId;
                    if (arr.replyList.length)
                    {
                        let replyValuesArr = [];
                        arr.replyList.forEach(el => { replyValuesArr.push([arr.id, el]);});
                        sqlConnection.query("INSERT INTO replies (parentId, childId) VALUES ?",[replyValuesArr]);
                    }
                    await sqlConnection.query("COMMIT");

                    let datetimeResult = await sqlConnection.query("SELECT datetime FROM messages WHERE id=?",[arr.id]);
                    sqlConnection.end();
                    arr.datetime = datetimeResult[0][0].datetime;                    
                    sendToAll(JSON.stringify(arr));
                }        

                else if (arr.type == "get-messages")
                {
                    const sqlConnection = await mysql.createConnection(sqlConnectionData);
                    let queryBase = 'SELECT id, datetime, nick, message, encrypted FROM messages WHERE ';
                    let queryFilter = '';
                    let queryParams;
                    if (arr.range) //get messages with id in range, limit is optional
                    {
                        queryFilter = "id BETWEEN ? AND ?";
                        queryParams = [ arr.range[0] ? arr.range[0] : 0, arr.range[1] ? arr.range[1] : 18446744073709551615n];
                        if (arr.limit)
                        {
                            queryFilter += " LIMIT ?";
                            queryParams.push(arr.limit); 
                        }                        
                    }
                    else if (arr.id) //get single message with specific id
                    {
                        queryFilter = "id = ?";
                        queryParams = [arr.id];
                    }
                    
                    let selectResults = await sqlConnection.query(queryBase+queryFilter,queryParams);
                    selectResults[0].forEach(async el =>
                    {
                        let data = el;
                        data.type = 'chat-message';
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
    console.log(`Сервер запущен на портах ${ports[0]}, ${ports[1]}`);
}

try
{
    main();
}
catch (err)
{
    console.error(err);
}