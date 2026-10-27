<?php
/**
 * Architecture guard for the pure core in includes/src/.
 *
 * @package radio-player-page
 */

namespace RadioPlayerPage\Tests\Unit\Architecture;

use Yoast\PHPUnitPolyfills\TestCases\TestCase;

/**
 * Keeps WordPress and the plugin's global API out of includes/src/ (except wp/),
 * and keeps each core file to the guard plus one final class (ADR 0028).
 */
final class PureCoreTest extends TestCase {

	/**
	 * Prefixes of WordPress and plugin functions. `_` covers `__()`, `_e()`, `_x()`, `_n()`.
	 */
	const WORDPRESS_PREFIXES = array( '_', 'add_', 'apply_', 'current_', 'delete_', 'do_', 'doing_', 'esc_', 'get_', 'has_', 'is_', 'plugin_', 'plugins_', 'radplapag_', 'register_', 'remove_', 'sanitize_', 'set_', 'update_', 'wp_' );

	/**
	 * WordPress functions without one of those prefixes.
	 */
	const WORDPRESS_FUNCTIONS = array( 'absint', 'admin_url', 'check_admin_referer', 'check_ajax_referer', 'checked', 'date_i18n', 'disabled', 'home_url', 'human_time_diff', 'load_plugin_textdomain', 'map_deep', 'maybe_serialize', 'maybe_unserialize', 'mysql2date', 'nocache_headers', 'number_format_i18n', 'rest_url', 'restore_current_blog', 'selected', 'shortcode_atts', 'site_url', 'status_header', 'switch_to_blog', 'trailingslashit', 'translate', 'untrailingslashit', 'user_can' );

