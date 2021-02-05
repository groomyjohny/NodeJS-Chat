var app = new Vue({
    el: '#subscribe',
    data: {
      messages: []
    },
    methods: {
        addMessage : function(msg, appendToFront)
        {
            if (appendToFront) this.messages.unshift(msg);
            else this.messages.push(msg);
        }
    }
  })

