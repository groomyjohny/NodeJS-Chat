var app = new Vue({
    el: '#subscribe',
    data: {
      messages: []
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

        renderMessage : function(msg, offset = 0)
        {
            if (!msg) return "Ошибка: renderMessage вызвано с msg == "+msg;
            const levelOffset = 1;
            let s = '';
            for (let i = 0; i < offset; ++i) s += '<div class="message-reply-spacer"/>';
            s += `<div class="message-id">${msg.id}</div>
            <div class="message-datetime">${msg.datetime}</div>
            <div class="message-nick">${msg.nick}</div>`;
            if (msg.replyList)
            {
                for (item in replyList) 
                {
                    s += this.renderMessage(this.getMessageById(msg[item].id),offset + levelOffset)
                }
            }
            s += `<div class="message-text">${msg.message}</div>
            <a class="message-reply-link">Ответить</a>`;
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

