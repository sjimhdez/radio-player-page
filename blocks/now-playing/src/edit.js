import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { SelectControl, PanelBody, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import ServerSideRender from '@wordpress/server-side-render';

import metadata from '../block.json';

const blockName = metadata.name;

/**
 * The edit function describes the structure of the block in the context of the editor.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#edit
 *
 * @param {Object}   props               Block props.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Updates block attributes.
 * @return {Element} Element to render.
 */
export default function Edit( { attributes, setAttributes } ) {
	const { stationIndex, showLogo } = attributes;
	const blockProps = useBlockProps();
	const stations = window.radplapagNowPlayingBlock?.stations || [];
	const options =
		stations.length === 0
			? [ { label: __( 'No Radio Stations configured', 'radio-player-page' ), value: 0 } ]
			: stations.map( ( station, index ) => ( {
					label: station.label || __( 'Radio Station', 'radio-player-page' ) + ' ' + ( index + 1 ),
					value: index,
			  } ) );
	const safeIndex = Math.max( 0, Math.min( stationIndex, stations.length ? stations.length - 1 : 0 ) );
	const showLogoValue = showLogo !== false;

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Now Playing Settings', 'radio-player-page' ) } initialOpen={ true }>
					<SelectControl
						label={ __( 'Radio Station', 'radio-player-page' ) }
						value={ safeIndex }
						options={ options }
						onChange={ ( value ) => setAttributes( { stationIndex: parseInt( value, 10 ) } ) }
					/>
					<ToggleControl
						label={ __( 'Show Radio Show Logo', 'radio-player-page' ) }
						checked={ showLogoValue }
						onChange={ ( value ) => setAttributes( { showLogo: value } ) }
					/>
				</PanelBody>
			</InspectorControls>
			<div { ...blockProps }>
				<ServerSideRender
					block={ blockName }
					attributes={ {
						stationIndex: safeIndex,
						showLogo: showLogoValue,
					} }
				/>
			</div>
		</>
	);
}
