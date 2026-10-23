<?php
/**
 * Characterization of the public PHP API: radplapag_* functions, Radplapag_* classes
 * and RADPLAPAG_* constants (SPEC.md §3.4, 3.4.2).
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Integration\Contract;

use ReflectionClass;
use ReflectionFunction;
use ReflectionFunctionAbstract;
use ReflectionMethod;
use ReflectionNamedType;
use ReflectionParameter;
use WP_UnitTestCase;

/**
 * Pins the name, parameters (type, by reference, default) and return type of every
 * radplapag_* function, every public method of the Radplapag_* classes and every
 * RADPLAPAG_* constant of 3.4.2, with nothing missing and nothing extra. A third party
 * can call any of them, so they are contract; a refactor keeps them as thin wrappers.
 *
 * The table was generated from the code and compared, by tokens, with
 * `git show v3.4.2:<file>`. uninstall.php is checked by tokens only: loading it
 * deletes the plugin's data.
 */
final class PublicApiTest extends WP_UnitTestCase {

	/**
	 * File → function → signature, as `(<parameters>)[: <return type>]`.
	 */
	const FUNCTIONS = array(
		'radio-player-page.php'                      => array(
			'radplapag_map_cpt_meta_cap'             => '(array $caps, string $cap, int $user_id, array $args): array',
			'radplapag_register_schedule_block'      => '()',
			'radplapag_enqueue_schedule_block_editor_assets' => '()',
			'radplapag_register_programs_list_block' => '()',
			'radplapag_enqueue_programs_list_block_editor_assets' => '()',
			'radplapag_register_now_playing_block'   => '()',
			'radplapag_enqueue_now_playing_block_editor_assets' => '()',
			'radplapag_get_station_for_current_page' => '()',
			'radplapag_output_clean_page'            => '()',
		),
		'admin/admin-strings.php'                    => array(
			'radplapag_get_admin_strings' => '(): array',
		),
		'admin/admin.php'                            => array(
			'radplapag_admin_scripts'                => '($hook_suffix)',
			'radplapag_admin_menu'                   => '()',
			'radplapag_remove_duplicate_rpp_submenu' => '()',
			'radplapag_menu_redirect_to_stations'    => '()',
		),
		'blocks/programs-list/render.php'            => array(
			'radplapag_render_programs_list_block' => '($attributes, $content, $block)',
		),
		'blocks/schedule/render.php'                 => array(
			'radplapag_render_schedule_block' => '($attributes, $content, $block)',
		),
		'includes/radplapag-now-playing-block.php'   => array(
			'radplapag_get_now_playing_for_station' => '($station_index)',
		),
		'includes/radplapag-program-cpt.php'         => array(
			'radplapag_register_program_post_type'  => '()',
			'radplapag_grant_program_caps_to_manage_options' => '($allcaps, $caps, $args, $user)',
			'radplapag_register_program_meta'       => '()',
			'radplapag_get_program_data'            => '($post_id, $require_published = false)',
			'radplapag_get_all_programs_for_select' => '()',
			'radplapag_add_program_meta_boxes'      => '()',
			'radplapag_render_program_meta_boxes'   => '($post)',
			'radplapag_save_program_meta'           => '($post_id)',
			'radplapag_program_edit_scripts'        => '()',
		),
		'includes/radplapag-programs-list-block.php' => array(
			'radplapag_get_programs_list_for_station' => '($station_index)',
		),
		'includes/radplapag-schedule-block.php'      => array(
			'radplapag_parse_time_to_minutes'            => '($time): int',
			'radplapag_is_slot_active'                   => '($start, $end, int $current_minutes, bool $is_prev_day_crossing = false): bool',
			'radplapag_get_schedule_day_keys_and_labels' => '(): array',
			'radplapag_build_programs_map'               => '(array $station): array',
			'radplapag_get_schedule_for_station'         => "(\$station_index, string \$day_order = 'current_first')",
		),
		'includes/radplapag-station-cpt.php'         => array(
			'radplapag_register_station_post_type'       => '()',
			'radplapag_station_use_classic_editor'       => '($use_block_editor, $post_type)',
			'radplapag_grant_station_caps_to_manage_options' => '($allcaps, $caps, $args, $user)',
			'radplapag_register_station_meta'            => '()',
			'radplapag_sanitize_station_schedule'        => '($schedule_input)',
			'radplapag_add_station_meta_boxes'           => '()',
			'radplapag_render_station_details_meta_box'  => '($post)',
			'radplapag_render_station_schedule_meta_box' => '($post)',
			'radplapag_save_station_meta'                => '($post_id)',
			'radplapag_station_schedule_errors_notice'   => '()',
			'radplapag_get_player_pages_assigned_to_other_stations' => '($exclude_post_id = 0)',
			'radplapag_station_edit_scripts'             => '()',
		),
		'includes/radplapag-stations.php'            => array(
			'radplapag_get_stations' => '(): array',
			'radplapag_get_config'   => '(): array',
		),
		'includes/radplapag-upgrade.php'             => array(
			'radplapag_legacy_has_migratable_stations'   => '(): bool',
			'radplapag_count_published_stations'         => '(): int',
			'radplapag_ensure_schema_version_option'     => '(): void',
			'radplapag_migration_resolve_author_user_id' => '(): int',
			'radplapag_maybe_clear_migration_conflict_flag' => '(): void',
			'radplapag_run_legacy_migration_if_needed'   => '(): void',
			'radplapag_schedule_legacy_migration'        => '(): void',
			'radplapag_on_upgrader_process_complete'     => '($upgrader, array $options): void',
			'radplapag_handle_migration_notice_dismiss'  => '(): void',
			'radplapag_migration_admin_notices'          => '(): void',
		),
	);

