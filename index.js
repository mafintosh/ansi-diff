var split = require('ansi-split')

var MOVE_LEFT = makeBuffer([0x1b, 0x5b, 0x31, 0x30, 0x30, 0x30, 0x44])
var MOVE_UP = makeBuffer([0x1b, 0x5b, 0x31, 0x41])
var MOVE_DOWN = makeBuffer([0x1b, 0x5b, 0x31, 0x42])
var CLEAR_LINE = makeBuffer([0x1b, 0x5b, 0x30, 0x4b])
var EMPTY = makeBuffer([])

module.exports = Diff

function Diff (opts) {
  if (!(this instanceof Diff)) return new Diff(opts)
  if (!opts) opts = {}

  this.width = opts.width || 0
  this.height = opts.height || 0
  this.buffer = null

  this._prevLines = []
}

Diff.prototype.resize = function (opts) {
  if (typeof opts === 'number') opts = {width: opts}
  if (!opts) opts = {}

  if (opts.width) this.width = opts.width
  if (opts.height) this.height = opts.height
  if (this.buffer !== null) this.update(this.buffer)
}

Diff.prototype.update = function (buf) {
  this.buffer = buf

  var lines = (Buffer.isBuffer(buf) ? buf.toString() : buf).split('\n')
  var wrappedLines = []
  var prevLines = this._prevLines

  for (var i = 0; i < lines.length; i++) {
    this._wordwrap(split(lines[i]), wrappedLines, i < lines.length - 1)
  }

  this._prevLines = wrappedLines

  var diff = this.diff(wrappedLines, prevLines)
  return diff.length ? Buffer.concat(diff) : EMPTY
}

Diff.prototype._wordwrap = function (line, result, needsNewline) {
  var wid = this.width

  if (wid && line.length) {
    for (var i = 0; i < line.length; i += 2) { // += 2 to jump ansi
      var part = line[i]
      if (wid - part.length < 0) {
        line[i] = part.slice(0, wid)
        result.push(line)
        wid = this.width
        line = line.slice(i)
        line[0] = part.slice(wid)
        i -= 2
      }
    }
  }

  if (needsNewline) pushNewline(line)
  if (line.length) result.push(line)
}

Diff.prototype._diffLine = function (a, b, res) {
  res.push(CLEAR_LINE)
  res.push(makeBuffer(a.join('')))
  return true
}

Diff.prototype.diff = function (a, b) {
  var result = []
  var len = Math.min(a.length, b.length)

  result.push(MOVE_LEFT)

  var sameLines = 0
  var differentLine = false

  // clear old lines
  while (b.length > len) {
    result.push(CLEAR_LINE)
    result.push(MOVE_UP)
    b.pop()
  }

  var moveUpIndex = result.push(EMPTY) - 1

  for (var i = 0; i < len; i++) {
    var ai = a[i]
    var bi = b[i]

    if (same(ai, bi) && !differentLine) {
      sameLines++
      continue
    }

    differentLine = true
    this._diffLine(ai, bi, result)
  }

  var linesToDiff = b.length - sameLines

  if (linesToDiff > 1) {
    result[moveUpIndex] = moveUp(linesToDiff - 1)
  }

  for (; len < a.length; len++) {
    result.push(makeBuffer(a[len].join('')))
  }

  // no changes
  if (result.length === 2) return []

  return result
}

function pushNewline (row) {
  if (row.length & 1) row[row.length - 1] += '\n'
  else row.push('\n')
}

function same (a, b) {
  if (a.length !== b.length) return false
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function moveRight (n) {
 return makeBuffer('1b5b' + toHex(n) + '43', 'hex')
}

function moveUp (n) {
  if (n === 1) return MOVE_UP
  return makeBuffer('1b5b' + toHex(n) + '41', 'hex')
}

function toHex (n) {
  return makeBuffer('' + n).toString('hex')
}

function makeBuffer (s, enc) {
  if (Buffer.from) return Buffer.from(s, enc)
  return new Buffer(s, enc)
}
