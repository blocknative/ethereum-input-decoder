const { Benchmark } = require('benchmark')


const suite = new Benchmark.Suite()

suite.add('RegExp#test', () => {
  /o/.test('Hello World!')
})
  .run({ async: true })

suite.on('cycle', (event) => {
  console.log(String(event.target))
})
