let xray = require('x-ray'), x = xray().throttle(1, 1000);
x('https://developer.wordpress.org/reference/hooks/', '.wp-parser-hook', [
	{
		name: 'h1 a',
		link: 'h1 a@href',
		source: '.sourcefile p',
		description: '.description'
	}
]).paginate('.pagination .next@href').write('data/hooks.json');

