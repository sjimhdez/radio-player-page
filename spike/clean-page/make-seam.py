"""R2 option (b): derive a string-returning seam from the real radplapag_output_clean_page().

Mechanical edits only (the same ones a real refactor would make):
  1. rename the function;
  2. ob_start() right before the first echo;
  3. `exit;` -> `return ob_get_clean();` and bare early `return;` -> `return '';`;
  4. __FILE__ -> the real main plugin file (the copy lives elsewhere).
Usage: python3 make-seam.py ../../radio-player-page.php > results/seam.php
"""
import re, sys

src = open(sys.argv[1]).read()
start = src.index('function radplapag_output_clean_page()')
end = src.index('\n}\n', start) + 3
body = src[start:end]
body = body.replace('function radplapag_output_clean_page()', 'function radplapag_spike_clean_page_html()', 1)
body = body.replace("    echo '<!DOCTYPE html>';", "    ob_start();\n    echo '<!DOCTYPE html>';", 1)
body = body.replace('    exit;\n', '    return ob_get_clean();\n')
body = re.sub(r'return;\n', "return '';\n", body)
body = body.replace('__FILE__', "WP_PLUGIN_DIR . '/radio-player-page/radio-player-page.php'")
print('<?php\n' + body)
