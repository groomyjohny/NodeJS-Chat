if (localStorage.savedNick) 
    document.getElementById("nick-area").value = localStorage.savedNick;
else
    localStorage.setItem('savedNick','');

if (localStorage.savedKey)
    document.forms.publish.key.value = localStorage.savedKey

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
    let key = this.key.value;
    let cipherMessage = this.message.value;
    let cipherNick = this.nick.value;
    let roomId = this.roomId.value;
    let encrypted = false;

    if (key && key != '')
    {
        cipherNick = CryptoJS.AES.encrypt(cipherNick, key);
        cipherMessage = CryptoJS.AES.encrypt(cipherMessage, key);

        cipherNick = cipherNick.toString();
        cipherMessage = cipherMessage.toString();
        encrypted = true;
    }

    let data = { type: 'chat-message', nick: cipherNick, message: cipherMessage, replyList: app.getReplyList(), encrypted: encrypted, roomId: roomId };
    app.clearReplyList();

    localStorage.setItem('savedNick',this.nick.value);
    let msg = JSON.stringify(data);
    document.getElementById("message-area").value = '';
    if (document.getElementById("save-key-checkbox").checked) localStorage.savedKey = this.key.value;

    socket.send(msg);
});

function decryptMessages()
{
    for (i in app.messages)
    {
        if (app.messages[i].object.encrypted)
        {
            app.decryptMessage(app.messages[i].object.id, document.forms.publish.key.value);
        }
    }
}
let msgIdList;
let msgIdListIndexLow = 0;
let msgIdListIndexHigh;

socket.onopen = function (event) {}
// обработчик входящих сообщений
socket.onmessage = function (event) {
    var incomingMessage = event.data;
    let data = JSON.parse(incomingMessage);

    if (data.type == 'chat-message') showMessage(data);
    if (data.type == 'msg-id-list') 
    {
        msgIdList = data.idList;
        msgIdListIndexHigh = msgIdList.length;
        sendGetOlderMessagesRequest();
    }
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
    let key = document.forms.publish.key.value;
    if (data.encrypted && key && key != '') app.decryptMessage(data.id, key);
}

function sendGetOlderMessagesRequest()
{
    let lowerBoundIndex = Math.max(msgIdListIndexHigh-30,0);
    if (lowerBoundIndex == msgIdListIndexHigh) return;
    let data = {
        type: 'get-messages',
        range: [msgIdList[lowerBoundIndex], msgIdList[msgIdListIndexHigh-1]],
    }
    msgIdListIndexHigh = lowerBoundIndex;
    socket.send(JSON.stringify(data));
}
//Обработчик "бесконечного" скроллинга
setInterval(function() {
    let lastArr = document.querySelectorAll('#subscribe, .message');
    let last = lastArr[lastArr.length-1];
    if (isAnyPartOfElementInViewport(last))
    {     
        sendGetOlderMessagesRequest();
    }
}, 200);