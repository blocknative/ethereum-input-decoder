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

      // NEW DECODING METHOD HERE!

      // Grab the arguments out via ethers parseTransaction function
      const decodedData = this.interface.parseTransaction({ data })
      // Returned format quirks to mold into our Blocknative format:
      //  - Strange array format, where it doubles up for list generator reasons
      //  - empty argument names mess with the order and structure of nested arrays, must cast to ''
      //  - Is not always perfectly recursable or in array forms.

      console.log('decodedData.args')
      console.log(decodedData.args)

      // Clean up the formatting, un-hex values, correct empty names, arrayify some objects.
      const paramsNew = transformParamsNew(decodedData.args)

      return { methodName: decodedData.name, params: paramsNew }
    } catch (error) {
      // Eat all errors currently, can debug here once we find failed decodings
      console.log(error)
    }
    return null
  }
}

function transformParamsNew(params) {

  // Create returning object of argument parameters
  let resParams = {}

  // Remove non named values, to be able to iterable without duplicates
  const correctedEntries = getEntriesCorrected(params)

  correctedEntries.forEach((input) => {

    console.log('som stats')
    console.log(input)
    console.log('Array.isArray:', Array.isArray(input[1]))
    console.log('instance of array:', input[1] instanceof Array)
    console.log('object:', input[1] instanceof Object)
    if (typeof input[1] === 'string' || input[1] instanceof String) console.log('UH OH !!!!!!!!!!!!!!!!!!!!!!!!!!')

    // Check for nested arguments, this starts a recursive call
    // TODO ALEX: do we need to check this ISN'T A STRING?
    if (Array.isArray(input[1])) {

      // Make temp list for starting a recursive call to transformParamsNew()
      let tempList = []

      const correctedInput = getEntriesCorrected(input[1])

      console.log('attempt at correcting a nesting?')
      console.log('length:', correctedInput.length)
      console.log(correctedInput)

      correctedInput.forEach((i) => {
        console.log('i')
        console.log(i)
        // console.log('transformParamsNew([i])')
        // console.log(transformParamsNew([i]))
      })

      // Iterate through possible nesting items
      // DO WE NEED THIS?
      // correctedi.forEach((i) => {

      //   if (typeof i === 'string' || i instanceof String) {
      //     console.log('FOUND STRING DO NOT RECURSE')
      //     console.log(i)
      //     console.log('input[0]')
      //     console.log(input[0])
      //     tempList.push(i)
      //     return
      //   }

      //   const iPossiblyCorrected = getEntriesCorrected(i)

      //   // TODO ALEX: how do I know this is a typed thingy and not a array like thinky, like strings (addresses)
      //   if (iPossiblyCorrected.length == 0) {
      //     console.log('Found 0 length!, i: ')
      //     console.log(i)
      //     tempList.push(transformParamsNew([i]))
      //   } else {
      //     // Found a recursive case
      //     console.log('Found non 0 length of nesting, recursing, i:')
      //     console.log(i)

      //     // tempList.push(transformParamsNew(i))
      //     tempList.push(i)
      //   }
      // })
      resParams[input[0]] = tempList
      return

      // todo alex: do i need this next line?
      // resParams[input[0]] = paramListRecurse(input[1])
    }
    // @ts-ignore: _isBigNumber won't exist on all values
    else if (input[1] && input[1]._isBigNumber) {
      // Found hex value BigNumber, translate and replace
      resParams[input[0]] = input[1].toString()
    } else {
      // No special cases, add to resParams
      resParams[input[0]] = input[1]
    }
  })
  return resParams
}

// This function corrects the array formatting returned by ethers.
// The array format from ethers returns in the format:
// [ aVal, bVal, aName: aVal, bName: bVal]
// So we want to skip the first values to allow this to be easily iterable.
// This also fills in the empty values with no names.
function getEntriesCorrected(argsObject) {

  const inputLength = argsObject.length
  const entriesFixed = []
  const entries = Object.entries(argsObject)

  for (let i = 0; i < inputLength; i++) {
    let key
    let value
    try {
      key = entries[i + inputLength][0]
    } catch (e) {
      if (e instanceof TypeError) {
        // Incorrectly indexed where there should be a name key, thus it is empty
        key = ''
      } else {
        // TODO ALEX: comment this out on release
        console.log('Found unknown error: ', e)
      }
    }
    value = entries[i][1]
    entriesFixed.push([key, value])
  }

  // console.log('fixed entires:')
  // console.log(entriesFixed)
  return entriesFixed
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