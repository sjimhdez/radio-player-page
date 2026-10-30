# Real stream server samples (spec 0018, phase 0)

Saved on 2026-10-28 with `spike/0018-stream-probe/fetch-sample.sh <name> <url> <ua> [bytes]` (curl, up to 3 redirects, 6 s).
Each sample is `<name>.headers` (status line and headers of the **last** response after redirects, `Set-Cookie` dropped) and
`<name>.body` (the first 16 KB of the body; 4 KB for audio). They are the vectors of `RadioPlayerPage\Stream\` (phase 1): the tests
never request these URLs, and the servers may answer differently today (spec 0018, risk 6).

User agents: `wp` = `WordPress/6.8; https://example.com`; `browser` = a desktop Chrome UA. Stations were picked as the most-clicked
station of each provider in the radio-browser.info top 10,000 (2026-10-28), plus SomaFM, Radio Paradise, Radio France and
three Icecast servers from dir.xiph.org with one and several mounts.

Most samples were fetched without an `Origin` header, so their `Access-Control-Allow-Origin` only shows servers that answer
`*` to anyone. Servers that answer `Vary: Origin` send CORS only to a request with `Origin` (the `-origin` samples, fetched
with `ORIGIN=https://example.com`). One user agent per sample unless the name says otherwise; no `.xspf` playlist was found.

