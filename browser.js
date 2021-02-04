if (localStorage.savedNick) 
    document.getElementById("nick-area").value = localStorage.savedNick;
else
    localStorage.setItem('savedNick','');

if (!window.WebSocket) {
    document.body.innerHTML = 'WebSocket в этом браузере не поддерживается.';
}

// создать подключение
let sockPath = "ws://"+location.hostname+":8081/";
console.log(sockPath)
var socket = new WebSocket(sockPath)

// отправить сообщение из формы publish
document.forms.publish.onsubmit = function (event) {
    event.preventDefault();
    var outgoingMessage = this.message.value;
    let data = { nick: this.nick.value, message: outgoingMessage };
    let msg = JSON.stringify(data);
    document.getElementById("message-area").value = '';

    socket.send(msg);
};

// обработчик входящих сообщений
socket.onmessage = function (event) {
    var incomingMessage = event.data;
    showMessage(incomingMessage);
};

// показать сообщение в div#subscribe
function showMessage(message) 
{
    let data = JSON.parse(message);

    let messageDiv = document.createElement("div");    
    let messageNickDiv = document.createElement("div");    
    let messageTextDiv = document.createElement("div");
    messageDiv.className = "message";
    messageNickDiv.className = "message-nick";
    messageTextDiv.className = "message-text";

    messageNickDiv.innerHTML = data.nick;
    localStorage.setItem('savedNick',data.nick);
    messageTextDiv.innerHTML = data.message;
    messageDiv.appendChild(messageNickDiv);
    messageDiv.appendChild(messageTextDiv);
    document.getElementById('subscribe').innerHTML = messageDiv.outerHTML + document.getElementById('subscribe').innerHTML; //prepend adds to the end for some reason, so using a workaround.
}