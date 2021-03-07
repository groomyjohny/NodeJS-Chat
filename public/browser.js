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

function arrayBufferToWordArray(ab) {
    var i8a = new Uint8Array(ab);
    var a = [];
    for (var i = 0; i < i8a.length; i += 4) {
        a.push(i8a[i] << 24 | i8a[i + 1] << 16 | i8a[i + 2] << 8 | i8a[i + 3]);
    }
    return CryptoJS.lib.WordArray.create(a, i8a.length);
}

// отправить сообщение из формы publish
document.forms.publish.addEventListener("submit", function (event) {
    event.preventDefault();    
    let form = this;
    let key = this.key.value;
    let cipherMessage = this.message.value;
    let cipherNick = this.nick.value;
    let roomId = this.roomId.value;
    let encrypted = false;

    let files = document.getElementById('files').files;
    let fileContent = [];
    for (let i = 0; i < files.length; ++i)
    {
        let f = files[i];
        let reader = new FileReader(f);
        reader.onload = (ev) => {
            let isEncrypted = false;
            if (key) 
            {
                content = CryptoJS.AES.encrypt(arrayBufferToWordArray(reader.result), key).toString();
                isEncrypted = true;
            }
            fileContent.push({type: f.type, content: content, encrypted: isEncrypted});
            if (i >= files.length-1) finalizeAndSendMessage(); //if this is the last file, then finalize and send
        }
        reader.readAsArrayBuffer(f);             
    }
    if (!files.length) finalizeAndSendMessage(); //if no files were added, then finalize has not been called yet, so we have to do it here

    function finalizeAndSendMessage()
    {
        if (key && key != '')
        {
            cipherNick = CryptoJS.AES.encrypt(cipherNick, key);
            cipherMessage = CryptoJS.AES.encrypt(cipherMessage, key);

            cipherNick = cipherNick.toString();
            cipherMessage = cipherMessage.toString();
            encrypted = true;
        }
        let data = { type: 'chat-message', nick: cipherNick, message: cipherMessage, replyList: app.getReplyList(), encrypted: encrypted, roomId: roomId, attachmentList: fileContent };
        app.clearReplyList();

        localStorage.setItem('savedNick',form.nick.value);
        let msg = JSON.stringify(data);
        document.getElementById("message-area").value = '';
        if (document.getElementById("save-key-checkbox").checked) saveKeys();

        socket.send(msg);
    }
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
    else if (data.type == 'attachment-info') handleAttachmentInfo(data);
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
    if (data.attachments && data.attachments.length) sendGetAttachmentsRequest(data.attachments);
}

let attachments = {}

function i32array_to_u8array(arr)
{
    let interm = [];
    for (el of arr)
    {       
        interm.push((el & 0xFF000000) >> 24);
        interm.push((el & 0x00FF0000) >> 16);
        interm.push((el & 0x0000FF00) >> 8);
        interm.push(el & 0x000000FF);
    }
    return new Uint8Array(interm);
}
function handleAttachmentInfo(data)
{
    data.info.forEach(el => {
        let attachmentsPath = '/public/attachments/';
        app.messages[el.msgId].attachments = app.messages[el.msgId].attachments || [];
        app.messages[el.msgId].attachments.push(el);
        fetch(attachmentsPath+el.fileName).then( (response) => { return response.arrayBuffer() }).then( (buffer) => {
            let content;
            if (el.encrypted)
            {
                let key = document.forms.publish.key.value;
                let wa = arrayBufferToWordArray(buffer);
                let str = wa.toString(CryptoJS.enc.Base64);
                let decrypted = CryptoJS.AES.decrypt(str, key);
                //content = new Uint8Array.from(decrypted.words);
                content = i32array_to_u8array(decrypted.words);             
            }
            else 
                content = new Uint8Array(buffer);

            //let arrayBufferView = new Uint8Array(content);
            
            let blob = new Blob( [ content ], { type: el.type } );
            el.blobURL = window.URL.createObjectURL(blob);
            app.redrawMessage(el.msgId);
        });
    });
}

function sendGetAttachmentsRequest(attachments)
{
    let request = {type: "get-attachment-info", ids: attachments};
    socket.send(JSON.stringify(request));
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

function toggleMenuVisibility()
{
    let link = document.getElementById('menu-toggle-link');
    let s = document.getElementById('menu').style;
    if (s.display == 'none') 
    {
        s.display = 'block';
        link.innerHTML = "Скрыть меню";
    }
    else 
    {
        s.display = 'none';
        link.innerHTML = "Показать меню";
    }
}
let saveKeyCheckbox = document.getElementById("save-key-checkbox");
saveKeyCheckbox.addEventListener("click", warnAboutKeyStorage);
function warnAboutKeyStorage(event)
{
    let result = false;
    if (!saveKeyCheckbox.checked) return; //do NOT remove exclamation mark.        
    let confirmResult = confirm("При выборе этого пункта, введенный в поле ключ шифрования будет записываться в LocalStorage в зашифрованном виде. Для его расшифровки будет нужен пароль, который будет запрошен позже и не будет сохраняться или отправляться на сервер. Внутри сессии хэш пароля будет сохранен в sessionStorage вашего браузера.\n\nПри утере пароля восстановить его будет невозможно! Для продолжения нажмите ОК.");
    if (!confirmResult) return false;
    if (!sessionStorage.passwordHash && confirmResult)
    {                
        result = setPassword();
        if (result) decryptKeys();
    }
    else if (sessionStorage.passwordHash) result = true;
    saveKeyCheckbox.checked = result;
    saveKeys();
}

function setPassword()
{
    let pass = prompt("Введите пароль, который будет использоваться для шифрования ключа").toString();
    if (!pass) return false;
    let conf = prompt("Введите пароль ещё раз").toString();
    if (!conf) return false;
    if (pass != conf) 
    {
        alert("Введенные пароли не совпадают.");
        return false;
    }
    sessionStorage.passwordHash = CryptoJS.SHA256(pass).toString();
    return true;
}

function decryptKeys()
{
    try 
    {
        if (!localStorage.savedKey) alert("В localStorage нет ключей.");
        if (!sessionStorage.passwordHash && !setPassword()) return;
        document.forms.publish.key.value = CryptoJS.AES.decrypt(localStorage.savedKey, sessionStorage.passwordHash).toString(CryptoJS.enc.Utf8);
        decryptMessages();
    }
    catch (err)
    {
        alert("Ошибка при расшифровке ключей: "+err);
    }
}

function saveKeys()
{
    try 
    {
        let key = document.forms.publish.key.value;
        if (!sessionStorage.passwordHash || !key) return;
        localStorage.savedKey = CryptoJS.AES.encrypt(key, sessionStorage.passwordHash);
    }
    catch (err)
    {
        console.error("Error saving key: ",err)
    }
}
function removeKeyFromLocalStorage()
{
    if (confirm("Вы действительно хотите удалить сохранённый ключ?\n\nВНИМАНИЕ: если ключ будет утерян, то зашифрованные им сообщения расшифровать будет невозможно. После подтверждения ключ будет удалён из LocalStorage, но останется в поле для ввода. Если он у вас не сохранён где-либо ещё, обязательно сохраните его сразу после закрытия этого сообщения.")) localStorage.removeItem('savedKey');
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