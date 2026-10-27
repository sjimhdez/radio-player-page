/**
 * Normalizes the clean page HTML so its snapshot is stable across runs,
 * environments and plugin versions. `timezoneOffset` and `timezone` are left
 * as they are: the seeded zone has no DST, so the values themselves are what
 * the snapshot pins (C9).
 */

/**
 * Escapes a string for use inside a regular expression.
 *
 * @param {string} value Literal text.
 * @return {string} Escaped pattern.
 */
function escapeRegExp( value ) {
	return value.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
}

/**
 * Replaces an origin, plain and JSON-escaped (`\/`), when it is not followed
 * by another digit (so `:890` does not match `:8901`).
 *
 * @param {string} html        Page HTML.
 * @param {string} origin      Origin, e.g. `http://localhost:8890`.
 * @param {string} placeholder Replacement.
 * @return {string} HTML with the origin replaced.
 */
function replaceOrigin( html, origin, placeholder ) {
	const pattern = escapeRegExp( origin ).replace( /\//g, '\\\\?\\/' );

	return html.replace( new RegExp( pattern + '(?!\\d)', 'g' ), placeholder );
}

/**
 * Normalizes the clean page HTML.
 *
 * @param {string}                 html                Page HTML.
 * @param {Object}                 options             Options.
 * @param {string}                 options.site        Site origin → `{{SITE}}`.
 * @param {string}                 options.media       CORS media origin → `{{MEDIA}}`.
 * @param {string}                 options.mediaNoCors No-CORS media origin → `{{MEDIA_NOCORS}}`.
 * @param {Record<string, string>} options.ids         Post ID → stable name (the seeder's map).
 * @return {string} Normalized HTML, one tag per line, ending with a newline.
 * @throws {Error} If an ID is not in the map, so it cannot leak into a snapshot.
 */
export function normalize( html, { site, media, mediaNoCors, ids } ) {
	const idName = ( id ) => {
		if ( ! Object.hasOwn( ids, id ) ) {
			throw new Error( `ID ${ id } is not in the seed map.` );
		}
		return `{{ID:${ ids[ id ] }}}`;
	};

	let out = html;
	out = replaceOrigin( out, site, '{{SITE}}' );
	out = replaceOrigin( out, media, '{{MEDIA}}' );
	out = replaceOrigin( out, mediaNoCors, '{{MEDIA_NOCORS}}' );

	return (
		out
			.replace(
				/(uploads\\?\/)\d{4}(\\?\/)\d{2}(\\?\/)/g,
				'$1{{YYYY}}$2{{MM}}$3'
			)
			// Player asset names carry the plugin version.
			.replace(
				/(player\\?\/dist\\?\/radio-player-page-)\d+\.\d+\.\d+/g,
				'$1{{VERSION}}'
			)
			// So does the generator meta (ADR 0053).
			.replace(
				/(content="Radio Player Page )\d+\.\d+\.\d+/g,
				'$1{{VERSION}}'
			)
			.replace(
				/("(?:id|program_id)":)("?)(\d+)\2/g,
				( _, key, quote, id ) =>
					`${ key }${ quote }${ idName( id ) }${ quote }`
			)
			.replace(
				/([?&]page_id=)(\d+)/g,
				( _, key, id ) => `${ key }${ idName( id ) }`
			)
			// One tag per line, so snapshot diffs are readable.
			.replace( /></g, '>\n<' )
			.replace( /([^\n])$/, '$1\n' )
	);
}
