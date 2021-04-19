import { Interface } from "../node_modules/ethers/lib/utils"

const ethers = require('ethers')
const { toChecksumAddress } = require('ethereumjs-util')
const fs = require('fs')
const { default: ow } = require('ow')

// const VALID_FORMATS = ['jsObject', 'solidityTypes']
// const formatPredicate = ow.string.is(s => VALID_FORMATS.includes(s)).message(value => `Expected valid 'format' (${VALID_FORMATS.join(', ')}) but got ${value}`)


interface typeObject {
  name: string;
  value?: any;
  type?: string;
  components?: any; // TODO figure out this type with more accuracy
}
type arrayTypeObject = Array<arrayTypeObject> | Array<typeObject>

function decodeInput(decoderOrAbi: InputDataDecoder, input: string): Object | null {
  const decoder = !(decoderOrAbi as any).interface
    ? new InputDataDecoder(decoderOrAbi) // ABI was passed
    : decoderOrAbi // Decoder was passed

  const data = (decoder as InputDataDecoder).decodeData(input)
  if (!data || !data.methodName) return null

  return data
}

class InputDataDecoder {
  format: string
  interface: Interface

  constructor(prop: any, format = 'jsObject') {
    try {
      // ow(format, formatPredicate) // TODO: fix this ow bug
    } catch (e) {
      console.log('WARN: Invalid format, defaulting to \'jsObject\' format')
    }

    this.format = format

    // create ethers interface for given abi
    if (typeof prop === 'string') {
      prop = fs.readFileSync(prop)
      this.interface = new ethers.utils.Interface(JSON.parse(prop))
    } else if (prop instanceof Object) {
      this.interface = new ethers.utils.Interface(prop)
    } else {
      throw new TypeError('Must pass ABI array object or file path to constructor')
    }
  }

  decodeData(data: string) {
    try {
      // make tx object needed for some inputs with ethers library
      const tx = { data }
      tx.data = data

      // get verbose decoding / function fragment
      const verboseDecode = this.interface.parseTransaction(tx)

      // returns the parameters for the input
      const rawParams = verboseDecode.args

      // reduce the verbose types from function fragment to slim format
      const types = transformVerboseTypes(verboseDecode.functionFragment.inputs)

      // map our decoded input arguments to their types
      // TODO: remove parsing of value types from this function, into another for clarity
      const params = mapTypesToInputs(types, rawParams)

      // return early if solidity types
      if (this.format === 'solidityTypes') return { methodName: verboseDecode.functionFragment.name, params }

      // here we clean the input to not include types, and improve readability
      const jsObjectParams = transformToJSObject(params)
      return { methodName: verboseDecode.functionFragment.name, params: jsObjectParams }
    } catch (error) {
      // Eat all errors currently, can debug here once we find failed decodings
    }
    return null
  }
}

// Zips inputs to types
function mapTypesToInputs(types: Object, inputs) {
  const params = []
  inputs.forEach((input, i) => {
    if (types[i].type.includes('tuple')) {
      params.push(({
        name: types[i].name,
        type: types[i].type,
        value: handleTuple(types[i], input),
      }))
      return
    }
    const parsedValue = parseCallValue(input, types[i].type)
    params.push({ name: types[i].name, type: types[i].type, value: parsedValue })
  })
  return params
}

function handleTuple(types, inputs) {
  const params = []
  // Check for nested tuples here, flatten out but keep type
  // This is assuming children types of nested tuple arrays are the same as parent
  if (types.type.includes('[]')) {
    // this clone is fast -> https://jsben.ch/bWfk9
    const tempType = Object.assign({}, types)
    tempType.type = tempType.type.slice(0, -2)
    inputs.forEach((input) => {
      params.push(handleTuple(tempType, input))
    })
  } else {
    inputs.forEach((input, i) => {
      const parsedValue = parseCallValue(input, types.components[i].type)
      params.push({
        name: types.components[i].name,
        type: types.components[i].type,
        value: parsedValue,
      })
    })
  }
  return params
}

function parseCallValue(val: any, type: string): any {
  try {
    if (type === 'address') return standardiseAddress(val)
    if (type.includes('address[')) return val.map(a => standardiseAddress(a))
    if (type === 'string' || type.includes('string[')) return val
    if (type.includes('int[')) return val.map(v => v.toString())
    if (type.includes('int256[')) return val.map(v => v.toString())
    if (type.includes('int8[')) return val.map(v => v.toString())
    if (type.includes('int')) return val.toString()
    if (type.includes('bool')) return val
    if (type.includes('bytes32[')) return val
    if (type.includes('bytes[')) return val
    if (type.includes('bytes')) return val
    throw Error(`Unknown type ${type}`)
  } catch (error) {
    throw Error(
      `Failed to decode { type: '${JSON.stringify(
        type,
      )}', val: '${val}', typeof val: '${typeof val}' }: ${error}`,
    )
  }
}

function transformVerboseTypes(inputs: Array<typeObject>): Array<typeObject> {
  // Some funky flattening of tuple arrays (structures in Solidity)
  const typesToReturn = inputs.reduce((acc, obj, index) => {
    if (obj.type.includes('tuple')) {
      acc[index] = { name: obj.name, type: obj.type, components: cleanTupleTypes(obj.components) }
      return acc
    }
    acc[index] = { name: obj.name, type: obj.type }
    return acc
  }, []) as Array<typeObject>

  return typesToReturn
}

function cleanTupleTypes(tupleTypes: Array<typeObject>): Array<Object> {
  return tupleTypes.map(comp => ({ name: comp.name, type: comp.type }))
}

function standardiseAddress(ad: string): string {
  if (!ad.startsWith('0x')) return toChecksumAddress(`0x${ad}`)
  return toChecksumAddress(ad)
}


function transformToJSObjectNested(arr: arrayTypeObject): arrayTypeObject {
  // Check for deeper nesting
  if (Array.isArray(arr[0]) && !((arr as Array<typeObject>)[0]).name) {
    const arrParams = [] as Array<arrayTypeObject>
    arr.forEach((p) => arrParams.push(transformToJSObjectNested(p)))
    return arrParams
  }
  // Check for array leaf value
  if (!Array.isArray(arr[0]) && !arr[0].name) {
    return arr
  }
  // Here complex type arrays are explained which helped type this recursive function
  // https://stackoverflow.com/questions/56884065/typed-arrays-and-union-types
  return (arr as Array<typeObject>).reduce((r, { name, value }) => {
    r[name] = value
    return r
  }, {} as Array<arrayTypeObject>)
}

function transformToJSObject(params: arrayTypeObject): Object {
  const cleanParams = {}
  params.forEach((p: arrayTypeObject | typeObject) => {
    p = p as typeObject // redefine type in this codeblock
    if (Array.isArray((p as typeObject).value)) {
      p.name = !p.name ? '' : p.name
      cleanParams[p.name] = transformToJSObjectNested(p.value)
      return
    }
    cleanParams[p.name] = (p as typeObject).value
  })
  return cleanParams
}

export default {
  InputDataDecoder,
  decodeInput,
}