| Sample | Provider · what | URL | UA |
|---|---|---|---|
| `somafm-groovesalad.pls` | SomaFM · playlist | <https://somafm.com/groovesalad.pls> | wp |
| `somafm-groovesalad130.pls` | SomaFM · playlist | <https://somafm.com/groovesalad130.pls> | wp |
| `somafm-groovesalad.m3u` | SomaFM · 404 (no .m3u) | <https://somafm.com/groovesalad.m3u> | wp |
| `somafm-ice1-mount` | SomaFM · Icecast (kh22) mount | <https://ice1.somafm.com/groovesalad-128-mp3> | browser |
| `somafm-ice1-root` | SomaFM · Icecast root (XML) | <https://ice1.somafm.com/> | browser |
| `somafm-ice1-status-json` | SomaFM · status-json.xsl replaced by HTML | <https://ice1.somafm.com/status-json.xsl> | wp |
| `rp-mp3-128` | Radio Paradise · stream | <https://stream.radioparadise.com/mp3-128> | browser |
| `rp-128.m3u` | Radio Paradise · m3u as application/octet-stream | <https://www.radioparadise.com/m3u/mp3-128.m3u> | wp |
| `fip.m3u8` | Radio France · HLS master | <https://stream.radiofrance.fr/fip/fip.m3u8> | browser |
| `radiofrance-icecast-aac` | Radio France · Icecast AAC | <http://icecast.radiofrance.fr/fip-hifi.aac> | wp |
| `icecast244-single-status-json` | Icecast 2.4.4 · one source | <http://radio2.sikhnet.com:8018/status-json.xsl> | wp |
| `icecast244-single-root` | Icecast 2.4.4 · root (XML + XSLT) | <http://radio2.sikhnet.com:8018/> | browser |
| `icecast2499-multi-status-json` | Icecast 2.4.99.3 · four sources | <http://as.fm1.be:8000/status-json.xsl> | wp |
| `icecast2499-multi-root` | Icecast 2.4.99.3 · root (HTML) | <http://as.fm1.be:8000/> | browser |
| `icecast250-multi-status-json` | Icecast 2.5.0 · two sources, one without server_type | <http://radiohanzestad.ddns.net:18000/status-json.xsl> | wp |
| `icecast250-multi-root` | Icecast 2.5.0 · root (HTML) | <http://radiohanzestad.ddns.net:18000/> | browser |
| `radioco-stream` | Radio.co · stream | <https://streams.radio.co/se1a320b47/listen> | wp |
| `live365-stream` | Live365 · stream (redirects to its CDN) | <https://streaming.live365.com/a01484> | wp |
| `live365-station-site.m3u` | Live365 · m3u on the station's own site | <http://www.101smoothjazz.com/101-mellowmix.m3u> | wp |
| `zeno-stream` | Zeno.fm · stream, request without `Origin` | <https://stream.zeno.fm/6n6ewddtad0uv> | wp |
| `radioking-stream` | RadioKing · stream | <https://listen.radioking.com/radio/467555/stream/523739> | wp |
| `airtime-stream` | Airtime Pro · stream | <https://fmsetagaya834.out.airtime.pro/fmsetagaya834_a> | wp |
| `airtime-root` | Airtime Pro · Icecast root :8000 | <http://shonanbeachfm.out.airtime.pro:8000/> | browser |
| `streamtheworld-redirect.mp3` | Triton StreamTheWorld · livestream-redirect (302 to MediaGateway) | <http://playerservices.streamtheworld.com/api/livestream-redirect/CADENASER.mp3> | wp |
| `streamtheworld-provisioning.pls` | Triton StreamTheWorld · provisioning playlist | <http://provisioning.streamtheworld.com/pls/VIRGIN_RADIO.pls> | wp |
| `azuracast-stream` | AzuraCast · /listen/<station>/radio.mp3 (Cloudflare), request without `Origin` | <https://radio.shahimsha.com/listen/shahimsha/radio.mp3> | wp |
| `azuracast-public-page` | AzuraCast · public page | <https://radio.shahimsha.com/public/shahimsha> | browser |
| `azuracast-public.pls` | AzuraCast · public playlist | <https://radio.shahimsha.com/public/shahimsha/playlist.pls> | wp |
| `centova-proxy-stream` | Centova Cast (FastCast4u) · /proxy/<user>/stream | <https://eu8.fastcast4u.com/proxy/clyedupq/stream> | wp |
| `centova-torontocast-stream` | Centova Cast (TorontoCast) · Shoutcast DNAS :port/stream | <https://cast1.torontocast.com:4610/stream> | wp |
| `centova-torontocast-root` | Centova Cast (TorontoCast) · Shoutcast DNAS root | <https://cast1.torontocast.com:4610/> | browser |
| `sonicpanel-stream` | SonicPanel · /<port>/stream | <https://sonora-radio.arenastreaming.com/8130/stream> | wp |
| `everestcast-stream` | Everestcast · Icecast :port/stream | <https://s7.everestcast.com:1155/stream> | wp |
| `shoutcast-radio24-semicolon` | Shoutcast DNAS 2 · /; | <http://shoutcast2.radio24.it:8000/;> | wp |
| `shoutcast-radio24-root-browser` | Shoutcast DNAS 2 · root, browser UA (HTML) | <http://shoutcast2.radio24.it:8000/> | browser |
| `shoutcast-radio24-root-wp` | Shoutcast DNAS 2 · root, WordPress UA (audio) | <http://shoutcast2.radio24.it:8000/> | wp |
| `shoutcastcom-stream` | SHOUTcast hosting (streaming.shoutcast.com) | <https://streaming.shoutcast.com/100-hip-hop-and-rnb-fm> | wp |
| `bbc-icecast` | BBC · Icecast-like (redirects) | <http://stream.live.vc.bbcmedia.co.uk/bbc_world_service> | wp |
| `bbc-hls.m3u8` | BBC · HLS media playlist (Akamai) | <http://as-hls-ww-live.akamaized.net/pool_55057080/live/ww/bbc_radio_fourfm/bbc_radio_fourfm.isml/bbc_radio_fourfm-audio%3d128000.norewind.m3u8> | browser |
| `securenet.m3u` | Securenet Systems · m3u | <https://ice6.securenetsystems.net/WPSBLP.m3u> | wp |
| `streamguys-npr` | StreamGuys (NPR) · Icecast, request without `Origin` | <http://npr-ice.streamguys1.com/live.mp3> | wp |
| `zeno-stream-origin` | Zeno.fm · stream, with `Origin: https://example.com` (CORS `*`) | <https://stream.zeno.fm/6n6ewddtad0uv> | browser |
| `azuracast-stream-origin` | AzuraCast · stream, with `Origin` (CORS echoes the origin) | <https://radio.shahimsha.com/listen/shahimsha/radio.mp3> | browser |
| `streamguys-npr-origin` | StreamGuys (NPR) · with `Origin` (CORS echoes the origin) | <http://npr-ice.streamguys1.com/live.mp3> | browser |

