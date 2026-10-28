Set-Location 'C:/dev/dylantao.github.io'
$laundryQa = 'C:/dev/site-takeover-worktrees/finish-laundry/.jekyll-cache/visual-qa/laundry-2026-10-28'
$laundryBlender = 'D:/tools/blender-4.5.9-windows-x64/blender.exe'
& $laundryBlender -b --factory-startup -t 4 --python-exit-code 1 --python bin/audit_coastal_overlaps.py -- --source=artwork/coastal-home/coastal-home.blend --manifest=assets/models/home/manifest.json --models=assets/models/home --out="$laundryQa/canonical-native-overlap.json" --furniture=1 *> "$laundryQa/canonical-native-overlap.log"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $laundryBlender -b --factory-startup -t 4 --python-exit-code 1 --python bin/audit_coastal_overlaps.py -- --source=artwork/coastal-home/coastal-home.blend --manifest=assets/models/home/manifest.json --models=assets/models/home --out="$laundryQa/canonical-delivered-overlap.json" --furniture=1 --delivered=1 *> "$laundryQa/canonical-delivered-overlap.log"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
