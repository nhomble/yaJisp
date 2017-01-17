(function(){
    // here so I type less
    var TOKEN_TYPE = {
            SYMBOL: "symbol",
            VAR:    "variable",
            FUNC:   "function"
    };
    function isStartOfExpression (token){ return token == '('; }
    function isEndOfExpression(token){ return  token == ')'; }
    function isWhiteSpace(token){ return token.length == 0; }
    function isFunctionCall(l){ return l[0].type == TOKEN_TYPE.FUNC; }
    function clojure(scope, parent){
        return {
            scope: scope,
            parent: parent,
            get: function(variable){
                if(variable in this.scope)
                    return this.scope[variable];
                else if(this.parent !== undefined)
                    return this.parent.get(variable);
                else
                    console.log(variable + " is undefined!"); // we should handle errors better one day
            }
        };
    }

    function newClojure(parent){
        return clojure({}, parent);
    }

    function identify(token){
        return {
            val:    token,
            type:   TOKEN_TYPE.SYMBOL
        };
    }

    var interpreter = {
        // implemented std lib as needed
        STD_LIB: {
            first: function(args){ return args[0]; }
        },
        REPL_STATE: clojure({}, this.STD_LIB),
        interpret: function(line){
            var tokens = this.tokenize(line);
            console.log(tokens);
            var ast = this.ast(tokens);
            console.log(ast);
            var out = this.eval(ast);
            console.log(out);
            return line;
        },
        eval: function(ast){
            var evalList = function(interpreter, ast, memory){
                var evaluated = ast.map(function(atom){
                    var state = newClojure(memory);
                    return evalHelper(interpreter, ast, state);
                });
                if(isFunctionCall(evaluated))
                    return evaluated[0].val(evaluated.slice(1));
                else
                    return evaluated;
            };
            var evalVar = function(interpreter, node, memory) {
                var variableMeaning = memory.get(node.val);
                if(variableMeaning instanceof Function)
                    return {
                        type: TOKEN_TYPE.FUNC,
                        val: function(args){ return memory.get(node.val).apply(null, args); }
                    };
                else
                    return memory.get(node.val);
            };
            var evalHelper = function(interpreter, node, memory){
                if(node instanceof Array)
                    return evalList(interpreter, node, memory);
                else if(node.type == TOKEN_TYPE.VAR)
                    return evalVar(interpreter, node, memory);
                else
                    return node.val;
            };
            // combine the state of the repl with the std_lib
            var state = newClojure(this.REPL_STATE);
            return evalHelper(this, ast, state);
        },

        // a glorious regex to split things up
        tokenize: function(line){
            return  line
                .replace(/\(/g, ' ( ' )
                .replace(/\)/g, ' ) ' )
                .split(/ +/);
        },
        // parse tokens into abstract syntax tree
        ast: function(tokens){
            // .. Mary Rose Cook.. we can change this later
            astHelper = function(tokens, accum){
                if(tokens.length == 0)
                    return accum.pop();

                var token = tokens.shift();
                if(isStartOfExpression(token)){
                    var childAst = astHelper(tokens, []);
                    accum.push(childAst);
                    return astHelper(tokens, accum);
                }
                else if(isEndOfExpression(token)){
                    return accum;
                }
                else if(isWhiteSpace(token)){
                    return astHelper(tokens, accum);
                }
                else {
                    var node = identify(token);
                    accum.push(node);
                    return astHelper(tokens, accum);
                }
            };

            return astHelper(tokens, []);
        },
        parse: function(line){
            var tokens = this.tokenize(line);
        }
    };

    var repl = document.getElementById("repl");
    repl.disabled = true;

    var lisp = document.getElementById("lisp");
    lisp.onkeypress = function(e){
       if(!e) e = window.event;
       var key = e.keyCode || e.which;
       if(key == '13'){ // on enter
           var new_line = lisp.value;
           interpreter.interpret(new_line, repl);
       }
    };
})();
