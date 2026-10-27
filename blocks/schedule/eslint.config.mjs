import wordpress from '@wordpress/eslint-plugin';

// WordPress packages are editor externals (wp.*), not npm dependencies. Same
// pattern @wordpress/eslint-plugin 20 used; version 28 no longer ignores them.
const wpPackages = '^@wordpress/(?!(icons|interface|style-engine))';

// Own flat config: ESLint stops at the nearest eslint.config.*, so the root
// one is never read (ADR 0020).
export default [
	...wordpress.configs.recommended,
	{
		settings: {
			'import/internal-regex': wpPackages,
		},
		rules: {
			'import/no-unresolved': [ 'error', { ignore: [ wpPackages ] } ],
		},
	},
];
