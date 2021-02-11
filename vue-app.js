var app = new Vue({
    el: '#subscribe',
    data: {
      messages: [],
      messageHTML: [],
      replyList: []
    },
    methods: {
        addMessage : function(msg)
        {
            let index = 0;
            while (index < this.messages.length && msg.id < this.messages[index].id) ++index;
            if (this.messages[index] && this.messages[index].id == msg.id)
            {
                console.log("Attempted to add a duplicate message! ID: ", msg.id, "Keeping old!");
                return false;
            }

            this.messages.splice(index,0,msg);
            this.renderMessagePromise(msg).then( function(s) {
                app.messageHTML.splice(index,0,s);
            })
            return true;
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

            s += `<div class="message-id">${msg.id}</div>
            <div class="message-datetime">${msg.datetime}</div>
            <div class="message-nick">${msg.nick}</div>`;
            if (msg.replyList)
            {
                //await msg.replyList.forEach(async element => {
                for (let i = 0; i < msg.replyList.length; ++i)
                {
                    let element = msg.replyList[i];
                    let msgObject = await this.getMessageByIdPromise(element);
                    s += '<div class="message-reply">' + await this.renderMessagePromise(msgObject,offset + 1) + "</div>";
                    console.log(s);
                }
            }
            s += `<div class="message-text">${msg.message}</div>
            <a class="message-reply-link" onclick="app.addToReplyList(${msg.id})">Ответить</a>`;
            return s;
        },

        getMessageById : function(id) //returns message object by ID if it is present in array or undefined if it is not.
        {
            let searchResult = this.messages.find(el => { return el.id == id});
            if (searchResult) return searchResult;
            else return undefined;
            //else //todo: add a get-message request from server
        },

        getMessageByIdPromise : function(id) //returns a promise containing a message object by ID. Will try to get a message from database if it is not present in array
        {
            let searchResult = this.getMessageById(id);
            if (searchResult) return new Promise((resolve) => resolve(searchResult));
            else return new Promise( (resolve, reject) => {
                data = { type: "get-messages", id: id };
                socket.send(JSON.stringify(data));

                let result;
                let intervalId = setInterval(function(){
                    result = this.getMessageById(id);
                    if (result)
                    {
                        clearInterval(intervalId);
                        resolve(result);
                    }
                }, 500);
            });
        }
    }
  })

