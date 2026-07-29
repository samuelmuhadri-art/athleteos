#!/usr/bin/env bash

# Exécute une commande de CI sans masquer son code de sortie et publie ses
# dernières lignes dans une annotation GitHub en cas d'échec. Cela permet de
# diagnostiquer les tests d'intégration sans rendre les journaux du job publics.
set -uo pipefail

label=$1
shift
log_file="${RUNNER_TEMP:-/tmp}/athleteos-${label}.log"

set +e
"$@" 2>&1 | tee "$log_file"
command_status=${PIPESTATUS[0]}
set -e

if [ "$command_status" -ne 0 ]; then
  {
    echo "### Échec : $label"
    echo '```text'
    tail -n 80 "$log_file"
    echo '```'
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

  diagnostic=$(tail -n 60 "$log_file")
  diagnostic=${diagnostic//'%'/'%25'}
  diagnostic=${diagnostic//$'\r'/'%0D'}
  diagnostic=${diagnostic//$'\n'/'%0A'}
  echo "::error title=Échec ${label}::$diagnostic"
fi

exit "$command_status"
