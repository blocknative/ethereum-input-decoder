"use strict";
exports.__esModule = true;
var ethers = require('ethers');
var toChecksumAddress = require('ethereumjs-util').toChecksumAddress;
var fs = require('fs');
var ow = require('ow')["default"];
function decodeInput(decoderOrAbi, input) {
    var decoder = !decoderOrAbi.interface
        ? new InputDataDecoder(decoderOrAbi) // ABI was passed
        : decoderOrAbi; // Decoder was passed
    var data = decoder.decodeData(input);
    if (!data || !data.methodName)
        return null;
    return data;
}
var InputDataDecoder = /** @class */ (function () {
    function InputDataDecoder(prop, format) {
        if (format === void 0) { format = 'jsObject'; }
        try {
            // ow(format, formatPredicate)
        }
        catch (e) {
            console.log('WARN: Invalid format, defaulting to \'jsObject\' format');
        }
        this.format = format;
        // create ethers interface for given abi
        if (typeof prop === 'string') {
            prop = fs.readFileSync(prop);
            this.interface = new ethers.utils.Interface(JSON.parse(prop));
        }
        else if (prop instanceof Object) {
            this.interface = new ethers.utils.Interface(prop);
        }
        else {
            throw new TypeError('Must pass ABI array object or file path to constructor');
        }
    }
    InputDataDecoder.prototype.decodeData = function (data) {
        try {
            // make tx object needed for some inputs with ethers library
            var tx = { data: data };
            tx.data = data;
            // get verbose decoding / function fragment
            var verboseDecode = this.interface.parseTransaction(tx);
            // returns the parameters for the input
            var rawParams = verboseDecode.args;
            // reduce the verbose types from function fragment to slim format
            var types = transformVerboseTypes(verboseDecode.functionFragment.inputs);
            // map our decoded input arguments to their types
            // TODO: remove parsing of value types from this function, into another for clarity
            var params = mapTypesToInputs(types, rawParams);
            // return early if solidity types
            if (this.format === 'solidityTypes')
                return { methodName: verboseDecode.functionFragment.name, params: params };
            // here we clean the input to not include types, and improve readability
            var jsObjectParams = transformToJSObject(params);
            return { methodName: verboseDecode.functionFragment.name, params: jsObjectParams };
        }
        catch (error) {
            // Eat all errors currently, can debug here once we find failed decodings
        }
        return null;
    };
    return InputDataDecoder;
}());
// Zips inputs to types
function mapTypesToInputs(types, inputs) {
    var params = [];
    inputs.forEach(function (input, i) {
        if (types[i].type.includes('tuple')) {
            params.push(({
                name: types[i].name,
                type: types[i].type,
                value: handleTuple(types[i], input)
            }));
            return;
        }
        var parsedValue = parseCallValue(input, types[i].type);
        params.push({ name: types[i].name, type: types[i].type, value: parsedValue });
    });
    return params;
}
function handleTuple(types, inputs) {
    var params = [];
    // Check for nested tuples here, flatten out but keep type
    // This is assuming children types of nested tuple arrays are the same as parent
    if (types.type.includes('[]')) {
        // this clone is fast -> https://jsben.ch/bWfk9
        var tempType_1 = Object.assign({}, types);
        tempType_1.type = tempType_1.type.slice(0, -2);
        inputs.forEach(function (input) {
            params.push(handleTuple(tempType_1, input));
        });
    }
    else {
        inputs.forEach(function (input, i) {
            var parsedValue = parseCallValue(input, types.components[i].type);
            params.push({
                name: types.components[i].name,
                type: types.components[i].type,
                value: parsedValue
            });
        });
    }
    return params;
}
function parseCallValue(val, type) {
    try {
        if (type === 'address')
            return standardiseAddress(val);
        if (type.includes('address['))
            return val.map(function (a) { return standardiseAddress(a); });
        if (type === 'string' || type.includes('string['))
            return val;
        if (type.includes('int['))
            return val.map(function (v) { return v.toString(); });
        if (type.includes('int256['))
            return val.map(function (v) { return v.toString(); });
        if (type.includes('int8['))
            return val.map(function (v) { return v.toString(); });
        if (type.includes('int'))
            return val.toString();
        if (type.includes('bool'))
            return val;
        if (type.includes('bytes32['))
            return val;
        if (type.includes('bytes['))
            return val;
        if (type.includes('bytes'))
            return val;
        throw Error("Unknown type " + type);
    }
    catch (error) {
        throw Error("Failed to decode { type: '" + JSON.stringify(type) + "', val: '" + val + "', typeof val: '" + typeof val + "' }: " + error);
    }
}
function transformVerboseTypes(inputs) {
    // Some funky flattening of tuple arrays (structures in Solidity)
    var typesToReturn = inputs.reduce(function (acc, obj, index) {
        if (obj.type.includes('tuple')) {
            acc[index] = { name: obj.name, type: obj.type, components: cleanTupleTypes(obj.components) };
            return acc;
        }
        acc[index] = { name: obj.name, type: obj.type };
        return acc;
    }, []);
    return typesToReturn;
}
function cleanTupleTypes(tupleTypes) {
    return tupleTypes.map(function (comp) { return ({ name: comp.name, type: comp.type }); });
}
function standardiseAddress(ad) {
    if (!ad.startsWith('0x'))
        return toChecksumAddress("0x" + ad);
    return toChecksumAddress(ad);
}
function transformToJSObjectNested(arr) {
    // Check for deeper nesting
    if (Array.isArray(arr[0]) && !(arr[0]).name) {
        var arrParams_1 = [];
        arr.forEach(function (p) { return arrParams_1.push(transformToJSObjectNested(p)); });
        return arrParams_1;
    }
    // Check for array leaf value
    if (!Array.isArray(arr[0]) && !arr[0].name) {
        return arr;
    }
    // Here complex type arrays are explained which helped type this recursive function
    // https://stackoverflow.com/questions/56884065/typed-arrays-and-union-types
    return arr.reduce(function (r, _a) {
        var name = _a.name, value = _a.value;
        r[name] = value;
        return r;
    }, {});
}
function transformToJSObject(params) {
    var cleanParams = {};
    params.forEach(function (p) {
        p = p; // redefine type in this codeblock
        if (Array.isArray(p.value)) {
            p.name = !p.name ? '' : p.name;
            cleanParams[p.name] = transformToJSObjectNested(p.value);
            return;
        }
        cleanParams[p.name] = p.value;
    });
    return cleanParams;
}
exports["default"] = {
    InputDataDecoder: InputDataDecoder,
    decodeInput: decodeInput
};
