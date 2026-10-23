import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import {
	Notice,
	SelectControl,
	PanelBody,
	ToggleControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import ServerSideRender from '@wordpress/server-side-render';

import metadata from '../block.json';

const blockName = metadata.name;

/**
 * Label of a station in the select.
 *
 * @param {Object} station Editor data of the station.
 * @param {number} index   Its position in the list.
 * @return {string} The label.
 */
function stationLabel( station, index ) {
	return (
		station.label ||
		__( 'Radio Station', 'radio-player-page' ) + ' ' + ( index + 1 )
	);
}

/**
 * The edit function describes the structure of the block in the context of the editor.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#edit
 *
 * @param {Object}                    props               Block props.
 * @param {Object}                    props.attributes    Block attributes.
 * @param {( attrs: Object ) => void} props.setAttributes Updates block attributes.
 * @return {Element} Element to render.
 */
export default function Edit( { attributes, setAttributes } ) {
	const { stationId, stationIndex, showLogo } = attributes;
	const blockProps = useBlockProps();
	const stations = window.radplapagNowPlayingBlock?.stations || [];
	// The station the front end shows: by ID, or by position without one.
	const resolvedIndex =
		stationId > 0
			? stations.findIndex(
					( station ) => Number( station.id ) === stationId
				)
			: stationIndex;
	const resolved = stations[ resolvedIndex ];
	const isMissing = stations.length > 0 && ! resolved;
	const options =
		stations.length === 0
			? [
					{
						label: __(
							'No Radio Stations configured',
							'radio-player-page'
						),
						value: '',
					},
				]
			: stations.map( ( station, index ) => ( {
					label: stationLabel( station, index ),
					value: String( station.id ),
				} ) );
	if ( stations.length > 0 && ! ( stationId > 0 && resolved ) ) {
		options.unshift( {
			label: __( 'Select a radio station', 'radio-player-page' ),
			value: '',
		} );
	}
	const help =
		stationId > 0 || ! resolved
			? undefined
			: sprintf(
					/* translators: %s: Radio station title. */
					__(
						'Showing “%s” by its position in the list of stations. Choose a station to keep it.',
						'radio-player-page'
					),
					stationLabel( resolved, resolvedIndex )
				);
	const showLogoValue = showLogo !== false;

	return (
		<>
			<InspectorControls>
				<PanelBody
					title={ __( 'Now Playing Settings', 'radio-player-page' ) }
					initialOpen={ true }
				>
					{ isMissing && (
						<Notice status="warning" isDismissible={ false }>
							{ __(
								'This radio station no longer exists or is not published. Choose another one.',
								'radio-player-page'
							) }
						</Notice>
					) }
					<SelectControl
						label={ __( 'Radio Station', 'radio-player-page' ) }
						value={
							stationId > 0 && resolved ? String( stationId ) : ''
						}
						options={ options }
						help={ help }
						onChange={ ( value ) => {
							const id = parseInt( value, 10 );
							const index = stations.findIndex(
								( station ) => Number( station.id ) === id
							);
							if ( index >= 0 ) {
								setAttributes( {
									stationId: id,
									stationIndex: index,
								} );
							}
						} }
					/>
					<ToggleControl
						label={ __(
							'Show Radio Show Logo',
							'radio-player-page'
						) }
						checked={ showLogoValue }
						onChange={ ( value ) =>
							setAttributes( { showLogo: value } )
						}
					/>
				</PanelBody>
			</InspectorControls>
			<div { ...blockProps }>
				<ServerSideRender
					block={ blockName }
					attributes={ {
						stationId,
						stationIndex,
						showLogo: showLogoValue,
					} }
				/>
			</div>
		</>
	);
}
