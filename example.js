var diff = require('./')(dimension())

// render now
render()

// render every 1s
setInterval(render, 1000)

process.on('SIGWINCH', noop)
process.stdout.on('resize', onresize)

function onresize () {
  diff.resize(dimension())
  render()
}

function render () {
  const even = Math.floor(Date.now()/1000) % 2 == 0
  var message =
    `This is a demo\n` +
    `|${even ? 'ヤニコード' : '          '}|\n` +
    'The time is: ' + new Date() + '\n' +
    'That is all\n'

  // will update the terminal with minimal changes
  process.stdout.write(diff.update(message))
}

function dimension () {
  return {
    width: process.stdout.columns,
    height: process.stdout.rows
  }
}

function noop () {}
