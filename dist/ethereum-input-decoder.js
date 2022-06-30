'use strict';

var ethers = require('ethers');
require('ethereumjs-util');
var fs = require('fs');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var ethers__default = /*#__PURE__*/_interopDefaultLegacy(ethers);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);

function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function createCommonjsModule(fn, basedir, module) {
	return module = {
	  path: basedir,
	  exports: {},
	  require: function (path, base) {
      return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    }
	}, fn(module, module.exports), module.exports;
}

function commonjsRequire () {
	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
}

var src = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });

const VALID_FORMATS = ["jsObject", "solidityType"];
function decodeInput(decoderOrAbi, input) {
    const decoder = !decoderOrAbi.interface
        ? new InputDataDecoder(decoderOrAbi) // ABI was passed
        : decoderOrAbi; // Decoder was passed
    const data = decoder.decodeData(input);
    if (!data || !data.methodName)
        return null;
    return data;
}
class InputDataDecoder {
    constructor(prop, format = 'jsObject') {
        if (VALID_FORMATS.indexOf(format) < 0) {
            console.log('WARN: Invalid format, defaulting to \'jsObject\' format');
        }
        this.format = format;
        // create ethers interface for given abi
        if (typeof prop === 'string') {
            prop = JSON.parse(fs__default['default'].readFileSync(prop));
            this.interface = new ethers__default['default'].utils.Interface(prop);
        }
        else if (prop instanceof Object) {
            this.interface = new ethers__default['default'].utils.Interface(prop);
        }
        else {
            throw new TypeError('Must pass ABI array object or file path to constructor');
        }
    }
    decodeData(data) {
        try {
            // // make tx object needed for some inputs with ethers library
            // const tx = { data }
            // // get method inputs, method name, 
            // const { args: methodInputs, functionFragment }: { args, functionFragment } = this.interface.parseTransaction(tx)
            // const { inputs: inputTypes, name: methodName } = functionFragment
            // // reduce the verbose types from function fragment to slim format
            // const types = transformVerboseTypes(inputTypes)
            // // map our decoded input arguments to their types
            // const params = mapTypesToInputs(types, methodInputs)
            // // return early if solidity type
            // if (this.format === 'solidityType') return { methodName, params }
            // // here we clean the input to not include types, and improve readability
            // const jsObjectParams = transformToJSObject(params)
            // NEW DECODING?
            // Grab the arguments out via ethers parseTransaction function
            const decodedData = this.interface.parseTransaction({ data });
            const methodName = decodedData.name;
            // Grab the length
            // const inputLength = decodedData.args.length
            // console.log('inputLength: ', inputLength)
            // console.log('frags: ', decodedData.functionFragment.inputs.length)
            // Slice this object
            // const paramsSliced = Object.entries(decodedData.args).slice(inputLength, inputLength * 2)
            // I need to go through entries, taking index(length+i) names (keys) and associating them with the ith values
            // This will keep the 'invisible' names from dissapearing fml
            const entriesFixed = getEntriesCorrected(decodedData.args);
            // Clean up the formatting, un-hex values
            const paramsNew = transformParamsNew(entriesFixed);
            // console.log(JSON.stringify(paramsSliced, null, 2))
            // console.log(JSON.stringify(jsObjectParams, null, 2))
            return { methodName, params: paramsNew };
        }
        catch (error) {
            // Eat all errors currently, can debug here once we find failed decodings
            console.log(error);
        }
        return null;
    }
}
function getEntriesCorrected(argsObject) {
    const inputLength = argsObject.length;
    const entriesFixed = [];
    const entries = Object.entries(argsObject);
    console.log('argsObject: ', argsObject);
    for (let i = 0; i < inputLength; i++) {
        let key;
        let value;
        try {
            // console.log(entries[i + inputLength][0])
            // console.log(entries[i][1])
            key = entries[i + inputLength][0];
        }
        catch (error) {
            // console.log('found empty name')
            // console.log(entries[i][1])
            key = '';
        }
        value = entries[i][1];
        entriesFixed.push([key, value]);
    }
    console.log('entriesFixed');
    console.log(entriesFixed);
    return entriesFixed;
}
function transformParamsNew(params) {
    let resParams = {};
    params.forEach((input) => {
        // console.log(input)
        // Check for special cases, if not, add to resParams
        if (Array.isArray(input[1]) && Array.isArray(input[1][0])) {
            // Found nesting
            // console.log('Need to recurse')
            // console.log(input[1])
            resParams[input[0]] = paramListRecurse(input[1]);
        }
        // @ts-ignore: _isBigNumber won't exist on all values
        else if (input[1] && input[1]._isBigNumber) {
            // Found hex value BigNumber, translate and replace
            resParams[input[0]] = input[1].toString();
        }
        else {
            // No special cases, add to resParams
            resParams[input[0]] = input[1];
        }
        // console.log("--")
    });
    // console.log(JSON.stringify(resParams, null, 2))
    return resParams;
}
function paramListRecurse(input) {
    let resList = [];
    input.forEach(i => {
        // console.log(i, Array.isArray(i))
        // console.log(i[0], Array.isArray(i[0]))
        if (Array.isArray(i) && Array.isArray(i[0])) {
            console.log('this has deeper levels, recursing');
            resList.push(paramListRecurse(i));
        }
        else {
            console.log('typeof i');
            console.log(typeof i);
            console.log('i: ', i);
            const iSliced = getEntriesCorrected(i);
            console.log('\n\nislice:');
            console.log(iSliced);
            console.log('\n\n');
            let resObj = {};
            // iSliced.forEach(n => {
            //   // @ts-ignore: _isBigNumber won't exist on all values
            //   if (n[1] && n[1]._isBigNumber) {
            //     // Found hex value BigNumber, translate and replace
            //     resObj[n[0]] = n[1].toString()
            //   } else {
            //     // No special cases, add to resParams
            //     resObj[n[0]] = n[1]
            //   }
            // })
            // TODO ALEX: testing this below rn!!!
            resObj = transformParamsNew(iSliced);
            console.log('resObj');
            console.log(resObj);
            resList.push(resObj);
        }
    });
    return resList;
}
exports.default = {
    InputDataDecoder,
    decodeInput,
};
//# sourceMappingURL=index.js.map
});

var index = /*@__PURE__*/unwrapExports(src);

module.exports = index;
