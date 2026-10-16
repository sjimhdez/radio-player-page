# spike/php — R1, R5, R7

PHPUnit 9.6 + Yoast polyfills 4.0 + WordPress test library from wp-env (`WP_TESTS_DIR=/wordpress-phpunit`).

```bash
composer install                       # platform pinned to PHP 7.4
cd env-min    # PHP 7.4 + WP 6.6-branch (ports 8891/8892)
# or: cd env-latest  # PHP 8.4 + latest WP (ports 8893/8894)
npx @wordpress/env@11.17.0 start
npx @wordpress/env@11.17.0 run tests-cli --env-cwd=spike-php vendor/bin/phpunit
```

Run the suite in `tests-cli`, never in `cli`: the test library installs into the
configured database with the `wp_` prefix and would wipe the development site.

R7 variants (PHPUnit 10/11/12 on the `env-latest` stack) were built in throwaway
folders with `config.platform.php = 8.4.0`; the results are in the report.
