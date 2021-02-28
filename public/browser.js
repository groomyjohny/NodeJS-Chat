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
    if (document.getElementById("save-key-checkbox").checked) saveKeys();

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

socket.onopen = function (event) {
    let data = {
        type: 'room-id',
        roomId: document.forms.publish.roomId.value
    }
    socket.send(JSON.stringify(data));
}

let noMoreMessages = false;
socket.onmessage = function (event) {
    var incomingMessage = event.data;
    let data = JSON.parse(incomingMessage);

    if (data.type == 'chat-message') handleMessage(data);
    else if (data.type == 'no-more-messages') noMoreMessages = true;
    else console.log("Incorrect message, parsed: ",data);
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

let oldMessageUpperBound = undefined;
function handleMessage(data) 
{
    app.addMessage(data);
    if (data.isOld) 
        oldMessageUpperBound = oldMessageUpperBound ? Math.min(oldMessageUpperBound,data.id) : data.id;
    let key = document.forms.publish.key.value;
    if (data.encrypted && key && key != '') app.decryptMessage(data.id, key);
}

function sendGetOlderMessagesRequest()
{
    let data = {
        type: 'get-messages',
        range: [undefined, oldMessageUpperBound-1],
        limit: 30
    }
    socket.send(JSON.stringify(data));
}

//Обработчик "бесконечного" скроллинга
setInterval(function() {
    let lastArr = document.querySelectorAll('#subscribe, .message');
    let last = lastArr[lastArr.length-1];
    if (!noMoreMessages && isAnyPartOfElementInViewport(last))
    {     
        sendGetOlderMessagesRequest();
    }
}, 200);

setTimeout(()=>{ app.showEmptySubscribeFeedMessage = true},2000);