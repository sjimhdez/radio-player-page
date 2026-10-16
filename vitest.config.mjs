import { defineConfig } from 'vitest/config';

// Root project: WordPress-side JavaScript only (admin/js). The player has its own
// Vitest setup in player/ (ADR 0006 / 0020).
export default defineConfig( {
	test: {
		include: [ 'tests/js/**/*.test.js' ],
		environment: 'node',
		coverage: {
			provider: 'v8',
			include: [ 'admin/js/**/*.js' ],
			reporter: [ 'text-summary', 'html', 'json-summary' ],
		},
	},
} );
