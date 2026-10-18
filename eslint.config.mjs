import wordpress from '@wordpress/eslint-plugin';

export default [
	{
		ignores: [
			'player/**',
			'blocks/**',
			'spike/**',
			'vendor/**',
			'coverage/**',
			// Generated media: the HLS segments are MPEG-TS, not TypeScript.
			'tests/fixtures/audio/**',
			'**/node_modules/**',
		],
	},
	...wordpress.configs.recommended,
	...wordpress.configs[ 'test-unit' ].map( ( config ) => ( {
		...config,
		files: [ 'tests/js/**/*.test.js' ],
	} ) ),
];
