const Chat = {
    data : () => (
    {
        messages: {},
        replyList: []
    }),
    methods: {
        addMessage : function(msg) //add a message to the list. If a message with this ID is already present in the array, then it will be overwritten by the new one.
        {
            this.messages[msg.id] = {};
            this.messages[msg.id].object = msg;
            this.renderMessagePromise(this.messages[msg.id]).then( (s) => { app.messages[msg.id].html = s; })
            return true;
        },
        
        decryptMessage : function(id, key)
        {
            let msg = this.messages[id];

            let nick = CryptoJS.AES.decrypt(msg.object.nick, key).toString(CryptoJS.enc.Utf8);
            let text = CryptoJS.AES.decrypt(msg.object.message, key).toString(CryptoJS.enc.Utf8);
            msg.object.nick = nick;
            msg.object.message = text;
            msg.object.encrypted = false;
            this.addMessage(msg.object);
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
            for (let i = 0; i < offset; ++i) s += '<div class="message-reply-spacer"></div>';
            if (!msg) return s + "Ошибка: renderMessagePromise вызвано с msg == "+msg;

            s += `<div class="message-id">${msg.object.id}</div>
            <div class="message-datetime">${msg.object.datetime}</div>
            <div class="message-nick">${msg.object.nick}</div>`;
            if (msg.object.replyList)
            {
                for (let i = 0; i < msg.object.replyList.length; ++i)
                {
                    let element = msg.object.replyList[i];
                    let msgObject = await this.getMessageByIdPromise(element);
                    s += '<div class="message-reply">' + await this.renderMessagePromise(msgObject,offset + 1) + "</div>";
                }
            }
            s += `<div class="message-text">${msg.object.message}</div>
            <a class="message-reply-link" onclick="app.addToReplyList(${msg.object.id})">Ответить</a>`;
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
            for (i in this.messages) a.push(this.messages[i]);
            a.sort((a,b) => {return b.object.id - a.object.id});
            return a;
        }
    }
}

var app = Vue.createApp(Chat).mount('#subscribe');