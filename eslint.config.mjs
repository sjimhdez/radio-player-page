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
	// Baseline for legacy code (ADR 0021): each rule that fails today is turned off
	// only in the file where it fails. Spec 0002 formats the code and removes this
	// block. Do not add entries: fix the code instead.
	{
		files: [ 'admin/js/program-admin.js' ],
		rules: {
			curly: 'off',
			'no-var': 'off',
			'prettier/prettier': 'off',
		},
	},
	{
		files: [ 'admin/js/station-admin.js' ],
		rules: {
			'@wordpress/no-global-active-element': 'off',
			'@wordpress/no-unused-vars-before-return': 'off',
			curly: 'off',
			eqeqeq: 'off',
			'no-redeclare': 'off',
			'no-shadow': 'off',
			'no-unused-vars': 'off',
			'no-var': 'off',
			'prettier/prettier': 'off',
		},
	},
];
