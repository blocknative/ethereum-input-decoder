/* eslint-disable no-sequences */
/* eslint-disable no-return-assign */
const ethers = require('ethers')
const { toChecksumAddress } = require('ethereumjs-util')
const fs = require('fs')
const bytesToHex = require('web3-utils')

function decodeInput(decoderOrAbi, input) {
  const decoder = !decoderOrAbi.interface
    ? new InputDataDecoder(decoderOrAbi) // ABI was passed
    : decoderOrAbi // Decoder was passed

  const data = safeDecode(decoder, input)
  if (!data || !data.methodName) return null

  return data
}

function safeDecode(decoder, input) {
  let decodedInput = { method: null }
  try {
    decodedInput = decoder.decodeData(input)
  } catch (error) {
    // Input was invalid, swallow error
  }
  return decodedInput
}

class InputDataDecoder {
  constructor(prop) {
    this.abi = []

    if (typeof prop === 'string') {
      // TODO: remove dupe fs reading code here
      this.abi = JSON.parse(fs.readFileSync(prop), 'utf8')
      this.interface = new ethers.utils.Interface(JSON.parse(fs.readFileSync(prop)))
    } else if (prop instanceof Object) {
      this.abi = prop
      this.interface = new ethers.utils.Interface(prop)
    } else {
      throw new TypeError('Must pass ABI array object or file path to constructor')
    }
  }

  decodeData(data) {
    // TODO: wrap this all in a try catch for errors

    // make tx object needed for some inputs with ethers library -> might be a way to clean this up
    const tx = {}
    tx.data = data

    // get method signature
    const methodId = tx.data.slice(0, 10)

    // get the decoded inputs
    const inputs = this.interface.decodeFunctionData(methodId, tx.data)

    // get the input arguments in satisfying format
    const txDesc = this.interface.parseTransaction(tx)

    // clean the input type object due to complex tuple structures
    const types = cleanInputs(txDesc.functionFragment.inputs)

    // map our decoded input arguments to their types
    // this form may be useful to other people as it does not decode the inputs, and keeps the types
    const params = mapTypesToInputs(types, inputs)

    // here we clean the input to match BN payloads
    const blocknativeParams = cleanToBNStandard(params)

    return { methodName: txDesc.functionFragment.name, params: blocknativeParams }
  }
}

// Zips inputs to types
function mapTypesToInputs(types, inputs) {
  const params = []
  inputs.forEach((input, i) => {
    if (types[i].type.includes('tuple')) {
      params.push({
        name: types[i].name,
        type: types[i].type,
        value: handleTuple(types[i], input),
      })

      return
    }
    const parsedValue = parseCallValue(input, types[i].type)
    params.push({ name: types[i].name, value: parsedValue })
  })
  return params
}

function handleTuple(types, inputs) {
  const params = []
  // Check for nested tuples here, flatten out but keep type
  if (types.type.includes('[]')) {
    const tempType = types
    tempType.type = tempType.type.slice(0, -2)
    inputs.forEach((input) => { params.push(handleTuple(tempType, input)) })
    return params
  }
  inputs.forEach((input, i) => {
    const parsedValue = parseCallValue(input, types.components[i].type)
    params.push({ name: types.components[i].name, value: parsedValue })
  })
  return params
}

function parseCallValue(val, type) {
  try {
    if (type === 'address') return standardiseAddress(val)
    if (type.includes('address[')) return val.map(a => standardiseAddress(a))
    if (type === 'string' || type.includes('string[')) return val
    if (type.includes('int[')) return val.map(v => v.toString())
    if (type.includes('int256[')) return val.map(v => v.toString())
    if (type.includes('int8[')) return val.map(v => v.toString())
    if (type.includes('int')) return val.toString()
    if (type.includes('bool')) return val

    // Sometimes our decoder library does not decode bytes correctly and returns buffers
    // Here we safe gaurd this as to not double decode them.
    if (type.includes('bytes32[')) {
      return val.map((b) => {
        if (typeof b === 'string') {
          return b
        }
        return bytesToHex(b)
      })
    }
    if (type.includes('bytes[')) {
      return val.map((b) => {
        if (typeof b === 'string') {
          return b
        }
        return bytesToHex(b)
      })
    }
    if (type.includes('bytes')) {
      if (typeof val === 'string') {
        return val
      }
      return bytesToHex(val)
    }
    throw Error(`Unknown type ${type}`)
  } catch (error) {
    throw Error(
      `Failed to decode { type: '${JSON.stringify(
        type,
      )}', val: '${val}', typeof val: '${typeof val}' }: ${error}`,
    )
  }
}

function cleanInputs(inputs) {
  // Some funky flattening of tuple arrays (structures in Solidity)
  const typesToReturn = inputs.reduce((acc, obj, index) => {
    if (obj.type.includes('tuple')) {
      acc[index] = { name: obj.name, type: obj.type, components: cleanTupleTypes(obj.components) }
      return acc
    }
    acc[index] = { name: obj.name, type: obj.type }
    return acc
  }, [])

  return typesToReturn
}

function cleanTupleTypes(tupleTypes) {
  return tupleTypes.map(comp => ({ name: comp.name, type: comp.type }))
}

function standardiseAddress(ad) {
  if (!ad.startsWith('0x')) return toChecksumAddress(`0x${ad}`)
  return toChecksumAddress(ad)
}

function cleanToBNStandardNested(arr) {
  // Check for deeper nesting
  if (Array.isArray(arr[0]) && !arr[0].name) {
    const arrParams = []
    arr.forEach((p) => { arrParams.push(cleanToBNStandardNested(p)) })
    return arrParams
  }
  // Check for array leaf value
  if (!Array.isArray(arr[0]) && !arr[0].name) {
    return arr
  }

  return arr.reduce((r, { name, value }) => (r[name] = value, r), {})
}

function cleanToBNStandard(params) {
  const cleanParams = {}
  params.forEach((p) => {
    if (Array.isArray(p.value)) {
      p.name = !p.name ? '' : p.name
      cleanParams[p.name] = cleanToBNStandardNested(p.value)
      return
    }
    cleanParams[p.name] = p.value
  })
  return cleanParams
}

module.exports = {
  InputDataDecoder,
  decodeInput,
}
