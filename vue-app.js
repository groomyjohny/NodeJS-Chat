var app = new Vue({
    el: '#subscribe',
    data: {
      messages: [],
      replyList: []
    },
    methods: {
        addMessage : function(msg, appendToFront)
        {
            let searchResult = this.getMessageById(msg.id);

            if (searchResult)
            {
                console.log("Attempted to add a duplicate message!","Old:",searchResult,"New:",msg,"Keeping old!");
                return false;
            }

            if (appendToFront) this.messages.unshift(msg);
            else this.messages.push(msg);
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

        renderMessage : function(msg, offset = 0)
        {
            if (!msg) return "Ошибка: renderMessage вызвано с msg == "+msg;
            const levelOffset = 1;
            let s = '';
            for (let i = 0; i < offset; ++i) s += '<div class="message-reply-spacer"></div>';
            s += `<div class="message-id">${msg.id}</div>
            <div class="message-datetime">${msg.datetime}</div>
            <div class="message-nick">${msg.nick}</div>`;
            if (msg.replyList)
            {
                msg.replyList.forEach(element => {
                    s += this.renderMessage(this.getMessageById(element),offset + levelOffset)
                });
                for (item in msg.replyList) 
                {
                    
                }
            }
            s += `<div class="message-text">${msg.message}</div>
            <a class="message-reply-link" onclick="app.addToReplyList(${msg.id})">Ответить</a>`;
            return s;
        },

        getMessageById : function(id)
        {
            return this.messages.find( (valInArr) => {
                return valInArr.id == id;
            });
        }
    }
  })

