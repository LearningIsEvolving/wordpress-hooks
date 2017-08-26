var fs = require('fs');
var parser = require('php-parser');
var klaw = require('klaw');
const through2 = require('through2');
const ejs = require('ejs');

const template = ejs.compile(fs.readFileSync('./src/template.ejs','utf8'));

const ROOT_DIR = '/Users/danburzo/Downloads/wordpress\ 2';

const exclude_regex = /wp\-content\//;
const include_regex = /\.php$/;

const filterFiles = through2.obj(
	function(item, enc, next) {
		if (!item.path.match(exclude_regex) && item.path.match(include_regex)) {
			this.push(item);
		}
		next();
	}
);

const _parser = new parser({
	parser: {
		extractDoc: true,
		suppressErrors: true
	},
	ast: {
		withPositions: true
	},
	lexer: {
		short_tags: true,
		asp_tags: true
	}
});

const parseFile = through2.obj(
	function(item, enc, next) {
		this.push({
			path: item.path.replace(ROOT_DIR, ''),
			ast: _parser.parseCode(fs.readFileSync(item.path, 'utf8'))
		});
		next();
	}
);

const isDoc = child => child && child.isDoc;
const isAction = child => child.what.name === 'do_action';
const isFilter = child => child.what.name === 'apply_filters';
const isHookDef = child => {
	return child && child.kind === 'call' && (isAction(child) || isFilter(child));
}

const serializeDoc = doc => doc && doc.lines ? doc.lines.map(line => '> ' + line).join('\n') : 'N/A';

const hookName = child => {
	let name = child.arguments[0].value;
	if (typeof name === 'string') return name;
	if (Array.isArray(name)) {
		return name.reduce((acc, item) => {
			if (item.kind === 'string') {
				return acc + item.value;
			}
			if (item.kind === 'variable') {
				return acc + "${" + item.name + "}";
			}

			if (item.kind === 'propertylookup') {
				return acc + '${' + item.offset.name + '}';
			}
			console.log('\x1b[36m%s\x1b[0m', JSON.stringify(item, null, 2) + '\n---\n');
			return acc;
		}, '');
	}
	if (name === undefined) {
		return child.arguments[0].left + '.' + child.arguments[0].right;
	}
	return null;
}

const walkAST = function(node, prev, callback) {
	if (node) {
		callback(node, prev);
		if (node.body && node.body.children) {
			node.body.children.forEach((child, idx) => walkAST(child, idx > 0 ? node.body.children[idx - 1] : null, callback));
		}
	}
}

const extractHooks = through2.obj(
	function(item, enc, next) {

		let hooks = [];

		walkAST({ body: item.ast }, null, (node, prev) => {
			if (isHookDef(node)) {
				hooks.push({
					type: isAction(node) ? 'action': 'filter',
					name: hookName(node),
					description: serializeDoc(isDoc(prev) ? prev : null)
				})

				if (!hookName(node)) {
					console.log(node);
				}
			}
		});

		if (hooks.length) {
			this.push({
				path: item.path,
				description: serializeDoc(item.ast.children.find(isDoc)),
				hooks: hooks
			});
		}
		next();
	}
);

const items = [];

klaw(ROOT_DIR)
	.pipe(filterFiles)
	.pipe(parseFile)
	.pipe(extractHooks)
	.on('data', item => {
		items.push(item);
	})
	.on('end', () => {
		let output_md = template({
			trunk_url: 'https://core.trac.wordpress.org/browser/trunk/src',
			hooks_url: 'https://developer.wordpress.org/reference/hooks/',
			items: items
		})
		fs.writeFileSync('HOOKS.md', output_md);
	})