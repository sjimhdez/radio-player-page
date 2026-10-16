import { defineConfig, devices } from '@playwright/test';

const isCI = !! process.env.CI;

// The e2e site is the test environment (.wp-env.tests.json), never the dev site.
export default defineConfig( {
	testDir: './tests/e2e',
	globalSetup: './tests/e2e/global-setup.ts',
	outputDir: './test-results/e2e',
	fullyParallel: false,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: 1,
	reporter: isCI
		? [ [ 'list' ], [ 'html', { open: 'never' } ] ]
		: [ [ 'list' ] ],
	use: {
		baseURL: 'http://localhost:8890',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	projects: [
		{ name: 'chromium', use: { ...devices[ 'Desktop Chrome' ] } },
		{ name: 'webkit', use: { ...devices[ 'Desktop Safari' ] } },
	],
} );
