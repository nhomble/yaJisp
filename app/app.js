(function () {
    // here so I type less
    var TOKEN_TYPE = {
        LITERAL: "literal",
        VAR: "variable",
        FUNC: "function",
        LIST: "list"
    };
    // shouldn't have to repeat get
    var STD_LIB = {
        scope: {
            first: function (args) {
                return args[0].val[0].val;
            },
            second: function (args) {
                return (args[0].val.length > 1) ? args[0].val[1].val : null;
            },
            last: function (args) {
                return args[0].val.slice(-1)[0].val;
            },
            sum: function (args) {
                return args[0].val.reduce(function (acc, val) {
                    return acc + parseInt(val);
                }, 0);
            },
            product: function (args) {
                return args[0].val.reduce(function (acc, val) {
                    return acc * parseInt(val);
                }, 1);
            },
            "+": function (args) {
                return parseInt(args[0].val) + parseInt(args[1].val);
            },
            "-": function (args) {
                return parseInt(args[0].val) - parseInt(args[1].val);
            },
            "*": function (args) {
                return parseInt(args[0].val) * parseInt(args[1].val);
            },
            "/": function (args) {
                return parseFloat(args[0].val) / parseFloat(args[1].val);
            },
            ">": function (args) {
                return args[0].val > args[1].val;
            },
            "<": function (args) {
                return args[0].val < args[1].val;
            },
            "<=": function (args) {
                return args[0].val <= args[1].val;
            },
            ">=": function (args) {
                return args[0].val >= args[1].val;
            },
            define: function(args){
                this.save(args[0].name, args[1].val);
                return args[1].val;
            }
        },
        get: function (variable) {
            if (variable in this.scope)
                return this.scope[variable];
            else if (this.parent !== undefined)
                return this.parent.get(variable);
            else
                console.log(variable + " is undefined!"); // we should handle errors better one day
        }
    };

    function isStartOfExpression(token) {
        return token == '(';
    }

    function isEndOfExpression(token) {
        return token == ')';
    }

    function isWhiteSpace(token) {
        return token.length == 0;
    }

    function isFunctionCall(l) {
        return l[0].type == TOKEN_TYPE.FUNC;
    }

    function isNumeric(n) {
        return !isNaN(parseFloat(n));
    }

    function isString(s) {
        return s[0] === '"' && s.slice(-1) === '"';
    }

    function clojure(scope, parent) {
        return {
            scope: scope,
            parent: parent,
            get: function (variable) {
                if (variable in this.scope)
                    return this.scope[variable];
                else if (this.parent !== undefined)
                    return this.parent.get(variable);
                else
                    console.log(variable + " is undefined!"); // we should handle errors better one day
            },
            save: function(k, v){
                this.parent.scope[k] = v;
            }
        };
    }

    function newClojure(parent) {
        return clojure({}, parent);
    }

    function parse(tokens) {
        // .. Mary Rose Cook.. we can change this later
        astHelper = function (tokens, accum) {
            if (tokens.length == 0)
                return accum.pop();

            var token = tokens.shift();
            if (isStartOfExpression(token)) {
                var childAst = astHelper(tokens, []);
                accum.push(childAst);
                return astHelper(tokens, accum);
            }
            else if (isEndOfExpression(token)) {
                return accum;
            }
            else if (isWhiteSpace(token)) {
                return astHelper(tokens, accum);
            }
            else {
                var node = identify(token);
                accum.push(node);
                return astHelper(tokens, accum);
            }
        };

        return astHelper(tokens, []);
    }

    // a glorious regex to split things up
    function tokenize(line) {
        return line
            .replace(/\(/g, ' ( ')
            .replace(/\)/g, ' ) ')
            .split(/ +/);
    }

    // we only need to discern vars from symbols, funcs are determined based on the clojure
    function identify(token) {
        var token_type;
        if (isNumeric(token) || isString(token)) {
            token_type = TOKEN_TYPE.LITERAL;
            if (isNumeric(token))
                token = parseFloat(token);
        }
        else
            token_type = TOKEN_TYPE.VAR;
        return {
            val: token,
            type: token_type
        };
    }

    function replaceBodyWithVals(body, def, args){
        var d = def.map(function(e){ return e.val; });
        if(body instanceof Array){
            return body.map(function(e){ return replaceBodyWithVals(e, def, args);});
        }
        else{
            if((i = d.indexOf(body.val)) >= 0){
                return {
                    type: TOKEN_TYPE.LITERAL,
                    val: args[i].val
                };
            }
            return body;
        }
    }

    var interpreter = {
        REPL_STATE: newClojure(STD_LIB),
        interpret: function (line) {
            var tokens = tokenize(line);
            var ast = parse(tokens);
            return this.eval(ast).val;
        },
        eval: function (ast) {
            var evalList = function (interpreter, ast, memory) {
                if(ast[0].val == "defun"){
                    var funcName = ast[1].val;
                    var defArgs = ast[2];
                    var body = ast[3];
                    memory.save(funcName, function(args){
                        var replaced = replaceBodyWithVals(body, defArgs, args);
                        return evalHelper(interpreter, replaced, memory).val;
                    });
                    return funcName;
                }
                else if(ast[0].val == "if"){
                    if (evalHelper(interpreter, ast[1], newClojure(memory)).val)
                        return evalHelper(interpreter, ast[2], newClojure(memory)).val;
                    else
                        return evalHelper(interpreter, ast[3], newClojure(memory)).val;
                }
                var evaluated = ast.map(function (atom) {
                    return evalHelper(interpreter, atom, memory);
                });

                if (isFunctionCall(evaluated)) {
                    return evaluated[0].val(evaluated.slice(1));
                }
                else {
                    return evaluated;
                }
            };
            var evalVar = function (interpreter, node, memory) {
                // look up the variable
                var variableMeaning = memory.get(node.val);
                // create a clojure to a function
                if (variableMeaning instanceof Function)
                    return {
                        type: TOKEN_TYPE.FUNC,
                        name: node.val,
                        val: function (args) {
                            return memory.get(node.val).call(memory, args);
                        }
                    };
                else
                    return {
                        type: TOKEN_TYPE.VAR,
                        name: node.val,
                        node: node,
                        val: memory.get(node.val)
                    };
            };
            var evalHelper = function (interpreter, node, memory) {
                if (node instanceof Array) {
                    return {
                        type: TOKEN_TYPE.LIST,
                        val: evalList(interpreter, node, memory),
                        node: node
                    };
                }
                else if (node.type == TOKEN_TYPE.VAR) {
                    return evalVar(interpreter, node, memory);
                }
                else if (node.type == TOKEN_TYPE.LITERAL) {
                    return {
                        type: TOKEN_TYPE.LITERAL,
                        val: node.val,
                        node: node
                    };
                }
                else
                    alert("WE FELL OUT OF THE BLOCK????? HOW????? " + node.type);
            };
            // combine the state of the repl with the std_lib
            var state = newClojure(this.REPL_STATE);
            return evalHelper(this, ast, state);
        }
    };

    var repl = document.getElementById("repl");
    repl.disabled = true;

    var lisp = document.getElementById("lisp");
    lisp.onkeypress = function (e) {
        if (!e) e = window.event;
        var key = e.keyCode || e.which;
        if (key == '13') { // on enter
            var new_line = lisp.value;
            var output = interpreter.interpret(new_line, repl);
            console.log("interpreter output: " + output);

            repl.value += "> " + new_line + "\n";
            repl.value += output + "\n";
        }
    };
})();
