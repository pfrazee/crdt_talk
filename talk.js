var fs = require('fs')
var NLINES = 30

var notes = fs.readFileSync('./README.txt', {encoding:'utf-8'})
notes = notes.split('\n-\n\n')

var index = 0
function print() {
  var para = (notes[index]||'').split('\n')
  var nlines = para.length
  var start = (NLINES/2 - nlines/2)|0
  for (var i=0; i < NLINES; i++) {
    if (i >= start && i < start + nlines)
      console.log(' '+para[i-start])
    else
      console.log('')
  }
  
}
print()

process.stdin.setRawMode(true);    
process.stdin.setEncoding('utf8');
process.stdin.resume();
process.stdin.on('data', function (key) {
  if (key === '\u0003') {
    process.exit();
  }
  if (key === 'n') {
    index++
    if (index >= notes.length) {
      index = notes.length - 1
      console.log('fin')
    } else
      print()
  }
  if (key === 'p') {
    index--
    if (index < 0) index = 0
    print()
  }
  // if (key && key.ctrl && key.name == 'c') process.exit();
});
