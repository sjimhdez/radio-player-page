<?php
/**
 * Autoloader for the RadioPlayerPage\ namespace.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage;

defined( 'ABSPATH' ) || exit;

/**
 * Loads RadioPlayerPage\ classes from includes/src/ with WordPress file names.
 *
 * Namespace segments become lowercase folders with `_` → `-`, and the class
 * lives in `class-<name>.php`: RadioPlayerPage\Schedule\Slot_Validator is
 * includes/src/schedule/class-slot-validator.php (ADR 0028).
 *
 * @since 3.5.0
 */
final class Autoloader {

	/**
	 * Namespace prefix handled by this loader.
	 */
	const PREFIX = 'RadioPlayerPage\\';

	/**
	 * Registers the loader with spl_autoload_register(). Safe to call more than once.
	 *
	 * @since 3.5.0
	 *
	 * @return void
	 */
	public static function register() {
		spl_autoload_register( array( self::class, 'load' ) );
	}

	/**
	 * Loads a class if it is under the prefix and its file exists.
	 *
	 * @since 3.5.0
	 *
	 * @param string $class_name Fully qualified class name.
	 * @return void
	 */
	public static function load( $class_name ) {
		$file = self::file_for( $class_name );
		if ( null !== $file && is_readable( $file ) ) {
			require_once $file;
		}
	}

	/**
	 * Returns the file for a class under the prefix, or null for any other class.
	 *
	 * @since 3.5.0
	 *
	 * @param string $class_name Fully qualified class name, with or without a leading backslash.
	 * @return string|null Absolute path; the file may not exist.
	 */
	public static function file_for( $class_name ) {
		$class_name = ltrim( $class_name, '\\' );
		if ( 0 !== strpos( $class_name, self::PREFIX ) ) {
			return null;
		}

		$relative = substr( $class_name, strlen( self::PREFIX ) );
		if ( '' === $relative ) {
			return null;
		}

		$segments   = explode( '\\', str_replace( '_', '-', strtolower( $relative ) ) );
		$name       = array_pop( $segments );
		$segments[] = 'class-' . $name . '.php';

		return __DIR__ . '/' . implode( '/', $segments );
	}
}