	/**
	 * Functions of uninstall.php, as in FUNCTIONS, read by tokens.
	 */
	const UNINSTALL_FUNCTIONS = array(
		'radplapag_uninstall_delete_programs'  => '(): void',
		'radplapag_uninstall_delete_stations'  => '(): void',
		'radplapag_uninstall_delete_site_data' => '(): void',
		'radplapag_uninstall_plugin'           => '(): void',
	);

	/**
	 * File → class → public method → signature, as in FUNCTIONS (`static ` first for
	 * static methods).
	 */
	const CLASSES = array(
		'includes/data/class-radplapag-program-config.php' => array(
			'Radplapag_Program_Config' => array(
				'from_post_id' => 'static (int $post_id): ?Radplapag_Program_Config',
				'get_post_id'  => '(): int',
				'to_array'     => '(): array',
			),
		),
		'includes/data/class-radplapag-station-config.php' => array(
			'Radplapag_Station_Config' => array(
				'from_post' => 'static ($post): ?Radplapag_Station_Config',
				'to_array'  => '(): array',
			),
		),
		'includes/migration/class-radplapag-migrator-settings-to-cpt.php' => array(
			'Radplapag_Migrator_Settings_To_Cpt' => array(
				'run' => 'static (int $author_user_id)',
			),
		),
	);

	/**
	 * Constants with a fixed value. RADPLAPAG_PLUGIN_FILE is checked apart (its value is
	 * a path).
	 */
	const CONSTANTS = array(
		'RADPLAPAG_DB_VERSION'                          => '330',
		'RADPLAPAG_NOW_PLAYING_UPCOMING_WINDOW_MINUTES' => 10,
	);

	/**
	 * Prefix of the constants the test bootstraps define, outside the plugin's API.
	 */
	const TEST_CONSTANT_PREFIX = 'RADPLAPAG_TESTS_';

	/**
	 * Loads what the plugin loads on demand: the migrator (only when a migration runs).
	 */
	public static function set_up_before_class() {
		parent::set_up_before_class();

		require_once self::plugin_dir() . '/includes/migration/class-radplapag-migrator-settings-to-cpt.php';
	}

	// ── Functions ───────────────────────────────────────────────────────────────

	/**
	 * Each function has the 3.4.2 signature and lives in its 3.4.2 file.
	 */
	public function test_functions_keep_their_signature_and_file() {
		$actual   = array();
		$expected = array();
		foreach ( self::FUNCTIONS as $file => $functions ) {
			foreach ( $functions as $name => $signature ) {
				$expected[ $name ] = array( $file, $signature );
				if ( function_exists( $name ) ) {
					$function        = new ReflectionFunction( $name );
					$actual[ $name ] = array( self::relative( (string) $function->getFileName() ), self::signature( $function ) );
				}
			}
		}

		$this->assertSame( $expected, $actual );
	}

