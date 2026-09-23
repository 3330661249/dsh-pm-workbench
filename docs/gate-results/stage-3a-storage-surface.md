# Stage 3A storage surface

STAGE3A_STORAGE_SURFACE=PASS

This diagnostic proves the generic public table behavior in rc.6 only. The final Product record and persistence path remain subject to Task 12. Only newly written neutral synthetic data was used.

| Witness | Result |
| --- | --- |
| Harness | 0.1.0-rc.6 |
| Diagnostic package | @knight/dsh-pm-workbench-storage-gate@0.0.0-stage3a |
| Small put and restart get | 512 bytes; identical SHA-256 |
| Small SHA-256 | 4ce6fd27bfeffd7dc5eb473e588e63674f16bc50a1dfc7f4d649f86f62f24327 |
| Tombstone update and restart | Hidden from the gate active-record view |
| Near-limit put and restart get | 4194304 bytes; identical SHA-256 |
| Near-limit SHA-256 | 65a092036744459c878d86f1c1225911d2f3508ccbd3925dce0a26abc3d34b2a |
| Over-limit rejection | 4194305 bytes; 0 backend calls |
| Isolated phases / restarts / fresh Chrome profiles | 7 / 6 / 7 |
| Spawn / loopback listener witnesses | 14 / 14 |
| External page-target requests | 0 |
| Port 3080 touched | false |
| Children / listeners after cleanup | 0 / 0 |
| Marker-owned root | Revalidated, renamed, deleted; absence checked |
| Tgz SHA-256 | c62adf4a99e39c02b77ad3f0edc7b8c3d338059619f7400c31d4253aae9d91e0 |
| Host build graph SHA-256 | 884fa4e534e293872ca826d9e92b5989ede0f0c17f10aa4f80b49dcf958f20b2 |
| Client build graph SHA-256 | aa76bd634ab415fdc78cfd4059cdbcdf696d78820dbe5a2283ca7c8d883a33fb |

Exact tgz inventory:

- package/cordis.patch.yml
- package/lib/client.js
- package/lib/index.js
- package/package.json