	/**
	 * Every core file passes the scanner.
	 *
	 * @dataProvider data_core_files
	 *
	 * @param string $relative Path relative to includes/src/.
	 */
	public function test_core_file_is_pure( $relative ) {
		$code = file_get_contents( self::src_dir() . '/' . $relative ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
		$this->assertIsString( $code );
		$this->assertSame( array(), self::scan( $code ), $relative );
	}

	/**
	 * Core files to scan.
	 *
	 * @return array<string, array{string}>
	 */
	public function data_core_files() {
		$files = array();
		foreach ( self::core_files() as $relative ) {
			$files[ $relative ] = array( $relative );
		}
		return $files;
	}

	/**
	 * The file list is not empty and leaves out the WordPress adapters.
	 */
	public function test_core_files_include_the_autoloader_and_skip_adapters() {
		$files = self::core_files();

		$this->assertContains( 'class-autoloader.php', $files );
		foreach ( $files as $relative ) {
			$this->assertStringStartsNotWith( 'wp/', $relative );
		}
	}

	/**
	 * Code that only uses PHP passes, including names that look like WordPress.
	 *
	 * @dataProvider data_clean_code
	 *
	 * @param string $code PHP source.
	 */
	public function test_scanner_accepts_clean_code( $code ) {
		$this->assertSame( array(), self::scan( $code ) );
	}

	/**
	 * Inputs for test_scanner_accepts_clean_code().
	 *
	 * @return array<string, array{string}>
	 */
	public function data_clean_code() {
		return array(
			'php only'                     => array(
				self::class_with(
					'$name = strtolower( \trim( (string) $value ) );',
					'if ( is_string( $value ) && \is_array( array() ) ) {',
					'	$name = get_class( $this ) . __DIR__;',
					'}',
					'$this->get_post( $name );',
					'self::wp_timezone();',
					'static::add_slot( new \DateTimeImmutable( \'now\', new \DateTimeZone( \'UTC\' ) ) );',
					'$callback = function ( \DateTimeInterface $date ) use ( $name ) {',
					'	return $date instanceof \DateTimeImmutable ? Probe::class : $name;',
					'};',
					'// get_post( 1 ); __( \'Monday\' ); new WP_Error();',
					'return array( \'get_post\', "wp_timezone", \'WP_Error\', $callback, Sub\get_post( 1 ) );'
				),
			),
			'methods named like wordpress' => array(
				self::file_with(
					'namespace RadioPlayerPage\Probe;',
					'',
					'defined( \'ABSPATH\' ) || exit;',
					'',
					'final class Probe {',
					'	const WP_LIKE = 1;',
					'	public function get_post( $id ) {',
					'		return $id + self::WP_LIKE;',
					'	}',
					'	public static function &wp_timezone() {',
					'		static $zone = null;',
					'		return $zone;',
					'	}',
					'}'
				),
			),
			'use statements before guard'  => array(
				self::file_with(
					'/**',
					' * File docblock.',
					' */',
					'',
					'namespace RadioPlayerPage\Probe;',
					'',
					'use RadioPlayerPage\Schedule\Time;',
					'use DateTimeImmutable;',
					'',
					'defined( \'ABSPATH\' ) || exit;',
					'',
					'final class Probe {',
					'	public function run() {',
					'		return Time::class . DateTimeImmutable::class . "{$this->name}";',
					'	}',
					'}'
				),
			),
		);
	}

	/**
	 * Each kind of violation is reported, with its line when it has one.
	 *
	 * @dataProvider data_violations
	 *
	 * @param string             $code     PHP source.
	 * @param array<int, string> $expected Expected messages.
	 */
	public function test_scanner_reports_violation( $code, array $expected ) {
		$this->assertSame( $expected, self::scan( $code ) );
	}

	/**
	 * Inputs for test_scanner_reports_violation(). Body lines of class_with() start at line 8.
	 *
	 * @return array<string, array{string, array<int, string>}>
	 */
	public function data_violations() {
		return array(
			'wordpress function'                 => array(
				self::class_with( 'return get_post( $value );' ),
				array( 'line 8: calls WordPress or plugin function get_post()' ),
			),
			'fully qualified wordpress function' => array(
				self::class_with( 'return \wp_timezone();' ),
				array( 'line 8: calls WordPress or plugin function wp_timezone()' ),
			),
			'is_ function that php lacks'        => array(
				self::class_with( 'return is_admin();' ),
				array( 'line 8: calls WordPress or plugin function is_admin()' ),
			),
			'translation functions'              => array(
				self::class_with(
					'$day = __( \'Monday\', \'radio-player-page\' );',
					'_e( \'Monday\', \'radio-player-page\' );',
					'return _x( \'Mon\', \'day\', \'radio-player-page\' ) . _n( \'a\', \'b\', 2, \'radio-player-page\' );'
				),
				array(
					'line 8: calls WordPress or plugin function __()',
					'line 9: calls WordPress or plugin function _e()',
					'line 10: calls WordPress or plugin function _x()',
					'line 10: calls WordPress or plugin function _n()',
				),
			),
			'hooks and capabilities'             => array(
				self::class_with(
					'do_action( \'x\' );',
					'return current_user_can( \'edit_posts\' ) ? apply_filters( \'x\', $value ) : null;'
				),
				array(
					'line 8: calls WordPress or plugin function do_action()',
					'line 9: calls WordPress or plugin function current_user_can()',
					'line 9: calls WordPress or plugin function apply_filters()',
				),
			),
			'wordpress function without prefix'  => array(
				self::class_with( 'return absint( trailingslashit( $value ) );' ),
				array(
					'line 8: calls WordPress or plugin function absint()',
					'line 8: calls WordPress or plugin function trailingslashit()',
				),
			),
			'plugin function'                    => array(
				self::class_with( 'return \radplapag_get_program_data( $value );' ),
				array( 'line 8: calls WordPress or plugin function radplapag_get_program_data()' ),
			),
			'wordpress class in new'             => array(
				self::class_with( 'return new \WP_Error( \'code\' );' ),
				array( 'line 8: uses WordPress class or constant WP_Error' ),
			),
			'wordpress classes as types'         => array(
				self::class_with(
					'return function ( \WP_Post $post, \wpdb $db ): ?WP_Error {',
					'	return $post instanceof WP_Post ? null : WP_Error::class;',
					'};'
				),
				array(
					'line 8: uses WordPress class or constant WP_Post',
					'line 8: uses WordPress class or constant wpdb',
					'line 8: uses WordPress class or constant WP_Error',
					'line 9: uses WordPress class or constant WP_Post',
					'line 9: uses WordPress class or constant WP_Error',
				),
			),
			'wordpress class imported'           => array(
				self::file_with(
					'namespace RadioPlayerPage\Probe;',
					'',
					'use WP_Error;',
					'',
					'defined( \'ABSPATH\' ) || exit;',
					'',
					'final class Probe {}'
				),
				array( 'line 4: uses WordPress class or constant WP_Error' ),
			),
			'wordpress constant'                 => array(
				self::class_with( 'return WP_DEBUG ? 1 : 0;' ),
				array( 'line 8: uses WordPress class or constant WP_DEBUG' ),
			),
			'no guard'                           => array(
				self::file_with(
					'namespace RadioPlayerPage\Probe;',
					'',
					'final class Probe {}'
				),
				array( 'does not start with defined( \'ABSPATH\' ) || exit;' ),
			),
			'guard after code'                   => array(
				self::file_with(
					'namespace RadioPlayerPage\Probe;',
					'',
					'$loaded = true;',
					'defined( \'ABSPATH\' ) || exit;',
					'',
					'final class Probe {}'
				),
				array( 'does not start with defined( \'ABSPATH\' ) || exit;' ),
			),
			'two classes'                        => array(
				self::file_with(
					'namespace RadioPlayerPage\Probe;',
					'',
					'defined( \'ABSPATH\' ) || exit;',
					'',
					'final class Probe {}',
					'final class Other {}'
				),
				array( 'declares 2 classes, interfaces or traits; expected one final class' ),
			),
			'no class'                           => array(
				self::file_with(
					'namespace RadioPlayerPage\Probe;',
					'',
					'defined( \'ABSPATH\' ) || exit;'
				),
				array( 'declares 0 classes, interfaces or traits; expected one final class' ),
			),
			'interface'                          => array(
				self::file_with(
					'namespace RadioPlayerPage\Probe;',
					'',
					'defined( \'ABSPATH\' ) || exit;',
					'',
					'interface Probe {}'
				),
				array( 'line 6: declares interface Probe; expected one final class' ),
			),
			'class not final'                    => array(
				self::file_with(
					'namespace RadioPlayerPage\Probe;',
					'',
					'defined( \'ABSPATH\' ) || exit;',
					'',
					'class Probe {}'
				),
				array( 'line 6: class Probe is not final' ),
			),
			'function outside the class'         => array(
				self::file_with(
					'namespace RadioPlayerPage\Probe;',
					'',
					'defined( \'ABSPATH\' ) || exit;',
					'',
					'function helper() {}',
					'',
					'final class Probe {}'
				),
				array( 'line 6: declares a function outside the class' ),
			),
		);
	}

	/**
	 * Returns the problems found in a core file: the guard first, then line
	 * problems in source order, then the class count.
	 *
	 * @param string $code PHP source.
	 * @return array<int, string>
	 */
	private static function scan( $code ) {
		$tokens   = self::tokens( $code );
		$problems = array();

		if ( ! self::starts_with_guard( $tokens ) ) {
			$problems[] = 'does not start with defined( \'ABSPATH\' ) || exit;';
		}

		$depth        = 0;
		$declarations = 0;
		foreach ( $tokens as $i => $token ) {
			$prev = $i > 0 ? $tokens[ $i - 1 ]['type'] : '';
			switch ( $token['type'] ) {
				case '{':
				case 'T_CURLY_OPEN':
				case 'T_DOLLAR_OPEN_CURLY_BRACES':
					++$depth;
					break;
				case '}':
					--$depth;
					break;
				case 'T_CLASS':
				case 'T_INTERFACE':
				case 'T_TRAIT':
				case 'T_ENUM':
					if ( 'T_CLASS' === $token['type'] && in_array( $prev, array( 'T_DOUBLE_COLON', 'T_NEW' ), true ) ) {
						break;
					}
					++$declarations;
					$name = isset( $tokens[ $i + 1 ] ) ? $tokens[ $i + 1 ]['text'] : '';
					if ( 'T_CLASS' !== $token['type'] ) {
						$kind       = strtolower( substr( $token['type'], 2 ) );
						$problems[] = "line {$token['line']}: declares {$kind} {$name}; expected one final class";
					} elseif ( 'T_FINAL' !== $prev ) {
						$problems[] = "line {$token['line']}: class {$name} is not final";
					}
					break;
				case 'T_FUNCTION':
					if ( 0 === $depth ) {
						$problems[] = "line {$token['line']}: declares a function outside the class";
					}
					break;
				case 'NAME':
					$problem = self::name_problem( $tokens, $i );
					if ( null !== $problem ) {
						$problems[] = "line {$token['line']}: {$problem}";
					}
					break;
			}
		}

		if ( 1 !== $declarations ) {
			$problems[] = "declares {$declarations} classes, interfaces or traits; expected one final class";
		}

		return $problems;
	}

	/**
	 * Significant tokens, with names merged into one NAME token as PHP 8 does.
	 *
	 * PHP 7.4 splits `\wp_timezone` into T_NS_SEPARATOR and T_STRING; PHP 8 has
	 * T_NAME_* tokens. Both become NAME, so the scanner works on both.
	 *
	 * @param string $code PHP source.
	 * @return array<int, array{type: string, text: string, line: int}>
	 */
	private static function tokens( $code ) {
		$name_parts = array( 'T_STRING', 'T_NS_SEPARATOR', 'T_NAME_QUALIFIED', 'T_NAME_FULLY_QUALIFIED', 'T_NAME_RELATIVE' );
		$skipped    = array( 'T_WHITESPACE', 'T_COMMENT', 'T_DOC_COMMENT', 'T_OPEN_TAG' );

		$tokens  = array();
		$line    = 1;
		$in_name = false;
		foreach ( token_get_all( $code ) as $raw ) {
			if ( is_array( $raw ) ) {
				$type = token_name( $raw[0] );
				$text = $raw[1];
				$line = $raw[2];
			} else {
				$type = $raw;
				$text = $raw;
			}

			if ( in_array( $type, $skipped, true ) ) {
				$in_name = false;
				continue;
			}

			if ( in_array( $type, $name_parts, true ) ) {
				if ( $in_name ) {
					$tokens[ count( $tokens ) - 1 ]['text'] .= $text;
				} else {
					$tokens[] = array(
						'type' => 'NAME',
						'text' => $text,
						'line' => $line,
					);
				}
				$in_name = true;
				continue;
			}

			$in_name  = false;
			$tokens[] = array(
				'type' => $type,
				'text' => $text,
				'line' => $line,
			);
		}

		return $tokens;
	}

	/**
	 * Whether the code before anything else is the namespace, its imports and the ABSPATH guard.
	 *
	 * @param array<int, array{type: string, text: string, line: int}> $tokens Significant tokens.
	 * @return bool
	 */
	private static function starts_with_guard( array $tokens ) {
		$i = 0;
		if ( isset( $tokens[ $i ] ) && 'T_NAMESPACE' === $tokens[ $i ]['type'] ) {
			$i = self::after_semicolon( $tokens, $i );
		}
		while ( isset( $tokens[ $i ] ) && 'T_USE' === $tokens[ $i ]['type'] ) {
			$i = self::after_semicolon( $tokens, $i );
		}

		$guard = array_column( array_slice( $tokens, $i, 7 ), 'text' );
		return array( 'defined', '(', '\'ABSPATH\'', ')', '||', 'exit', ';' ) === $guard;
	}

	/**
	 * Index of the token after the next semicolon.
	 *
	 * @param array<int, array{type: string, text: string, line: int}> $tokens Significant tokens.
	 * @param int                                                      $i      Start index.
	 * @return int
	 */
	private static function after_semicolon( array $tokens, $i ) {
		$count = count( $tokens );
		while ( $i < $count && ';' !== $tokens[ $i ]['type'] ) {
			++$i;
		}
		return $i + 1;
	}

	/**
	 * The problem with a name token, if it calls WordPress or names a WordPress class or constant.
	 *
	 * Member names (after `->`, `?->`, `::`), declarations and namespaced names are not checked.
	 *
	 * @param array<int, array{type: string, text: string, line: int}> $tokens Significant tokens.
	 * @param int                                                      $i      Index of the NAME token.
	 * @return string|null
	 */
	private static function name_problem( array $tokens, $i ) {
		$prev    = $i > 0 ? $tokens[ $i - 1 ]['type'] : '';
		$members = array( 'T_OBJECT_OPERATOR', 'T_NULLSAFE_OBJECT_OPERATOR', 'T_DOUBLE_COLON', 'T_FUNCTION', 'T_CONST', 'T_CLASS', 'T_INTERFACE', 'T_TRAIT', 'T_ENUM', 'T_NAMESPACE', 'T_GOTO' );
		if ( in_array( $prev, $members, true ) || ( $i > 1 && '&' === $tokens[ $i - 1 ]['text'] && 'T_FUNCTION' === $tokens[ $i - 2 ]['type'] ) ) {
			return null;
		}

		$name = self::global_name( $tokens[ $i ]['text'] );
		if ( null === $name ) {
			return null;
		}

		$is_call = isset( $tokens[ $i + 1 ] ) && '(' === $tokens[ $i + 1 ]['type'] && 'T_NEW' !== $prev;
		if ( $is_call ) {
			return self::is_wordpress_function( $name ) ? "calls WordPress or plugin function {$name}()" : null;
		}

		if ( 0 === strpos( $name, 'WP_' ) || 'wpdb' === strtolower( $name ) ) {
			return "uses WordPress class or constant {$name}";
		}
		return null;
	}

	/**
	 * The global name a token refers to, or null for a namespaced name.
	 *
	 * @param string $text Name as written: `get_post`, `\get_post` or `Sub\get_post`.
	 * @return string|null
	 */
	private static function global_name( $text ) {
		if ( 0 === strpos( $text, '\\' ) ) {
			$text = substr( $text, 1 );
		}
		return false === strpos( $text, '\\' ) ? $text : null;
	}

	/**
	 * Whether a function is WordPress's or the plugin's. Prefixed names that PHP itself defines
	 * (is_string(), get_class()) are allowed.
	 *
	 * @param string $name Global function name.
	 * @return bool
	 */
	private static function is_wordpress_function( $name ) {
		$name = strtolower( $name );
		if ( in_array( $name, self::WORDPRESS_FUNCTIONS, true ) ) {
			return true;
		}
		foreach ( self::WORDPRESS_PREFIXES as $prefix ) {
			if ( 0 === strpos( $name, $prefix ) ) {
				return ! ( function_exists( $name ) && ( new \ReflectionFunction( $name ) )->isInternal() );
			}
		}
		return false;
	}

	/**
	 * Absolute path of includes/src/.
	 *
	 * @return string
	 */
	private static function src_dir() {
		return RADPLAPAG_TESTS_PLUGIN_DIR . '/includes/src';
	}

	/**
	 * PHP files under includes/src/, relative to it, without the wp/ adapters.
	 *
	 * @return array<int, string>
	 */
	private static function core_files() {
		$files    = array();
		$iterator = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( self::src_dir(), \FilesystemIterator::SKIP_DOTS )
		);
		foreach ( $iterator as $file ) {
			$relative = substr( $file->getPathname(), strlen( self::src_dir() ) + 1 );
			$relative = str_replace( DIRECTORY_SEPARATOR, '/', $relative );
			if ( 'php' === $file->getExtension() && 0 !== strpos( $relative, 'wp/' ) ) {
				$files[] = $relative;
			}
		}
		sort( $files );
		return $files;
	}

	/**
	 * A PHP file made of the given lines after the open tag (line 1).
	 *
	 * @param string ...$lines Source lines, starting at line 2.
	 * @return string
	 */
	private static function file_with( ...$lines ) {
		return "<?php\n" . implode( "\n", $lines ) . "\n";
	}

	/**
	 * A valid core file whose method body is the given lines, starting at line 8.
	 *
	 * @param string ...$body Method body lines.
	 * @return string
	 */
	private static function class_with( ...$body ) {
		return self::file_with(
			'namespace RadioPlayerPage\Probe;',
			'',
			'defined( \'ABSPATH\' ) || exit;',
			'',
			'final class Probe {',
			'	public function run( $value ) {',
			...array_merge( $body, array( '	}', '}' ) )
		);
	}
}
