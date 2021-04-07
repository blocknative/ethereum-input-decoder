# ethereum-input-decoder

Decodes an Ethereum input data hex string into a developer friendly JavaScript object. Optionally can be translated into an object which includes Solidity types.

## Warning

This package is in alpha, use at your own risk!

## Aim

The goal of ethereum-input-decoder is to facilitate dead-simple conversion of a transaction input into a JavaScript native, serializable object.

## Usage

### Creating a specific decoder object for decoding reuse

Here we create an instance of a decoder using a given ABI, to which we can decode inputs with.
We are also able to choose the output format for decoding in this instance.

```javascript
import InputDataDecoder = from 'ethereum-input-decoder'
const erc20Abi = [{ ... }]
const erc20Decoder = new InputDataDecoder(erc20Abi)
const transferInput = '0xa9059cb000...'
const result = erc20Decoder.decodeData(transferInput)
console.log(result)
```
```javascript
{
  methodName: 'transfer',
  params: {
    _to: '0x5A1Cb5A88988cA4FEF229935db834A6781e873cB',
    _value: '1000000000000000000'
  }
}
```

The `InputDataDecoder` can take a second argument detailing the requested output format.

```javascript
const erc20Decoder = new InputDataDecoder(erc20Abi, 'solidityTypes') // default is 'jsObject'
const result = erc20Decoder.decodeData(transferInput)
console.log(result)
```
```javascript
// solidityTypes format
{
      methodName: 'transfer',
      params: [
        {
          name: '_to',
          type: 'address',
          value: '0x5A1Cb5A88988cA4FEF229935db834A6781e873cB',
        },
        {
          name: '_value',
          type: 'uint256',
          value: '1000000000000000000',
        },
      ],
    }
```

### Passing both the ABI and the input together

Here we pass `decodeInput` both an ABI and an input to receive the decoded output in 'jsObject' format.
This creates the decoder instance each call, it would be recommended to make a decoder instance for each contract
for multiple calls.

```javascript
import decodeInput from 'ethereum-input-decoder'
const erc20Abi = [{ ... }] // this may be an ABI object or an InputDataDecoder instance as above
const transferInput = '0xa9059cb000...'
const result = decodeInput(erc20Abi, transferInput)
```

### Unable to decode example

If the input does not match the ABI, both `decodeInput` and `InputDataDecoder.decodeData()` returns `null`

```javascript
import decodeInput from 'ethereum-input-decoder'
const erc20Abi = [{ ... }]
const failingData = '0xbitconnect'
const result = decoder.decodeData(failingData)
console.log(result)
```
```javascript
null
```

### Usage in node.js

When ES6 imports are not available, you may use `require`

```javascript
const inputToObject = require('ethereum-input-decoder')
```

### Supported types

| Solidity | JavaScript equivalent used
|------|--------|
| int (all variations) | String
| address | String
| string | String
| bool | Boolean
| bytes (all variations) | String (hex formatted)
| tuple | Object (with contents also converted)
| array | Array (with contents also converted)

Using a type not supported? Open an issue.

## Precursor work acknowledgement 

This library is inspired by the great work by Miguel on [ethereum-input-data-decoder](https://github.com/miguelmota/ethereum-input-data-decoder), and fellow Blocknative dev Liam on [ethereum-input-to-object](https://github.com/blocknative/ethereum-input-to-object)

## Todo list
- Ensure contract constructor is decoded
- Add extensive fuzzing testing (maybe)
- Have an available format that does not decode the solidity values at all, ie does not call `parseCallValue()`
- Add error throwing [ 'no matching function', 'incorrect inputs', ... ]

