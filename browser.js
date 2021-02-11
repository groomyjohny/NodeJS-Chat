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
document.forms.publish.addEventListener("submit", function (event) {
    event.preventDefault();    
    var outgoingMessage = this.message.value;
    let data = { type: 'chat-message', nick: this.nick.value, message: outgoingMessage, replyList: app.getReplyList() };
    app.clearReplyList();

    localStorage.setItem('savedNick',data.nick);
    let msg = JSON.stringify(data);
    document.getElementById("message-area").value = '';

    socket.send(msg);
});

let minMsgId = undefined;
// обработчик входящих сообщений
socket.onmessage = function (event) {
    var incomingMessage = event.data;
    let data = JSON.parse(incomingMessage);

    if (!minMsgId) minMsgId = data.id;
    else minMsgId = Math.min(data.id,minMsgId);

    if (data.type == 'chat-message') showMessage(data);
};

function isAnyPartOfElementInViewport(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const windowHeight = (window.innerHeight || document.documentElement.clientHeight);
    const windowWidth = (window.innerWidth || document.documentElement.clientWidth);

    const vertInView = (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);
    const horInView = (rect.left <= windowWidth) && ((rect.left + rect.width) >= 0);
    return (vertInView && horInView);
}
// показать сообщение в div#subscribe
function showMessage(data) 
{
    app.addMessage(data);
}

//Обработчик "бесконечного" скроллинга
setInterval(function() {
    let last = document.getElementById('subscribe').lastChild;
    if (isAnyPartOfElementInViewport(last))
    {     
        let data = {
            type: 'get-messages',
            range: [minMsgId-30, minMsgId],
            limit: 30
        }
        socket.send(JSON.stringify(data));
    }
}, 200);