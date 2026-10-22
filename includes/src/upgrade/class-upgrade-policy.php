<?php
/**
 * Decisions of the schema version and legacy migration callbacks.
 *
 * @package radio-player-page
 * @since 3.5.0
 */

namespace RadioPlayerPage\Upgrade;

defined( 'ABSPATH' ) || exit;

/**
 * Pure predicates behind the callbacks of radplapag-upgrade.php.
 *
 * The callbacks keep reading and writing options in the order of 3.4.2 and ask these
 * predicates about the values they read, so neither the order nor the laziness of the
 * reads changes.
 *
 * @since 3.5.0
 */
final class Upgrade_Policy {

	/**
	 * Whether the legacy option has a non-empty stations list.
	 *
	 * Any list counts, even one without array stations: it migrates none, the option is
	 * deleted and the notice says so (K32 in docs/known-issues.md, ADR 0037); the flat
	 * 1.0.x–1.1.x option has no stations key (K4).
	 *
	 * @since 3.5.0
	 *
	 * @param mixed $raw Value of radplapag_settings.
	 * @return bool
	 */
	public static function has_migratable_stations( $raw ): bool {
		if ( ! is_array( $raw ) || ! isset( $raw['stations'] ) || ! is_array( $raw['stations'] ) ) {
			return false;
		}
		return count( $raw['stations'] ) > 0;
	}

	/**
	 * Whether the stored schema version is the target one (strict comparison).
	 *
	 * @since 3.5.0
	 *
	 * @param mixed  $stored Value of radplapag_db_version.
	 * @param string $target Current schema version (RADPLAPAG_DB_VERSION).
	 * @return bool
	 */
	public static function is_current( $stored, string $target ): bool {
		return $target === $stored;
	}

	/**
	 * Number of published posts from the result of wp_count_posts().
	 *
	 * @since 3.5.0
	 *
	 * @param mixed $counts Result of wp_count_posts().
	 * @return int 0 without a publish count.
	 */
	public static function published_count( $counts ): int {
		if ( ! is_object( $counts ) || ! isset( $counts->publish ) ) {
			return 0;
		}
		return (int) $counts->publish;
	}

	/**
	 * Whether the migration conflict flag is set and no station blocks the migration anymore.
	 *
	 * @since 3.5.0
	 *
	 * @param mixed $flag      Value of radplapag_migration_skipped_cpt_conflict.
	 * @param int   $published Number of published stations.
	 * @return bool
	 */
	public static function should_clear_conflict( $flag, int $published ): bool {
		return (bool) $flag && 0 === $published;
	}

	/**
	 * Whether the conflict notice shows: the conflict is flagged and not dismissed.
	 *
	 * @since 3.5.0
	 *
	 * @param mixed $flag Value of radplapag_migration_skipped_cpt_conflict ('1' or 'dismissed').
	 * @return bool
	 */
	public static function shows_conflict_notice( $flag ): bool {
		return '1' === $flag;
	}

	/**
	 * Whether the migration lock is held: its expiration time is still ahead.
	 *
	 * Anything that is not an integer time (no option, an empty or unknown value)
	 * does not hold the lock, so it can be taken (ADR 0037).
	 *
	 * @since 3.5.0
	 *
	 * @param mixed $stored Value of the radplapag_migrating option.
	 * @param int   $now    Current Unix time.
	 * @return bool
	 */
	public static function is_lock_held( $stored, int $now ): bool {
		if ( is_int( $stored ) ) {
			return $stored > $now;
		}
		if ( ! is_string( $stored ) || ! ctype_digit( $stored ) ) {
			return false;
		}
		return (int) $stored > $now;
	}

	/**
	 * Whether an upgrader_process_complete run updated this plugin.
	 *
	 * @since 3.5.0
	 *
	 * @param mixed  $options  Arguments of upgrader_process_complete.
	 * @param string $basename Basename of this plugin (plugin_basename()).
	 * @return bool
	 */
	public static function is_this_plugin_update( $options, string $basename ): bool {
		if ( ! is_array( $options ) || ! isset( $options['action'], $options['type'] ) || 'update' !== $options['action'] || 'plugin' !== $options['type'] ) {
			return false;
		}
		if ( empty( $options['plugins'] ) || ! is_array( $options['plugins'] ) ) {
			return false;
		}
		return in_array( $basename, $options['plugins'], true );
	}
}
