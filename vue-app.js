var app = new Vue({
    el: '#subscribe',
    data: {
      messages: []
    },
    methods: {
        addMessage : function(msg, appendToFront)
        {
            let searchResult = this.messages.find( (valInArr) => {
                return valInArr.id == msg.id;
            });

            if (searchResult)
            {
                console.log("Attempted to add a duplicate message!","Old:",searchResult,"New:",msg,"Keeping old!");
                return false;
            }

            if (appendToFront) this.messages.unshift(msg);
            else this.messages.push(msg);
        }
    }
  })

