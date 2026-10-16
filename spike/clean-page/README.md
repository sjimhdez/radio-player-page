# spike/clean-page — R2

Prerequisite: `spike/php/env-min` running, plugin active, `scripts/fixtures/seed.php` run
(player page = post 6 on a fresh env).

```bash
# (a) HTTP snapshot, twice, must be identical
./snapshot.sh "http://localhost:8891/?page_id=6" results/run1.html
./snapshot.sh "http://localhost:8891/?page_id=6" results/run2.html
cmp results/run1.html results/run2.html

# (b) seam derived mechanically from the real function, compared byte by byte with (a)
python3 make-seam.py ../../radio-player-page.php > results/seam.php
(cd ../php/env-min && npx @wordpress/env@11.17.0 run cli wp eval-file \
  wp-content/plugins/radio-player-page/spike/clean-page/seam-render.php 6 2>/dev/null) > results/seam.raw.html
cmp results/seam.raw.html results/run1.raw.html
```
