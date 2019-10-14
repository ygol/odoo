_.str = s;
_.str.sprintf.prototype = Object.assign({}, _.str, sprintf);
