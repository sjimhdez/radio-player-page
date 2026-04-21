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
 * @return bool
 */
function radplapag_legacy_has_migratable_stations() {
	$raw = get_option( 'radplapag_settings', null );
	if ( ! is_array( $raw ) || ! isset( $raw['stations'] ) || ! is_array( $raw['stations'] ) ) {
		return false;
	}
	return count( $raw['stations'] ) > 0;
}

/**
 * Counts published radplapag_station posts.
 *
 * @since 3.3.0
 * @return int
 */
function radplapag_count_published_stations() {
	$counts = wp_count_posts( 'radplapag_station' );
	if ( ! $counts || ! isset( $counts->publish ) ) {
		return 0;
	}
	return (int) $counts->publish;
}

/**
 * Sets radplapag_db_version when no legacy data remains to migrate.
 *
 * @since 3.3.0
 * @return void
 */
function radplapag_ensure_schema_version_option() {
	if ( get_option( 'radplapag_db_version' ) === RADPLAPAG_DB_VERSION ) {
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
function radplapag_migration_resolve_author_user_id() {
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
 * @return void
 */
function radplapag_maybe_clear_migration_conflict_flag() {
	if ( ! get_option( 'radplapag_migration_skipped_cpt_conflict' ) ) {
		return;
	}
	if ( radplapag_count_published_stations() === 0 ) {
		delete_option( 'radplapag_migration_skipped_cpt_conflict' );
	}
}

/**
 * Runs legacy migration if needed (idempotent; uses transient lock).
 *
 * @since 3.3.0
 * @return void
 */
function radplapag_run_legacy_migration_if_needed() {
	if ( ! is_admin() || ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) {
		return;
	}

	if ( get_option( 'radplapag_db_version' ) === RADPLAPAG_DB_VERSION ) {
		return;
	}
	if ( ! radplapag_legacy_has_migratable_stations() ) {
		return;
	}

	radplapag_maybe_clear_migration_conflict_flag();

	if ( radplapag_count_published_stations() > 0 ) {
		update_option( 'radplapag_migration_skipped_cpt_conflict', '1' );
		return;
	}

	if ( get_transient( 'radplapag_migrating' ) ) {
		return;
	}

	set_transient( 'radplapag_migrating', '1', 120 );

	$author_id  = radplapag_migration_resolve_author_user_id();
	$prev_user  = get_current_user_id();
	wp_set_current_user( $author_id );

	require_once dirname( __FILE__ ) . '/migration/class-radplapag-migrator-settings-to-cpt.php';

	$result = Radplapag_Migrator_Settings_To_Cpt::run( $author_id );

	wp_set_current_user( $prev_user );
	delete_transient( 'radplapag_migrating' );

	if ( is_wp_error( $result ) ) {
		set_transient(
			'radplapag_migration_error_notice',
			$result->get_error_message(),
			120
		);
		return;
	}

	delete_option( 'radplapag_migration_skipped_cpt_conflict' );
	set_transient( 'radplapag_migration_success_notice', '1', 60 );
}

/**
 * Schedules migration after upgrade or runs it when init has already fired.
 *
 * @since 3.3.0
 * @return void
 */
function radplapag_schedule_legacy_migration() {
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
 * @param WP_Upgrader $upgrader Upgrader instance (unused).
 * @param array       $options  Hook arguments.
 * @return void
 */
function radplapag_on_upgrader_process_complete( $upgrader, $options ) {
	if ( ! isset( $options['action'], $options['type'] ) || $options['action'] !== 'update' || $options['type'] !== 'plugin' ) {
		return;
	}
	if ( empty( $options['plugins'] ) || ! is_array( $options['plugins'] ) ) {
		return;
	}
	$basename = plugin_basename( RADPLAPAG_PLUGIN_FILE );
	foreach ( $options['plugins'] as $plugin ) {
		if ( $plugin === $basename ) {
			radplapag_schedule_legacy_migration();
			return;
		}
	}
}

/**
 * Dismisses persistent migration notices when query args and nonce are valid.
 *
 * @since 3.3.0
 * @return void
 */
function radplapag_handle_migration_notice_dismiss() {
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
	if ( $dismiss === 'migration_conflict' ) {
		delete_option( 'radplapag_migration_skipped_cpt_conflict' );
	}
	wp_safe_redirect( remove_query_arg( array( 'radplapag_dismiss', '_wpnonce' ) ) );
	exit;
}

/**
 * Outputs admin notices for migration outcomes.
 *
 * @since 3.3.0
 * @return void
 */
function radplapag_migration_admin_notices() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$success = get_transient( 'radplapag_migration_success_notice' );
	if ( $success ) {
		delete_transient( 'radplapag_migration_success_notice' );
		echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Radio Player Page: Your stations and programs were migrated from the previous storage format to the new editor. The old settings entry was removed.', 'radio-player-page' ) . '</p></div>';
	}

	$error = get_transient( 'radplapag_migration_error_notice' );
	if ( is_string( $error ) && $error !== '' ) {
		delete_transient( 'radplapag_migration_error_notice' );
		echo '<div class="notice notice-error is-dismissible"><p><strong>' . esc_html__( 'Radio Player Page migration error', 'radio-player-page' ) . '</strong></p><p>' . esc_html( $error ) . '</p></div>';
	}

	if ( get_option( 'radplapag_migration_skipped_cpt_conflict' ) ) {
		$dismiss = wp_nonce_url(
			add_query_arg( 'radplapag_dismiss', 'migration_conflict' ),
			'radplapag_dismiss_migration_conflict'
		);
		echo '<div class="notice notice-warning"><p>' . esc_html__( 'Radio Player Page: Legacy settings were found, but there are already published stations. Automatic migration was skipped to avoid duplicates. Remove or unpublish extra stations if you want to import legacy data, or dismiss this message.', 'radio-player-page' ) . '</p><p><a href="' . esc_url( $dismiss ) . '">' . esc_html__( 'Dismiss This Notice', 'radio-player-page' ) . '</a></p></div>';
	}
}

add_action( 'plugins_loaded', 'radplapag_ensure_schema_version_option', 5 );
add_action( 'upgrader_process_complete', 'radplapag_on_upgrader_process_complete', 10, 2 );
add_action( 'admin_init', 'radplapag_maybe_clear_migration_conflict_flag', 5 );
add_action( 'admin_init', 'radplapag_run_legacy_migration_if_needed', 20 );
add_action( 'admin_init', 'radplapag_handle_migration_notice_dismiss', 15 );
add_action( 'admin_notices', 'radplapag_migration_admin_notices' );
