<?php
/**
 * Schema version and legacy migration bootstrap (pre-3.3.0 single option → 3.3.0+ CPT).
 *
 * @package radio-player-page
 * @since 3.3.0
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'RADPLAPAG_DB_VERSION' ) ) {
	define( 'RADPLAPAG_DB_VERSION', '330' );
}

/**
 * Whether legacy radplapag_settings contains at least one station to migrate.
 *
 * WordPress does not persist the previously installed plugin semver. Any site that
 * still has this option with a non-empty `stations` list is treated as having used
 * Radio Player Page **before 3.3.0** (same storage model as 3.2.x and earlier releases
 * that used `radplapag_settings`, not only 3.2.0).
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\Upgrade\Upgrade_Policy::has_migratable_stations().
 * @phpstan-impure Reads radplapag_settings, which another request may delete.
 * @return bool
 */
function radplapag_legacy_has_migratable_stations(): bool {
	return \RadioPlayerPage\Upgrade\Upgrade_Policy::has_migratable_stations( get_option( 'radplapag_settings', null ) );
}

/**
 * Counts published radplapag_station posts.
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\Upgrade\Upgrade_Policy::published_count().
 * @return int
 */
function radplapag_count_published_stations(): int {
	return \RadioPlayerPage\Upgrade\Upgrade_Policy::published_count( wp_count_posts( 'radplapag_station' ) );
}

/**
 * Sets radplapag_db_version when no legacy data remains to migrate.
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\Upgrade\Upgrade_Policy::is_current().
 * @return void
 */
function radplapag_ensure_schema_version_option(): void {
	if ( \RadioPlayerPage\Upgrade\Upgrade_Policy::is_current( get_option( 'radplapag_db_version' ), RADPLAPAG_DB_VERSION ) ) {
		return;
	}
	if ( ! radplapag_legacy_has_migratable_stations() ) {
		update_option( 'radplapag_db_version', RADPLAPAG_DB_VERSION );
	}
}

/**
 * Resolves a user ID with manage_options for post_author during migration.
 *
 * @since 3.3.0
 * @return int
 */
function radplapag_migration_resolve_author_user_id(): int {
	$users = get_users(
		array(
			'role'    => 'administrator',
			'number'  => 20,
			'orderby' => 'ID',
			'order'   => 'ASC',
		)
	);
	foreach ( $users as $user ) {
		if ( $user instanceof WP_User && user_can( $user, 'manage_options' ) ) {
			return (int) $user->ID;
		}
	}
	return 1;
}

/**
 * Clears conflict flag when no published stations block migration anymore.
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\Upgrade\Upgrade_Policy::should_clear_conflict(); counts the stations only when the flag is set.
 * @return void
 */
function radplapag_maybe_clear_migration_conflict_flag(): void {
	$flag = get_option( 'radplapag_migration_skipped_cpt_conflict' );
	if ( ! $flag ) {
		return;
	}
	if ( \RadioPlayerPage\Upgrade\Upgrade_Policy::should_clear_conflict( $flag, radplapag_count_published_stations() ) ) {
		delete_option( 'radplapag_migration_skipped_cpt_conflict' );
	}
}

/**
 * Runs legacy migration if needed (idempotent; uses an atomic lock).
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\Upgrade\Upgrade_Policy::is_current(); returns without counting the stations while the conflict flag is set ('1' or 'dismissed'). The lock is the radplapag_migrating option of RadioPlayerPage\WP\Migration_Lock, taken before counting the published stations; the legacy transient is ignored (ADR 0037). Once taken, the posts left pending by a cut migration are deleted. Once taken, the version and the legacy data are checked again, and the writer renews the lock before each post; a migration that lost it stops without a notice (ADR 0040). After a failed write the lock is held for 900 s and the error notice lasts as long. The success notice stores the migrator's summary.
 * @since 3.5.0 Runs on any request, also hooked on init at 100, without an administrator in front: as the first administrator and without kses, restoring the current user and its kses filters. Clears the conflict flag only in the admin. The success notice does not expire (ADR 0041).
 * @return void
 */
function radplapag_run_legacy_migration_if_needed(): void {
	if ( \RadioPlayerPage\Upgrade\Upgrade_Policy::is_current( get_option( 'radplapag_db_version' ), RADPLAPAG_DB_VERSION ) ) {
		return;
	}
	if ( ! radplapag_legacy_has_migratable_stations() ) {
		return;
	}

	// On the front, a site with the conflict flag returns without counting the stations.
	if ( is_admin() ) {
		radplapag_maybe_clear_migration_conflict_flag();
	}

	if ( get_option( 'radplapag_migration_skipped_cpt_conflict' ) ) {
		return;
	}

	if ( ! \RadioPlayerPage\WP\Migration_Lock::acquire( time(), \RadioPlayerPage\WP\Migration_Lock::TTL ) ) {
		return;
	}

	// Another request may have finished while this one waited for the lock (ADR 0040).
	$version = get_option( 'radplapag_db_version' );
	if ( \RadioPlayerPage\Upgrade\Upgrade_Policy::is_current( $version, RADPLAPAG_DB_VERSION ) || ! radplapag_legacy_has_migratable_stations() ) {
		\RadioPlayerPage\WP\Migration_Lock::release();
		return;
	}

	\RadioPlayerPage\WP\Migration_Writer::purge_pending();

	if ( radplapag_count_published_stations() > 0 ) {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );
		\RadioPlayerPage\WP\Migration_Lock::release();
		return;
	}

	$author_id = radplapag_migration_resolve_author_user_id();
	$prev_user = get_current_user_id();
	wp_set_current_user( $author_id );
	// The legacy values were saved by an administrator: kses is not re-run on them (ADR 0041).
	kses_remove_filters();

	require_once __DIR__ . '/migration/class-radplapag-migrator-settings-to-cpt.php';

	$result = Radplapag_Migrator_Settings_To_Cpt::run( $author_id );

	wp_set_current_user( $prev_user );
	kses_init();

	if ( is_wp_error( $result ) && 'radplapag_migration_lock_lost' === $result->get_error_code() ) {
		return;
	}
	if ( is_wp_error( $result ) ) {
		\RadioPlayerPage\WP\Migration_Lock::hold_until( time() + 900 );
		set_transient(
			'radplapag_migration_error_notice',
			$result->get_error_message(),
			900
		);
		return;
	}

	\RadioPlayerPage\WP\Migration_Lock::release();
	delete_option( 'radplapag_migration_skipped_cpt_conflict' );
	set_transient( 'radplapag_migration_success_notice', $result );
}

