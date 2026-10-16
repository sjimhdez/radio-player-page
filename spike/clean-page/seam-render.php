<?php
// Run with: wp eval-file seam-render.php <page_id>  (inside wp-env cli)
require __DIR__ . '/results/seam.php';
$radplapag_page_id = (int) $args[0];
wp( array( 'page_id' => $radplapag_page_id ) );
echo radplapag_spike_clean_page_html();
