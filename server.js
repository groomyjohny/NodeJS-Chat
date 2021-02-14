const WebSocketServer = new require('ws');
const Static = require('node-static');
const { Socket } = require('dgram');
const mysql = require('mysql2/promise');
const http = require('http');
const { uuid } = require('uuidv4');
async function main() 
{
    const ports = [8080, 8081];

    // подключенные клиенты
    let clients = {};

    const sqlConnectionData = {
        host: `localhost`,
        user: `root`,
        database: `chat`,
        password: ``
    }

    const sqlConnection = await mysql.createConnection(sqlConnectionData); 

    const webSocketServer = new WebSocketServer.Server({ port: ports[1] });
    function sendToAll(message)
    {
        for (let key in clients) 
            clients[key].send(message);
    }

    webSocketServer.on('connection', async (ws) => {
        let id = uuid();

        clients[id] = ws;
        console.log(`Hовое соединение: id = ${id}`);

        try
        {
            const query = "SELECT id FROM messages";
            let result = await sqlConnection.query(query);
            let msgIdList = [];
            result[0].forEach(el => {
                msgIdList.push(el.id);
            })
            let data = { type: "msg-id-list", idList: msgIdList };
            ws.send(JSON.stringify(data));
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

                if (arr.type == 'chat-message')
                {
                    const newSqlConnection = await mysql.createConnection(sqlConnectionData);
                    if (arr.replyList) arr.replyList.sort();

                    await newSqlConnection.query("START TRANSACTION");
                    const query = "INSERT INTO messages (nick, message, salt) VALUES (?,?,?)";
                    let insertResult = await newSqlConnection.query(query, [arr.nick, arr.message, arr.salt]);

                    arr.id = insertResult[0].insertId;
                    if (arr.replyList.length)
                    {
                        let replyValuesArr = [];
                        arr.replyList.forEach(el => { replyValuesArr.push([arr.id, el]);});
                        newSqlConnection.query("INSERT INTO replies (parentId, childId) VALUES ?",[replyValuesArr]);
                    }
                    await newSqlConnection.query("COMMIT");

                    let datetimeResult = await newSqlConnection.query("SELECT datetime FROM messages WHERE id=?",[arr.id]);
                    arr.datetime = datetimeResult[0][0].datetime;
                    newSqlConnection.end();
                    sendToAll(JSON.stringify(arr));
                }        

                else if (arr.type == "get-messages")
                {
                    let queryBase = 'SELECT id, datetime, nick, message FROM messages WHERE ';
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

    // обычный сервер (статика) на порту 8080
    const fileServer = new Static.Server('.');

    http.createServer( (req, res) => { 
        fileServer.serve(req, res); 
    }).listen(ports[0]);

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