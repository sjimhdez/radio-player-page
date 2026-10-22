<?php
/**
 * Atomic lock of the legacy radplapag_settings → CPT migration.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\WP;

use RadioPlayerPage\Upgrade\Upgrade_Policy;

defined( 'ABSPATH' ) || exit;

/**
 * The radplapag_migrating option: the Unix time at which the lock expires, without
 * autoload (ADR 0037, 0038).
 *
 * Both takes are a single query that the database decides on the unique option_name:
 * an INSERT IGNORE when the option is missing and a conditional UPDATE on the value
 * read when it has expired. Only the request that changes one row wins.
 *
 * @since 3.5.0
 */
final class Migration_Lock {

	/**
	 * Name of the lock option.
	 */
	const OPTION = 'radplapag_migrating';

	/**
	 * Takes the lock until $now + $ttl unless another request holds it.
	 *
	 * @since 3.5.0
	 *
	 * @param int $now Current Unix time.
	 * @param int $ttl Seconds the lock lasts.
	 * @return bool True when this request took the lock.
	 */
	public static function acquire( int $now, int $ttl ): bool {
		global $wpdb;

		$until = (string) ( $now + $ttl );
		$added = $wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->options} ( option_name, option_value, autoload ) VALUES ( %s, %s, 'off' )", self::OPTION, $until ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Atomic take; add_option() overwrites with ON DUPLICATE KEY UPDATE (ADR 0038).
		self::flush_cache();
		if ( 1 === $added ) {
			return true;
		}

		$stored = get_option( self::OPTION );
		if ( ! is_string( $stored ) || Upgrade_Policy::is_lock_held( $stored, $now ) ) {
			return false;
		}

		$taken = $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND option_value = %s", $until, self::OPTION, $stored ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Compare-and-set on the value read, so only one request takes an expired lock (ADR 0037).
		self::flush_cache();

		return 1 === $taken;
	}

	/**
	 * Keeps the lock held until a later time (after a failed migration).
	 *
	 * @since 3.5.0
	 *
	 * @param int $until Unix time at which the lock expires.
	 * @return void
	 */
	public static function hold_until( int $until ): void {
		update_option( self::OPTION, (string) $until, false );
	}

	/**
	 * Releases the lock.
	 *
	 * @since 3.5.0
	 *
	 * @return void
	 */
	public static function release(): void {
		delete_option( self::OPTION );
	}

	/**
	 * Drops the cached copies of the option after a direct query.
	 *
	 * @since 3.5.0
	 *
	 * @return void
	 */
	private static function flush_cache(): void {
		wp_cache_delete( self::OPTION, 'options' );
		wp_cache_delete( 'alloptions', 'options' );
		wp_cache_delete( 'notoptions', 'options' );
	}
}
