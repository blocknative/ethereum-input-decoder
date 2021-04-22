/* eslint-disable no-unused-vars */
const { Benchmark } = require('benchmark')
const path = require('path')
const fs = require('fs')
const { InputDataDecoder } = require('../dist/ethereum-input-decoder')


// TODO: figure out queueing suites, might be easier!
console.log('This benchmark takes approximately 5 minutes to run in full. Please comment out parts you don\'t want.')


// ------------- Benchmarking creation of different decoders -------------

// Add all benchmarks
const decoderSuite = new Benchmark.Suite()

decoderSuite.add('Creating Uniswap V2 Router Decoder (large ABI)', () => {
  const uniswapV2Decoder = new InputDataDecoder(path.join(__dirname, '..', 'test/data/Uniswap_v2_router_2_abi.json'))
})
decoderSuite.add('Creating Balancer Exchange Proxy 2 Decoder (large ABI with nested tuples)', () => {
  const balancerProxy2Decoder = new InputDataDecoder(path.join(__dirname, '..', 'test/data/Balancer_Exchange_Proxy_2_abi.json'))
})
decoderSuite.add('Creating erc20 Decoder (small simple ABI)', () => {
  const erc20Decoder = new InputDataDecoder(path.join(__dirname, '..', 'test/data/erc20_abi.json'))
})
decoderSuite.add('Creating 0x v3 Decoder (large ABI ~3k lines in pretty json)', () => {
  const zeroxV3Decoder = new InputDataDecoder(path.join(__dirname, '..', 'test/data/0x_v3_abi.json'))
})

// Collating information
decoderSuite.run({
  async: true,
  minTime: 1,
})
const createDecoderTimes = []
decoderSuite.on('cycle', (event) => {
  createDecoderTimes.push(String(event.target))
})
decoderSuite.on('complete', () => {
  console.log(createDecoderTimes)
  console.log(`The fastest decoder to create is ${objectTypeSuite.filter('fastest').map('name')}`)
})


// ------------- Benchmarking decoding of inputs with common contracts -------------

// Reading in data for benchmarks to use
const uniswapV2Data = fs.readFileSync(path.join(__dirname, '..', 'test/data/Uniswap_v2_router_2_input.txt'), 'utf8')
const oneinchExchangeV3Data = fs.readFileSync(path.join(__dirname, '..', 'test/data/1inch_exchange_v3_unoswap.txt'), 'utf8')
const erc20Data = '0xa9059cbb0000000000000000000000005a1cb5a88988ca4fef229935db834a6781e873cb0000000000000000000000000000000000000000000000000de0b6b3a7640000'

const uniswapV2Decoder = new InputDataDecoder(path.join(__dirname, '..', 'test/data/Uniswap_v2_router_2_abi.json'))
const oneinchExchangeV3Decoder = new InputDataDecoder(path.join(__dirname, '..', 'test/data/1inch_exchange_v3_abi.json'))
const erc20Decoder = new InputDataDecoder(path.join(__dirname, '..', 'test/data/erc20_abi.json'))

// Add all benchmarks
const decodingSuite = new Benchmark.Suite()

decodingSuite.add('Decoding a uniswap v2 input', () => {
  const result = uniswapV2Decoder.decodeData(uniswapV2Data)
})

decodingSuite.add('Decoding a 1inch exchange v3 input', () => {
  const result = oneinchExchangeV3Decoder.decodeData(oneinchExchangeV3Data)
})

decodingSuite.add('Decoding a erc20 input', () => {
  const result = erc20Decoder.decodeData(erc20Data)
})

// Collating information
decodingSuite.run({
  async: true,
  minTime: 1,
})
const decodingTimes = []
decodingSuite.on('cycle', (event) => {
  decodingTimes.push(String(event.target))
})
decodingSuite.on('complete', () => {
  console.log(decodingTimes)
  console.log(`The fastest decoding is done by ${objectTypeSuite.filter('fastest').map('name')}`)
})


// ------------- Benchmarking difference of jsObject and solidityType -------------

// Reading in data for benchmarks to use
const oneinchExchangeV3DecoderSolidityType = new InputDataDecoder(path.join(__dirname, '..', 'test/data/1inch_exchange_v3_abi.json'), 'solidityType')

// Add all benchmarks
const objectTypeSuite = new Benchmark.Suite()

objectTypeSuite.add('Decoding to jsObject', () => {
  const result = oneinchExchangeV3Decoder.decodeData(oneinchExchangeV3Data)
})

objectTypeSuite.add('Decoding to solidityType', () => {
  const result = oneinchExchangeV3DecoderSolidityType.decodeData(oneinchExchangeV3Data)
})

// Collating information
objectTypeSuite.run({ async: true })
const formatCompareTimes = []
objectTypeSuite.on('cycle', (event) => {
  formatCompareTimes.push(String(event.target))
})
objectTypeSuite.on('complete', () => {
  console.log(formatCompareTimes)
  console.log(`The fastest format to decode to is ${objectTypeSuite.filter('fastest').map('name')}`)
})