	/**
	 * No radplapag_* function exists outside the table. Only the plugin's own files count:
	 * not uninstall.php (another test may have loaded it), tests/ or anything outside the
	 * plugin, such as the e2e mu-plugin the tests environment mounts.
	 */
	public function test_no_other_radplapag_function_is_defined() {
		$expected = array();
		foreach ( self::FUNCTIONS as $functions ) {
			$expected = array_merge( $expected, array_keys( $functions ) );
		}

		$defined = array();
		foreach ( get_defined_functions()['user'] as $name ) {
			if ( 0 !== strpos( $name, 'radplapag_' ) ) {
				continue;
			}
			$function = new ReflectionFunction( $name );
			$file     = (string) $function->getFileName();
			$relative = self::relative( $file );
			if ( $relative !== $file && 'uninstall.php' !== $relative && 0 !== strpos( $relative, 'tests/' ) ) {
				$defined[] = $function->getName();
			}
		}

		sort( $expected );
		sort( $defined );
		$this->assertSame( $expected, $defined );
	}

	/**
	 * The uninstall file declares exactly the 3.4.2 functions, with their signature.
	 */
	public function test_uninstall_functions_keep_their_signature() {
		$this->assertSame( self::UNINSTALL_FUNCTIONS, self::token_signatures( self::plugin_dir() . '/uninstall.php' ) );
	}

	// ── Classes ─────────────────────────────────────────────────────────────────

	/**
	 * Each class lives in its 3.4.2 file and has exactly the 3.4.2 public methods, with
	 * their signature.
	 */
	public function test_classes_keep_their_public_methods() {
		$actual   = array();
		$expected = array();
		foreach ( self::CLASSES as $file => $classes ) {
			foreach ( $classes as $name => $methods ) {
				$expected[ $name ] = array( $file, $methods );
				if ( ! class_exists( $name, false ) ) {
					continue;
				}
				$class   = new ReflectionClass( $name );
				$publics = array();
				foreach ( $class->getMethods( ReflectionMethod::IS_PUBLIC ) as $method ) {
					$publics[ $method->getName() ] = ( $method->isStatic() ? 'static ' : '' ) . self::signature( $method );
				}
				$actual[ $name ] = array( self::relative( (string) $class->getFileName() ), $publics );
			}
		}

		$this->assertSame( $expected, $actual );
	}

	/**
	 * No Radplapag_* class, interface or trait exists outside the table.
	 */
	public function test_no_other_radplapag_class_is_declared() {
		$expected = array();
		foreach ( self::CLASSES as $classes ) {
			$expected = array_merge( $expected, array_keys( $classes ) );
		}

		$declared = array_values(
			array_filter(
				array_merge( get_declared_classes(), get_declared_interfaces(), get_declared_traits() ),
				static function ( $name ) {
					return 0 === stripos( $name, 'Radplapag_' );
				}
			)
		);

		sort( $expected );
		sort( $declared );
		$this->assertSame( $expected, $declared );
	}

	// ── Constants ───────────────────────────────────────────────────────────────

	/**
	 * The RADPLAPAG_* constants are exactly these, with their value; RADPLAPAG_PLUGIN_FILE
	 * is the main plugin file.
	 */
	public function test_constants_keep_their_value() {
		$defined = array();
		foreach ( get_defined_constants( true )['user'] as $name => $value ) {
			if ( 0 === strpos( $name, 'RADPLAPAG_' ) && 0 !== strpos( $name, self::TEST_CONSTANT_PREFIX ) ) {
				$defined[ $name ] = $value;
			}
		}
		ksort( $defined );

		$expected = self::CONSTANTS + array( 'RADPLAPAG_PLUGIN_FILE' => self::plugin_dir() . '/radio-player-page.php' );
		ksort( $expected );

		$this->assertSame( $expected, $defined );
	}

	// ── Helpers ─────────────────────────────────────────────────────────────────

	/**
	 * Plugin directory, without a trailing slash.
	 *
	 * @return string
	 */
	private static function plugin_dir() {
		return dirname( __DIR__, 4 );
	}

