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
 * The take first reads the option, so a lock still held costs one read and no write
 * (K86). Both takes are a single query that the database decides on the unique
 * option_name: an INSERT IGNORE when the option is missing and a conditional UPDATE on
 * the value read when it has expired. Only the request that changes one row wins. While it
 * migrates, the request renews the lock it holds with the same compare-and-set, so a
 * slow migration keeps it and one that lost it finds out (ADR 0040).
 *
 * @since 3.5.0
 */
final class Migration_Lock {

	/**
	 * Name of the lock option.
	 */
	const OPTION = 'radplapag_migrating';

	/**
	 * Seconds the lock lasts while the migration runs, from the take or the last renewal.
	 */
	const TTL = 120;

	/**
	 * Expiry this request stored, or null when it does not hold the lock.
	 *
	 * @var int|null
	 */
	private static $until = null;

	/**
	 * Takes the lock until $now + $ttl unless another request holds it.
	 *
	 * Reads the option from the table (the cache is dropped first): a held lock returns
	 * without writing, a missing one is inserted and an expired one is updated.
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
		self::flush_cache();
		$stored = get_option( self::OPTION );
		if ( false === $stored ) {
			$added = $wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->options} ( option_name, option_value, autoload ) VALUES ( %s, %s, 'off' )", self::OPTION, $until ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Atomic take; add_option() overwrites with ON DUPLICATE KEY UPDATE (ADR 0038).
			self::flush_cache();
			if ( 1 !== $added ) {
				return false;
			}

			self::$until = $now + $ttl;
			return true;
		}

		if ( ! is_string( $stored ) || Upgrade_Policy::is_lock_held( $stored, $now ) ) {
			return false;
		}

		$taken = $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND option_value = %s", $until, self::OPTION, $stored ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Compare-and-set on the value read, so only one request takes an expired lock (ADR 0037).
		self::flush_cache();
		if ( 1 !== $taken ) {
			return false;
		}

		self::$until = $now + $ttl;
		return true;
	}

	/**
	 * Whether this request holds the lock (took it and has not released it).
	 *
	 * @since 3.5.0
	 *
	 * @return bool
	 */
	public static function is_held(): bool {
		return null !== self::$until;
	}

	/**
	 * Extends the lock this request holds until $now + $ttl.
	 *
	 * A compare-and-set on the value this request stored: it fails when another request
	 * has taken the lock since. A renewal that would not move the expiry only checks
	 * that the stored value is still this request's.
	 *
	 * @since 3.5.0
	 *
	 * @param int $now Current Unix time.
	 * @param int $ttl Seconds the lock lasts from now.
	 * @return bool True when this request still holds the lock.
	 */
	public static function renew( int $now, int $ttl ): bool {
		global $wpdb;

		if ( null === self::$until ) {
			return false;
		}

		$until = $now + $ttl;
		if ( $until <= self::$until ) {
			self::flush_cache();
			return (string) get_option( self::OPTION ) === (string) self::$until;
		}

		$renewed = $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND option_value = %s", (string) $until, self::OPTION, (string) self::$until ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- Compare-and-set on this request's value, so a lock taken by another request is not extended (ADR 0040).
		self::flush_cache();
		if ( 1 !== $renewed ) {
			return false;
		}

		self::$until = $until;
		return true;
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
		self::$until = $until;
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
		self::$until = null;
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
