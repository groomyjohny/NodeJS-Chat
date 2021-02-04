if (!window.WebSocket) {
	document.body.innerHTML = 'WebSocket в этом браузере не поддерживается.';
}

// создать подключение
var socket = new WebSocket("ws://localhost:8081");

// отправить сообщение из формы publish
document.forms.publish.onsubmit = function() {
  var outgoingMessage = this.message.value;
  let data = {nick: this.nick.value, message: outgoingMessage};
  let msg = JSON.stringify(data);

  socket.send(msg);
  return false;
};

// обработчик входящих сообщений
socket.onmessage = function(event) {
  var incomingMessage = event.data;
  showMessage(incomingMessage); 
};

// показать сообщение в div#subscribe
function showMessage(message) {
  let data = JSON.parse(message);
  let code = '<div class="message"><div class="message-nick">' + data.nick + '</div><div class="message-text">'+data.message + '</div></div>'
  document.getElementById('subscribe').innerHTML += code;
}