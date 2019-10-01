const safeMath = class {
    static safeSub(x,y) {
        let x_decimals = (x.toString().split(".")[1] != undefined) ? x.toString().split(".")[1].length : 0;
        let y_decimals = (y.toString().split(".")[1] != undefined) ? y.toString().split(".")[1].length : 0;
        let max_decimals = (x_decimals >= y_decimals) ? x_decimals : y_decimals;
        (x_decimals!=0) 
            ? (max_decimals==x_decimals) 
            ? (x = x.toString().split(".")[0]+x.toString().split(".")[1]) 
            : (x = x.toString().split(".")[0]+x.toString().split(".")[1] + new Array(max_decimals-x_decimals).fill(0).join('')) 
            : x = x+""+new Array(max_decimals).fill(0).join('');
        (y_decimals!=0) 
            ? (max_decimals==y_decimals) 
            ? (y = y.toString().split(".")[0]+y.toString().split(".")[1]) 
            : (y = y.toString().split(".")[0]+y.toString().split(".")[1] + new Array(max_decimals-y_decimals).fill(0).join('')) 
            : y = y+""+new Array(max_decimals).fill(0).join('');
        x = parseInt(x);
        y = parseInt(y);
        return (x-y)/10**max_decimals;
    }
    static safeAdd(x,y) {
        let x_decimals = (x.toString().split(".")[1] != undefined) ? x.toString().split(".")[1].length : 0;
        let y_decimals = (y.toString().split(".")[1] != undefined) ? y.toString().split(".")[1].length : 0;
        let max_decimals = (x_decimals >= y_decimals) ? x_decimals : y_decimals;
        (x_decimals!=0) 
            ? (max_decimals==x_decimals) 
            ? (x = x.toString().split(".")[0]+x.toString().split(".")[1]) 
            : (x = x.toString().split(".")[0]+x.toString().split(".")[1] + new Array(max_decimals-x_decimals).fill(0).join('')) 
            : x = x+""+new Array(max_decimals).fill(0).join('');
        (y_decimals!=0) 
            ? (max_decimals==y_decimals) 
            ? (y = y.toString().split(".")[0]+y.toString().split(".")[1]) 
            : (y = y.toString().split(".")[0]+y.toString().split(".")[1] + new Array(max_decimals-y_decimals).fill(0).join('')) 
            : y = y+""+new Array(max_decimals).fill(0).join('');
        x = parseInt(x);
        y = parseInt(y);
        return (x+y)/10**max_decimals;
    }
    static safeMule(x,y) {
        let x_decimals = (x.toString().split(".")[1] != undefined) ? x.toString().split(".")[1].length : 0;
        let y_decimals = (y.toString().split(".")[1] != undefined) ? y.toString().split(".")[1].length : 0;
        (x_decimals!=0) && (x = x.toString().split(".")[0]+x.toString().split(".")[1]);
        (y_decimals!=0) && (y = y.toString().split(".")[0]+y.toString().split(".")[1]);
        return (x*y)/10**(x_decimals+y_decimals);
    }
    static safeDiv(x,y) {
        let x_decimals = (x.toString().split(".")[1] != undefined) ? x.toString().split(".")[1].length : 0;
        let y_decimals = (y.toString().split(".")[1] != undefined) ? y.toString().split(".")[1].length : 0;
        let max_decimals = (x_decimals >= y_decimals) ? x_decimals : y_decimals;
        (x_decimals!=0) 
            ? (max_decimals==x_decimals) 
            ? (x = x.toString().split(".")[0]+x.toString().split(".")[1]) 
            : (x = x.toString().split(".")[0]+x.toString().split(".")[1] + new Array(max_decimals-x_decimals).fill(0).join('')) 
            : x = x+""+new Array(max_decimals).fill(0).join('');
        (y_decimals!=0) 
            ? (max_decimals==y_decimals) 
            ? (y = y.toString().split(".")[0]+y.toString().split(".")[1]) 
            : (y = y.toString().split(".")[0]+y.toString().split(".")[1] + new Array(max_decimals-y_decimals).fill(0).join('')) 
            : y = y+""+new Array(max_decimals).fill(0).join('');
        x = parseInt(x);
        y = parseInt(y);
        return x/y;
    }
}

module.exports = safeMath;
