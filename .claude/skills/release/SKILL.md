---
name: release
description: Prepara una versión del plugin para wordpress.org (versiones, changelog, Upgrade Notice, checklist de guidelines, Plugin Check y zip verificado) y deja los pasos de SVN para el usuario. Solo la invoca el usuario.
argument-hint: "<versión x.y.z>"
disable-model-invocation: true
---

# release

Versión: `$ARGUMENTS`. Flujo de ramas: ADR 0007 (spec 0001 §6).

## 1. En la rama de la spec de release (antes de fusionar en `trunk`)

1. **Precondiciones:** CI en verde, `docs/status.md` sin bloqueos para la versión y `docs/known-issues.md` sin decisiones pendientes que afecten a la versión.
2. **Versiones** (todas iguales): cabecera `Version:` de `radio-player-page.php`, `Stable tag:` de `readme.txt`, `version` de `player/package.json` (da nombre a los assets: hay que recompilar `player/dist/`) y de `package.json` de la raíz. Los bloques mantienen su versión propia. `Tested up to:` = la última WP con la que pasa la CI.
3. **`readme.txt`:** `== Changelog ==` para usuarios (en inglés, sin detalles internos) a partir de `git log --first-parent v<anterior>..HEAD` y de las filas de `docs/known-issues.md` corregidas; `== Upgrade Notice ==` si hay correcciones o cambios visibles.
4. **Checklist de las guidelines** (`.claude/rules/wordpress-org.md`) y subagente `wporg-reviewer` sobre todo el diff desde el tag anterior.
5. **Verificación:** `npm run check`, integración y e2e en las dos puntas (`env:start:min` / `env:start:latest`), builds sin diferencias, Plugin Check (todas las categorías) sobre el zip.
6. **Zip:** `bash scripts/build-release-zip.sh --output <dir>`; revisa `unzip -l`: solo `radio-player-page.php`, `readme.txt`, `uninstall.php`, `includes/`, `admin/`, `blocks/*/{block.json,render.php,build/}` y `player/dist/`. `npm run check:zip` compara con la referencia (si la lista cambia a propósito, se actualiza `REFERENCE_TAG` en el mismo commit, con su motivo).
7. **Prueba de instalación:** el zip en un wp-env limpio (WP 6.6 + PHP 7.4 y la última), activar, abrir una emisora sembrada y una actualización desde la 3.4.2 con datos reales.
8. Commit `chore(release): x.y.z`, `close-phase` y la spec pasa a «lista» para que el usuario la fusione en `trunk`.

## 2. Publicación (la hace el usuario; tú solo preparas los comandos)

1. PR `trunk` → `main` titulado `Release vx.y.z` (`gh pr create --base main --head trunk`). El usuario lo fusiona con merge commit.
2. Tag en ese merge: el usuario ejecuta `git tag -a vx.y.z <merge> -m "Release x.y.z"` y `git push origin vx.y.z` (Claude tiene `git tag` denegado).
3. Zip desde el tag (worktree limpio en `vx.y.z`).
4. Pasos de SVN para el checkout aparte `radio-player-page-svn`: `svn up`, copiar el contenido del zip a `trunk/`, `svn add`/`svn rm` de lo que cambie, `svn cp trunk tags/x.y.z`, `svn ci -m "Release x.y.z"`. **Los ejecuta el usuario.**
5. Después: verificación manual en iOS y Android con una emisora real, y anotarla en `docs/status.md`.

`npm run check` en verde; actualizar `docs/status.md`.
