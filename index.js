var ansi = require('ansi-split')

var CLEAR_LINE = Buffer.from([0x1b, 0x5b, 0x30, 0x4b])
var NEWLINE = Buffer.from('\n')

module.exports = Diff

function Diff ({height=Infinity, width=Infinity}={}) {
  if (!(this instanceof Diff)) return new Diff({height, width})

  this.x = 0
  this.y = 0
  this.width = width
  this.height = height

  this._buffer = null
  this._out = []
  this._lines = []
}

Diff.prototype.resize = function ({height, width}={}) {
  if (width ) this.width  = width
  if (height) this.height = height

  if (this._buffer) this.update(this._buffer)

  var last = top(this._lines)

  if (!last) {
    this.x = 0
    this.y = 0
  } else {
    this.x = last.remainder
    this.y = last.y + last.height
  }
}

Diff.prototype.toString = function () {
  return this._buffer
}

Diff.prototype.update = function (buffer, {moveTo}={}) {
  this._buffer = Buffer.isBuffer(buffer) ? buffer.toString() : buffer

  var other = this._buffer
  var oldLines = this._lines
  var lines = split(other, this)

  this._lines = lines
  this._out = []

  var min = Math.min(lines.length, oldLines.length)
  var i = 0
  var a
  var b
  var scrub = false

  for (; i < min; i++) {
    a = lines[i]
    b = oldLines[i]

    if (same(a, b)) continue

    // if x === width there is an edgecase with inline diffing
    // easiest solution is just not to do it then! :)
    if (!scrub && this.x !== this.width && inlineDiff(a, b)) {
      var left = a.diffLeft(b)
      var right = a.diffRight(b)
      var slice = a.raw.slice(left, right ? -right : a.length)
      if (left + right > 4 && left + slice.length < this.width - 1) {
        this._moveTo(left, a.y)
        this._push(Buffer.from(slice))
        this.x += slice.length
        continue
      }
    }

    if (a.y !== b.y || a.height !== b.height) scrub = true
    this._write(a, b.length > a.length || scrub)
  }

  for (; i < lines.length; i++) {
    this._write(lines[i], scrub)
  }

  var oldLast = top(oldLines)
  var last = top(lines)

  if (oldLast && (!last || last.y + last.height < oldLast.y + oldLast.height)) {
    this._clearDown(oldLast.y + oldLast.height)
  }

  if (moveTo) {
    this._moveTo(moveTo[0], moveTo[1])
  } else if (last) {
    this._moveTo(last.remainder, last.y + last.height)
  }

  return Buffer.concat(this._out)
}

Diff.prototype._clearDown = function (y) {
  var x = this.x
  for (var i = this.y; i <= y; i++) {
    this._moveTo(x, i)
    this._clearline()
    x = 0
  }
}

Diff.prototype._clearline = function () {
  this._push(CLEAR_LINE)
}

Diff.prototype._newline = function () {
  this._push(NEWLINE)
  this.x = 0
  this.y++
}

Diff.prototype._write = function (line, clearline) {
  this._moveTo(0, line.y)
  this._out.push(line.toBuffer())
  this.x = line.remainder
  this.y += line.height

  if (clearline) this._clearline()
  if (line.newline) this._newline()
}

Diff.prototype._moveTo = function (x, y) {
  var dx = x - this.x
  var dy = y - this.y

  if (dx > 0) this._push(moveRight(dx))
  else if (dx < 0) this._push(moveLeft(-dx))
  if (dy > 0) this._push(moveDown(dy))
  else if (dy < 0) this._push(moveUp(-dy))

  this.x = x
  this.y = y
}

Diff.prototype._push = function (buf) {
  this._out.push(buf)
}

function same (a, b) {
  return a.y === b.y && a.width === b.width && a.raw === b.raw
}

function top (list) {
  return list.length ? list[list.length - 1] : null
}

function Line (str, y, nl, term) {
  this.y = y
  this.width = term.width
  this.parts = ansi(str)
  this.length = length(this.parts)
  this.raw = str
  this.newline = nl
  this.height = Math.floor(this.length / term.width)
  this.remainder = this.length - (this.height && this.height * term.width)
  if (this.height && !this.remainder) {
    this.height--
    this.remainder = this.width
  }
}

Line.prototype.diffLeft = function (other) {
  var left = 0
  for (; left < this.length; left++) {
    if (this.raw[left] !== other.raw[left]) return left
  }
  return left
}

Line.prototype.diffRight = function (other) {
  var right = 0
  for (; right < this.length; right++) {
    var r = this.length - right - 1
    if (this.raw[r] !== other.raw[r]) return right
  }
  return right
}

Line.prototype.toBuffer = function () {
  return Buffer.from(this.raw)
}

function inlineDiff (a, b) {
  return a.length === b.length &&
    a.parts.length === 1 &&
    b.parts.length === 1 &&
    a.y === b.y &&
    a.newline &&
    b.newline &&
    a.width === b.width
}

function split (str, term) {
  var y = 0
  var lines = str.split('\n')
  var wrapped = []
  var line

  for (var i = 0; i < lines.length; i++) {
    line = new Line(lines[i], y, i < lines.length - 1, term)
    y += line.height + (line.newline ? 1 : 0)
    wrapped.push(line)
  }

  return wrapped
}

function moveUp (n) {
  return Buffer.from('1b5b' + toHex(n) + '41', 'hex')
}

function moveDown (n) {
  return Buffer.from('1b5b' + toHex(n) + '42', 'hex')
}

function moveRight (n) {
  return Buffer.from('1b5b' + toHex(n) + '43', 'hex')
}

function moveLeft (n) {
  return Buffer.from('1b5b' + toHex(n) + '44', 'hex')
}

function length (parts) {
  var len = 0
  for (var i = 0; i < parts.length; i += 2) {
    len += parts[i].length
  }
  return len
}

function toHex (n) {
  return Buffer.from('' + n).toString('hex')
}
