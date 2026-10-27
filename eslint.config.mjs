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
			// Playwright output: an interrupted run leaves trace resources (HLS segments, bundles).
			'test-results/**',
			'**/node_modules/**',
		],
	},
	...wordpress.configs.recommended,
	...wordpress.configs[ 'test-unit' ].map( ( config ) => ( {
		...config,
		files: [ 'tests/js/**/*.test.js' ],
	} ) ),
];
