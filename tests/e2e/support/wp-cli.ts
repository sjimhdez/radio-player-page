import { execFileSync } from 'node:child_process';

/**
 * Runs WP-CLI in the test environment (.wp-env.tests.json, the `wp_` site) and
 * returns its trimmed stdout.
 *
 * @param args WP-CLI arguments, without the leading `wp`.
 */
export function wpCli( ...args: string[] ): string {
	return execFileSync(
		'npx',
		[
			'wp-env',
			'--config',
			'.wp-env.tests.json',
			'run',
			'cli',
			'--',
			'wp',
			...args,
		],
		{ encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'pipe' ] }
	).trim();
}
