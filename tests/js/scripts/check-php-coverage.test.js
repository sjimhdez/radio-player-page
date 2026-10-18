/**
 * External dependencies
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { measureZones } from '../../../scripts/check-php-coverage.mjs';

const ROOT = resolve( __dirname, '../../..' );
const SCRIPT = join( ROOT, 'scripts/check-php-coverage.mjs' );
const SAMPLE = join( __dirname, 'fixtures/php-xml' );

/**
 * Zones over the sample report. Critical: 24 executable lines, 22 executed
 * (91.67 %). Rest: the uncritical part of mixed.php plus uninstall.php,
 * 20 executable, 10 executed (50 %). main.php outside its critical function
 * belongs to no zone.
 *
 * @param {Object} overrides Values that replace the defaults of each zone.
 * @return {Object} Zones definition.
 */
function zones( overrides = {} ) {
	return {
		critical: {
			min: 80,
			include: [
				{ file: 'includes/critical.php' },
				{ file: 'includes/mixed.php', functions: [ 'mixed_critical' ] },
				{ file: 'main.php', functions: [ 'main_critical' ] },
			],
			...overrides.critical,
		},
		rest: {
			min: 50,
			include: [ 'includes/**', 'uninstall.php' ],
			...overrides.rest,
		},
	};
}

/**
 * Runs the script as the CI does, with a zones file written to a temp dir.
 *
 * @param {Object} definition Zones definition.
 * @param {string} xmlDir     Coverage XML directory.
 * @return {Object} spawnSync result.
 */
function runCli( definition, xmlDir = SAMPLE ) {
	const dir = mkdtempSync( join( tmpdir(), 'php-zones-' ) );
	const file = join( dir, 'php-zones.json' );
	writeFileSync( file, JSON.stringify( definition ) );
	return spawnSync( process.execPath, [ SCRIPT, xmlDir, '--zones', file ], {
		encoding: 'utf8',
	} );
}

describe( 'check-php-coverage', () => {
	it( 'adds up whole files and listed functions in the critical zone', () => {
		const { zones: result } = measureZones( SAMPLE, zones() );

		expect( result.critical ).toMatchObject( {
			executable: 24,
			executed: 22,
		} );
		expect( result.critical.percent ).toBeCloseTo( 91.67, 2 );
	} );

	it( 'leaves critical functions and unmatched files out of the rest zone', () => {
		const { zones: result } = measureZones( SAMPLE, zones() );

		expect( result.rest ).toMatchObject( {
			executable: 20,
			executed: 10,
			percent: 50,
		} );
	} );

	it( 'passes when every zone reaches its minimum', () => {
		const { ok, errors } = measureZones( SAMPLE, zones() );

		expect( errors ).toEqual( [] );
		expect( ok ).toBe( true );
	} );

	it( 'fails when a zone is below its minimum', () => {
		const { ok, zones: result } = measureZones(
			SAMPLE,
			zones( { rest: { min: 60 } } )
		);

		expect( result.rest.ok ).toBe( false );
		expect( result.critical.ok ).toBe( true );
		expect( ok ).toBe( false );
	} );

	it( 'fails when a critical function is not in the report', () => {
		const { ok, errors } = measureZones(
			SAMPLE,
			zones( {
				critical: {
					include: [
						{
							file: 'includes/mixed.php',
							functions: [ 'renamed' ],
						},
					],
				},
			} )
		);

		expect( errors ).toContain(
			'critical: function renamed not found in includes/mixed.php'
		);
		expect( ok ).toBe( false );
	} );

	it( 'fails when a critical file is not in the report', () => {
		const { ok, errors } = measureZones(
			SAMPLE,
			zones( {
				critical: { include: [ { file: 'includes/gone.php' } ] },
			} )
		);

		expect( errors ).toContain(
			'critical: file includes/gone.php not found in the report'
		);
		expect( ok ).toBe( false );
	} );

	it( 'fails when a zone has no executable lines', () => {
		const { ok, errors } = measureZones(
			SAMPLE,
			zones( { rest: { include: [ 'blocks/*/render.php' ] } } )
		);

		expect( errors ).toEqual( [ 'rest: no executable lines' ] );
		expect( ok ).toBe( false );
	} );

	it( 'exits with 0 when the zones pass', () => {
		const { status, stdout } = runCli( zones() );

		expect( status ).toBe( 0 );
		expect( stdout ).toContain( 'critical' );
		expect( stdout ).toContain( '91.67' );
	} );

	it( 'exits with 1 when a minimum is above the measured value', () => {
		const { status, stderr } = runCli( zones( { critical: { min: 92 } } ) );

		expect( status ).toBe( 1 );
		expect( stderr ).toContain( 'critical' );
	} );

	it( 'reads tests/coverage/php-zones.json without --zones', () => {
		const { status, stderr } = spawnSync(
			process.execPath,
			[ SCRIPT, SAMPLE ],
			{ encoding: 'utf8' }
		);

		expect( status ).toBe( 1 );
		expect( stderr ).toContain(
			'critical: file includes/radplapag-upgrade.php not found in the report'
		);
	} );

	it( 'exits with 1 when the report directory does not exist', () => {
		const { status, stderr } = runCli( zones(), join( SAMPLE, 'missing' ) );

		expect( status ).toBe( 1 );
		expect( stderr ).toContain( 'index.xml' );
	} );
} );
