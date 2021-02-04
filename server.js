var http = require('http');
var Static = require('node-static');
var WebSocketServer = new require('ws');
var mysql = require('mysql2');
const { Socket } = require('dgram');

// подключенные клиенты
var clients = {};

const sqlConnection = mysql.createConnection({
    host: "localhost",
    user: "root",
    database: "chat",
    password: ""
}); 

// WebSocket-сервер на порту 8081
var webSocketServer = new WebSocketServer.Server({ port: 8081 });
function sendToAll(message)
{
    for (var key in clients) {
        clients[key].send(message);
    }
}
webSocketServer.on('connection', function (ws) {

    var id = Math.random();
    clients[id] = ws;
    console.log("новое соединение " + id);

    sqlConnection.query("SELECT nick, message FROM messages", (err, result, fields) => {
        if (!err)
        {
            for (i in result)
            {
                sendToAll(JSON.stringify(result[i]));
            }
        }
    });

    ws.on('message', function (message) {
        console.log('получено сообщение ' + message);
        let arr = JSON.parse(message);
        const query = "INSERT INTO messages (nick, message) VALUES (?,?)";
        sqlConnection.query(query, [arr.nick, arr.message])

        sendToAll(message)
    });

    ws.on('close', function () {
        console.log('соединение закрыто ' + id);
        delete clients[id];
    });
});


// обычный сервер (статика) на порту 8080
var fileServer = new Static.Server('.');
http.createServer(function (req, res) {
    fileServer.serve(req, res);
}).listen(8080);

console.log("Сервер запущен на портах 8080, 8081");