	/**
	 * Path relative to the plugin directory.
	 *
	 * @param string $path Absolute path.
	 * @return string
	 */
	private static function relative( $path ) {
		$dir = self::plugin_dir() . '/';

		return 0 === strpos( $path, $dir ) ? substr( $path, strlen( $dir ) ) : $path;
	}

	/**
	 * Signature of a function or method, as `(<parameters>)[: <return type>]`.
	 *
	 * @param ReflectionFunctionAbstract $reflection Function or method.
	 * @return string
	 */
	private static function signature( ReflectionFunctionAbstract $reflection ) {
		$params = array_map( array( self::class, 'parameter' ), $reflection->getParameters() );
		$return = $reflection->hasReturnType() ? ': ' . self::type( $reflection->getReturnType() ) : '';

		return ( $reflection->returnsReference() ? '&' : '' ) . '(' . implode( ', ', $params ) . ')' . $return;
	}

	/**
	 * A parameter, as `[<type> ][&][...]$<name>[ = <default>]`.
	 *
	 * @param ReflectionParameter $param Parameter.
	 * @return string
	 */
	private static function parameter( ReflectionParameter $param ) {
		$text  = $param->hasType() ? self::type( $param->getType() ) . ' ' : '';
		$text .= ( $param->isPassedByReference() ? '&' : '' ) . ( $param->isVariadic() ? '...' : '' ) . '$' . $param->getName();

		if ( $param->isDefaultValueAvailable() ) {
			$text .= ' = ' . ( $param->isDefaultValueConstant() ? $param->getDefaultValueConstantName() : self::export( $param->getDefaultValue() ) );
		} elseif ( $param->isOptional() && ! $param->isVariadic() ) {
			$text .= ' = ?';
		}

		return $text;
	}

	/**
	 * A type as written in PHP 7.4 code (`?` for nullable).
	 *
	 * @param \ReflectionType|null $type Type.
	 * @return string
	 */
	private static function type( $type ) {
		if ( ! $type instanceof ReflectionNamedType ) {
			return (string) $type;
		}
		$nullable = $type->allowsNull() && ! in_array( $type->getName(), array( 'mixed', 'null' ), true );

		return ( $nullable ? '?' : '' ) . $type->getName();
	}

	/**
	 * A default value as written in code.
	 *
	 * @param mixed $value Default value.
	 * @return string
	 */
	private static function export( $value ) {
		if ( null === $value ) {
			return 'null';
		}
		if ( is_bool( $value ) ) {
			return $value ? 'true' : 'false';
		}
		if ( array() === $value ) {
			return 'array()';
		}

		return var_export( $value, true ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_var_export -- Formats a default value for comparison.
	}

	/**
	 * Function → signature of the named functions declared in a file, by tokens and
	 * in the format of signature() (whitespace and comments dropped).
	 *
	 * @param string $file PHP file.
	 * @return array<string, string>
	 */
	private static function token_signatures( $file ) {
		$tokens     = token_get_all( (string) file_get_contents( $file ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
		$count      = count( $tokens );
		$signatures = array();

		for ( $i = 0; $i < $count; $i++ ) {
			if ( ! is_array( $tokens[ $i ] ) || T_FUNCTION !== $tokens[ $i ][0] ) {
				continue;
			}
			$j = $i + 1;
			while ( is_array( $tokens[ $j ] ) && T_WHITESPACE === $tokens[ $j ][0] ) {
				++$j;
			}
			if ( ! is_array( $tokens[ $j ] ) || T_STRING !== $tokens[ $j ][0] ) {
				continue; // A closure.
			}
			$name      = $tokens[ $j ][1];
			$signature = '';
			for ( ++$j; $j < $count && '{' !== $tokens[ $j ] && ';' !== $tokens[ $j ]; $j++ ) {
				if ( is_array( $tokens[ $j ] ) && in_array( $tokens[ $j ][0], array( T_COMMENT, T_DOC_COMMENT ), true ) ) {
					continue;
				}
				$signature .= is_array( $tokens[ $j ] ) ? $tokens[ $j ][1] : $tokens[ $j ];
			}
			$signature           = (string) preg_replace( '/\s+/', ' ', trim( $signature ) );
			$signatures[ $name ] = str_replace( array( '( ', ' )', ' ,', ' :' ), array( '(', ')', ',', ':' ), $signature );
		}

		return $signatures;
	}
}
