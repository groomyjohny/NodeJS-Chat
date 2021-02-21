const Chat = {
    data : () => (
    {
        messages: {},
        dependants: {},
        replyList: []
    }),
    methods: {
        addMessage : function(msgObject) //add a message to the list. If a message with this ID is already present in the array, then it will be overwritten by the new one.
        {
            if (!this.messages[msgObject.id]) this.messages[msgObject.id] = {};            
            this.messages[msgObject.id].object = msgObject;
            if (msgObject.replyList) msgObject.replyList.forEach(el => {
                this.dependants[el] = this.dependants[el] || [];
                this.dependants[el].push(msgObject.id);
            });
            this.redrawMessage(msgObject.id);
            return true;
        },
        
        decryptMessage : function(id, key)
        {
            let msg;
            try
            {
                msg = this.messages[id];
                let nick = CryptoJS.AES.decrypt(msg.object.nick, key).toString(CryptoJS.enc.Utf8);
                let text = CryptoJS.AES.decrypt(msg.object.message, key).toString(CryptoJS.enc.Utf8);
                if (!nick || !text) throw new Error("Decryption failed: nick or message is empty");

                msg.object.nick = nick;
                msg.object.message = text;
                msg.object.encrypted = false;
                msg.decryptStatus = 'success';
                this.addMessage(msg.object);
            }
            catch (err)
            {
                console.log("Error while decrypting message: ",err);
                if (msg) 
                {
                    this.messages[id].object.encrypted = true;          
                    this.messages[id].decryptStatus = 'fail';
                    this.redrawMessage(id);
                }
            }
        },

        redrawMessage : function(id)
        {
            let msg = this.getMessageById(id);
            this.renderMessagePromise(msg).then( (s) => { 
                app.messages[id].html = s;
                if (app.dependants[id]) app.dependants[id].forEach(dId => app.redrawMessage(dId));
            });
        },

        addToReplyList : function(id)
        {
            if (!this.getMessageById(id)) console.log("Attempted to add wrong id to reply list", id, ", ignoring.")
            else 
                if (this.replyList.find( (valInArr) => {return valInArr == id}))
                    console.log("Attempted to add duplicate id to reply list", id, ", ignoring.");
                else
                    this.replyList.push(id);
        },

        getReplyList : function () 
        {
            return this.replyList;    
        },

        clearReplyList : function () 
        {
            this.replyList = [];    
        },

        renderMessagePromise : async function(msg, offset = 0)
        {
            let s = '';
            for (let i = 0; i < offset; ++i) s += '<div class="message-reply-spacer">&nbsp;</div>';
            if (!msg) return s + "Ошибка: renderMessagePromise вызвано с msg == "+msg;

            let messageText = msg.object.encrypted ? "Это сообщение зашифровано." : msg.object.message;
            let messageNick = msg.object.encrypted ? '' : msg.object.nick;
            s += `<div class="message-id">${msg.object.id}</div>
            <div class="message-datetime">${msg.object.datetime}</div>            
            <div class="message-nick">${messageNick}</div>`;
            if (msg.object.replyList)
            {
                for (let i = 0; i < msg.object.replyList.length; ++i)
                {
                    let element = msg.object.replyList[i];
                    let msgObject = await this.getMessageByIdPromise(element);
                    s += '<div class="message-reply">' + await this.renderMessagePromise(msgObject,offset + 1) + "</div>";
                }
            }

            s += `<div class="message-text">${messageText}</div>
            <a class="message-reply-link" onclick="app.addToReplyList(${msg.object.id})">Ответить</a>`;

            let decryptStatusIcon = "/public/img/";            
            let decryptStatusCaption;   
            if (!msg.object.encrypted && !msg.decryptStatus) //message was not encrypted originally
            {
                decryptStatusIcon += 'message_not_encrypted.png';
                decryptStatusCaption = "Это сообщение не шифровалось.";
            } 
            else if (msg.decryptStatus) //message was encrypted and attempt to decrypt was made
            {                        
                decryptStatusIcon += msg.decryptStatus == 'fail' ? "decryption_failed.png" : "decryption_succeeded.png";
                decryptStatusCaption = msg.decryptStatus == 'fail' ? "Не удалось расшифровать сообщение введенным ключом." : "Сообщение расшифровано с помощью введенного ключа.";   
            }
            else //message was encrypted, but no decrypt attempts were made.
            {
                decryptStatusIcon += "decryption_not_attempted.png";
                decryptStatusCaption = "Сообщение зашифровано, попыток расшифрования не осуществлялось.";
            }
            s += `<img class="message-decrypt-status-icon" src="${decryptStatusIcon}" title="${decryptStatusCaption}"></img>`;
            return s;
        },

        getMessageById : function(id) //returns message object by ID if it is present in array or undefined if it is not.
        {
            return this.messages[id];
        },

        getMessageByIdPromise : function(id) //returns a promise containing a message object by ID. Will try to get a message from database if it is not present in array
        {
            let searchResult = this.getMessageById(id);           
            if (searchResult) return searchResult;
            else return new Promise( (resolve, reject) => {
                data = { type: "get-messages", id: id };
                socket.send(JSON.stringify(data));

                let result;
                let intervalId = setInterval(function(){
                    result = app.getMessageById(id);
                    if (result)
                    {
                        clearInterval(intervalId);
                        resolve(result);
                    }
                }, 500);
            });
        }
    },

    computed: {
        messageList : function()
        {
            let a = [];
            for (i in this.messages) 
                if (!this.messages[i].hidden)
                    a.push(this.messages[i]);
            a.sort((a,b) => {return b.object.id - a.object.id});
            return a;
        }
    }
}

var app = Vue.createApp(Chat).mount('#subscribe');