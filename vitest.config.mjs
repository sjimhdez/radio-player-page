import { defineConfig } from 'vitest/config';

// Root project: WordPress-side JavaScript only (admin/js). The player has its own
// Vitest setup in player/ (ADR 0006 / 0020).
export default defineConfig( {
	test: {
		coverage: {
			provider: 'v8',
			include: [ 'admin/js/**/*.js' ],
			reporter: [ 'text-summary', 'html', 'json-summary' ],
			// Minimum of spec 0005 (A5): the schedule rules, pure and fed by the
			// vectors. The DOM adapters have no threshold yet.
			thresholds: {
				'admin/js/schedule-rules.js': { lines: 85 },
				// Spec 0018 (A7): the stream test rules.
				'admin/js/stream-rules.js': { lines: 85 },
			},
		},
		projects: [
			{
				// Admin scripts run on the real meta box markup (spec 0002, §4.2).
				extends: true,
				test: {
					name: 'admin',
					include: [ 'tests/js/admin/**/*.test.js' ],
					environment: 'happy-dom',
				},
			},
			{
				extends: true,
				test: {
					name: 'node',
					include: [ 'tests/js/**/*.test.js' ],
					exclude: [ 'tests/js/admin/**' ],
					environment: 'node',
				},
			},
		],
	},
} );
