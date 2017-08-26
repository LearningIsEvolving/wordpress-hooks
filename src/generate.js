var fs = require('fs');
var ejs = require('ejs');

const hooks = JSON.parse(fs.readFileSync('./data/hooks.json', 'utf8'));
const docs = JSON.parse(fs.readFileSync('./data/docs.json', 'utf8'));
const template = ejs.compile(fs.readFileSync('./src/template.ejs', 'utf8'));

const group_by = function(arr, prop) {
	var ret = {};
	arr.forEach(item => {
		if (!ret[item[prop]]) {
			ret[item[prop]]= [];
		}
		if (!ret[item[prop]].find(i => i.name === item.name)) {
			ret[item[prop]].push(item);
		}
	});
	return Object.keys(ret).map(key => {
		return {
			source: key,
			description: (docs[key] || []).filter(line => line && line.indexOf("@") !== 0),
			hooks: ret[key]
		};
	}).sort((a, b) => {
		if (a.source > b.source) {
			return 1;
		}
		else if (a.source < b.source) {
			return -1;
		}
		return 0;
	});
}

const items = group_by(
	hooks.map(hook => {
		return {
			name: hook.name,
			source: hook.source.split(':')[1].trim(),
			description: hook.description.replace(/(Filter|Action) Hook\: /, '').trim(),
			type: hook.description.match(/Filter Hook\:/) ? 'Filter' : 'Action',
			link: hook.link
		}
	}),
	'source'
)

fs.writeFileSync(
	'README.md', 
	template({ 
		items: items,
		trunk_url: 'https://core.trac.wordpress.org/browser/trunk/src/'
	})
);