/**
 * Schedules migration after upgrade or runs it when init has already fired.
 *
 * @since 3.3.0
 * @return void
 */
function radplapag_schedule_legacy_migration(): void {
	if ( ! post_type_exists( 'radplapag_station' ) ) {
		add_action( 'init', 'radplapag_run_legacy_migration_if_needed', 100 );
		return;
	}
	radplapag_run_legacy_migration_if_needed();
}

/**
 * Fires migration after this plugin was updated via the upgrader.
 *
 * @since 3.3.0
 * @since 3.5.0 Delegates to RadioPlayerPage\Upgrade\Upgrade_Policy::is_this_plugin_update().
 * @param WP_Upgrader $upgrader Upgrader instance (unused).
 * @param array       $options  Hook arguments.
 * @return void
 */
function radplapag_on_upgrader_process_complete( $upgrader, array $options ): void {
	if ( \RadioPlayerPage\Upgrade\Upgrade_Policy::is_this_plugin_update( $options, plugin_basename( RADPLAPAG_PLUGIN_FILE ) ) ) {
		radplapag_schedule_legacy_migration();
	}
}

/**
 * Dismisses persistent migration notices when query args and nonce are valid.
 *
 * @since 3.3.0
 * @since 3.5.0 Marks the conflict flag as 'dismissed' instead of deleting it.
 * @return void
 */
function radplapag_handle_migration_notice_dismiss(): void {
	if ( ! is_admin() || ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( ! isset( $_GET['radplapag_dismiss'], $_GET['_wpnonce'] ) ) {
		return;
	}
	$dismiss = sanitize_key( wp_unslash( $_GET['radplapag_dismiss'] ) );
	if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ), 'radplapag_dismiss_' . $dismiss ) ) {
		return;
	}
	if ( 'migration_conflict' === $dismiss ) {
		update_option( 'radplapag_migration_skipped_cpt_conflict', 'dismissed' );
	}
	wp_safe_redirect( remove_query_arg( array( 'radplapag_dismiss', '_wpnonce' ) ) );
	exit;
}

/**
 * Outputs admin notices for migration outcomes.
 *
 * @since 3.3.0
 * @since 3.5.0 The conflict notice shows only with the flag at '1' and is dismissible.
 * @since 3.5.0 The success notice is built by RadioPlayerPage\WP\Migration_Notice from the migration summary.
 * @return void
 */
function radplapag_migration_admin_notices(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$success = get_transient( 'radplapag_migration_success_notice' );
	if ( $success ) {
		delete_transient( 'radplapag_migration_success_notice' );
		echo wp_kses_post( \RadioPlayerPage\WP\Migration_Notice::success( $success ) );
	}

	$error = get_transient( 'radplapag_migration_error_notice' );
	if ( is_string( $error ) && '' !== $error ) {
		delete_transient( 'radplapag_migration_error_notice' );
		echo '<div class="notice notice-error is-dismissible"><p><strong>' . esc_html__( 'Radio Player Page migration error', 'radio-player-page' ) . '</strong></p><p>' . esc_html( $error ) . '</p></div>';
	}

	if ( \RadioPlayerPage\Upgrade\Upgrade_Policy::shows_conflict_notice( get_option( 'radplapag_migration_skipped_cpt_conflict' ) ) ) {
		$dismiss = wp_nonce_url(
			add_query_arg( 'radplapag_dismiss', 'migration_conflict' ),
			'radplapag_dismiss_migration_conflict'
		);
		echo '<div class="notice notice-warning is-dismissible"><p>' . esc_html__( 'Radio Player Page: Legacy settings were found, but there are already published radio stations. Automatic migration was skipped to avoid duplicates. Remove or unpublish extra radio stations if you want to import legacy data, or dismiss this message.', 'radio-player-page' ) . '</p><p><a href="' . esc_url( $dismiss ) . '">' . esc_html__( 'Dismiss This Notice', 'radio-player-page' ) . '</a></p></div>';
	}
}

add_action( 'plugins_loaded', 'radplapag_ensure_schema_version_option', 5 );
add_action( 'upgrader_process_complete', 'radplapag_on_upgrader_process_complete', 10, 2 );
add_action( 'admin_init', 'radplapag_maybe_clear_migration_conflict_flag', 5 );
add_action( 'init', 'radplapag_run_legacy_migration_if_needed', 100 );
add_action( 'admin_init', 'radplapag_run_legacy_migration_if_needed', 20 );
add_action( 'admin_init', 'radplapag_handle_migration_notice_dismiss', 15 );
add_action( 'admin_notices', 'radplapag_migration_admin_notices' );
