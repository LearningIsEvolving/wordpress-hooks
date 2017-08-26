var fs = require('fs');
var phpParser = require('php-parser');
var klaw = require('klaw');
var through2 = require('through2');

var BASE_PATH = '/Users/danburzo/Downloads/wordpress/';

var parser = new phpParser({
	parser: {
		extractDoc: true,
		suppressErrors: true
	},
	ast: {
		withPositions: true
	}
});


// exclude wp-content folder
// include .php files
const filterFiles = through2.obj(
	function(item, enc, next) {
		if (!item.path.match(/wp\-content/) && item.path.match(/\.php$/)) {
			this.push(item);
		}
		next();
	}
)

const extractDoc = through2.obj(
	function(item, enc, next) {
		let ast = parser.parseCode(fs.readFileSync(item.path, 'utf8'));
		let doc = ast.children.find(child => child.isDoc);
		if (doc) {
			this.push({
				path: item.path.replace(BASE_PATH, ''),
				doc: doc.lines
			});
		}
		next();
	}
)

let output = {};

klaw(BASE_PATH)
	.pipe(filterFiles)
	.pipe(extractDoc)
	.on('data', item => output[item.path] = item.doc)
	.on('end', () => fs.writeFileSync('data/docs.json', JSON.stringify(output, null, 2)))