## Spec 0020, phase 0: metadata endpoints

Saved on 2026-10-28 with `spike/0020-current-song/fetch-sample.sh <name> <url> [bytes]` (curl, browser UA, `Origin: https://example.com`
as the player's `fetch` sends, up to 3 redirects, 8 s; up to 64 KB of body, 4 KB when the server answers with audio). Only the hosts of
the spec 0018 samples (approved by the user). They are the vectors of the song parsers (spec 0020, A8); the tests never request these
URLs. Endpoints that answered 404 or 403 are not saved: they are listed in `docs/spikes/0020-phase-0.md`.

| Sample | Provider · what | URL |
|---|---|---|
| `icecast2499-multi-status-json-origin` | Icecast 2.4.99.3 · four sources, `title` and `display-title` | <http://as.fm1.be:8000/status-json.xsl> |
| `icecast250-multi-status-json-origin` | Icecast 2.5.0 · two sources, one inactive | <http://radiohanzestad.ddns.net:18000/status-json.xsl> |
| `icecast244-single-status-json-origin` | Icecast 2.4.4 · one source, **no CORS** even with `Origin` | <http://radio2.sikhnet.com:8018/status-json.xsl> |
| `everestcast-status-json-origin` | Everestcast (Icecast 2.4.4) · `title` = `Unknown`, `listenurl` on another port | <https://s7.everestcast.com:1155/status-json.xsl> |
| `azuracast-status-json-origin` | AzuraCast (Icecast 2.4.0-kh22) · `artist` and `title` apart, `listenurl` with a private IP | <https://radio.shahimsha.com/listen/shahimsha/status-json.xsl> |
| `somafm-ice1-status-json-origin` | SomaFM (Icecast kh) · an HTML page instead of JSON | <https://ice1.somafm.com/status-json.xsl> |
| `shoutcast-radio24-stats-json` | Shoutcast DNAS 2.6.1 · `/stats` JSON, empty `songtitle`, no CORS | <http://shoutcast2.radio24.it:8000/stats?sid=1&json=1> |
| `shoutcast-radio24-currentsong` | Shoutcast DNAS 2.6.1 · `/currentsong`, empty | <http://shoutcast2.radio24.it:8000/currentsong?sid=1> |
| `shoutcast-radio24-7html` | Shoutcast DNAS 2.6.1 · `/7.html`, empty title | <http://shoutcast2.radio24.it:8000/7.html> |
| `centova-torontocast-stats-json` | Centova Cast (Shoutcast DNAS 2.6.1) · `/stats` JSON with `songtitle`, no CORS | <https://cast1.torontocast.com:4610/stats?sid=1&json=1> |
| `centova-torontocast-currentsong` | ídem · `/currentsong` | <https://cast1.torontocast.com:4610/currentsong?sid=1> |
| `centova-torontocast-7html` | ídem · `/7.html` | <https://cast1.torontocast.com:4610/7.html> |
| `centova-torontocast-status-json` | ídem · `/status-json.xsl` answers **with the audio stream** (4 KB) | <https://cast1.torontocast.com:4610/status-json.xsl> |
| `centova-proxy-stats-json` | Centova Cast (FastCast4u proxy) · `/stats` JSON, empty `songtitle`, no CORS | <https://eu8.fastcast4u.com/proxy/clyedupq/stats?sid=1&json=1> |
| `centova-proxy-7html` | ídem · `/7.html` | <https://eu8.fastcast4u.com/proxy/clyedupq/7.html> |
| `centova-proxy-status-json` | ídem · `/status-json.xsl` answers **with the audio stream**, with CORS (4 KB) | <https://eu8.fastcast4u.com/proxy/clyedupq/status-json.xsl> |
