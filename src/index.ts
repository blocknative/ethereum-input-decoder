import { Interface } from "../node_modules/ethers/lib/utils"

const ethers = require('ethers')
const { toChecksumAddress } = require('ethereumjs-util')
const fs = require('fs')

interface bigNType {
  type: string;
  hex: string;
}
type methodInputsType = Array<methodInputsType> | Array<String | bigNType>

interface typesObject {
  name: string;
  type: string;
  components?: Array<typesObject>;
}

interface solidityObject extends typesObject {
  value: any;
}

const VALID_FORMATS = ["jsObject", "solidityType"]


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

  constructor(prop: string | Object, format: string = 'jsObject') {
    if (VALID_FORMATS.indexOf(format) < 0) {
      console.log('WARN: Invalid format, defaulting to \'jsObject\' format')
    }

    this.format = format

    // create ethers interface for given abi
    if (typeof prop === 'string') {
      prop = JSON.parse(fs.readFileSync(prop))
      this.interface = new ethers.utils.Interface(prop)
    } else if (prop instanceof Object) {
      this.interface = new ethers.utils.Interface(prop)
    } else {
      throw new TypeError('Must pass ABI array object or file path to constructor')
    }
  }

  decodeData(data: string) {
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
      const decodedData = this.interface.parseTransaction({ data })

      const methodName = decodedData.name

      // Grab the length
      // const inputLength = decodedData.args.length
      // console.log('inputLength: ', inputLength)
      // console.log('frags: ', decodedData.functionFragment.inputs.length)

      // Slice this object
      // const paramsSliced = Object.entries(decodedData.args).slice(inputLength, inputLength * 2)

      // I need to go through entries, taking index(length+i) names (keys) and associating them with the ith values
      // This will keep the 'invisible' names from dissapearing fml
      const entriesFixed = getEntriesCorrected(decodedData.args)

      // Clean up the formatting, un-hex values
      const paramsNew = transformParamsNew(entriesFixed)

      // console.log(JSON.stringify(paramsSliced, null, 2))
      // console.log(JSON.stringify(jsObjectParams, null, 2))
      return { methodName, params: paramsNew }
    } catch (error) {
      // Eat all errors currently, can debug here once we find failed decodings
      console.log(error)
    }
    return null
  }
}

function getEntriesCorrected(argsObject) {
  const inputLength = argsObject.length
  const entriesFixed = []
  const entries = Object.entries(argsObject)
  console.log('argsObject: ', argsObject)

  for (let i = 0; i < inputLength; i++) {
    let key
    let value
    try {
      // console.log(entries[i + inputLength][0])
      // console.log(entries[i][1])
      key = entries[i + inputLength][0]
    } catch (error) {
      // console.log('found empty name')
      // console.log(entries[i][1])
      key = ''
    }
    value = entries[i][1]
    entriesFixed.push([key, value])
  }
  console.log('entriesFixed')
  console.log(entriesFixed)
  return entriesFixed
}

function transformParamsNew(params) {
  let resParams = {}
  params.forEach((input) => {
    // console.log(input)

    // Check for special cases, if not, add to resParams
    if (Array.isArray(input[1]) && Array.isArray(input[1][0])) {
      // Found nesting
      // console.log('Need to recurse')
      // console.log(input[1])

      resParams[input[0]] = paramListRecurse(input[1])
    }
    // @ts-ignore: _isBigNumber won't exist on all values
    else if (input[1] && input[1]._isBigNumber) {
      // Found hex value BigNumber, translate and replace
      resParams[input[0]] = input[1].toString()
    } else {
      // No special cases, add to resParams
      resParams[input[0]] = input[1]
    }
    // console.log("--")
  })
  // console.log(JSON.stringify(resParams, null, 2))
  return resParams
}

function paramListRecurse(input) {
  let resList = []

  input.forEach(i => {
    // console.log(i, Array.isArray(i))
    // console.log(i[0], Array.isArray(i[0]))

    if (Array.isArray(i) && Array.isArray(i[0])) {
      console.log('this has deeper levels, recursing')
      resList.push(paramListRecurse(i))
    } else {

      console.log('typeof i')
      console.log(typeof i)

      console.log('i: ', i)
      const iSliced = getEntriesCorrected(i)

      console.log('\n\nislice:')
      console.log(iSliced)
      console.log('\n\n')

      let resObj = {}
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
      resObj = transformParamsNew(iSliced)
      console.log('resObj')
      console.log(resObj)
      resList.push(resObj)
    }
  })
  return resList
}

// Zips inputs to types
function mapTypesToInputs(types: Array<typesObject>, inputs: methodInputsType): Array<solidityObject> {
  const params = [] as Array<solidityObject>
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

function transformVerboseTypes(inputs: any): Array<typesObject> {
  // Some funky flattening of tuple arrays (structures in Solidity)
  const typesToReturn = inputs.reduce((acc, obj, index) => {
    if (obj.type.includes('tuple')) {
      acc[index] = { name: obj.name, type: obj.type, components: cleanTupleTypes(obj.components) }
      return acc
    }
    acc[index] = { name: obj.name, type: obj.type }
    return acc
  }, []) as Array<typesObject>

  return typesToReturn
}

function cleanTupleTypes(tupleTypes: Array<typesObject>): Array<Object> {
  return tupleTypes.map(comp => ({ name: comp.name, type: comp.type }))
}

function standardiseAddress(ad: string): string {
  if (!ad.startsWith('0x')) return toChecksumAddress(`0x${ad}`)
  return toChecksumAddress(ad)
}


function transformToJSObjectNested(arr) {
  // Check for deeper nesting
  if (Array.isArray(arr[0]) && !((arr as Array<typesObject>)[0]).name) {
    const arrParams = []
    arr.forEach((p) => arrParams.push(transformToJSObjectNested(p)))
    return arrParams
  }
  // Check for array leaf value
  if (!Array.isArray(arr[0]) && !arr[0].name) {
    return arr
  }
  return arr.reduce((r, { name, value }) => {
    r[name] = value
    return r
  }, {})
}

function transformToJSObject(params) {
  const cleanParams = {}
  params.forEach((p) => {
    p = p // redefine type in this codeblock
    if (Array.isArray(p.value)) {
      p.name = !p.name ? '' : p.name
      cleanParams[p.name] = transformToJSObjectNested(p.value)
      return
    }
    cleanParams[p.name] = p.value
  })
  return cleanParams
}

export default {
  InputDataDecoder,
  decodeInput,
}
