# Stage 2 isolated smoke

The Stage 2 isolated smoke passed for the recorded rc.6 combination.

- Harness target: 0.1.0-rc.6
- Plugin: @knight/dsh-pm-workbench@0.1.0
- Package SHA-256: 08ab2c7ceff9f804e14fea208e662dfab4a7a4b02ed653ebe8c74816563e0e19
- Network observation scope: browser-page-target
- External-network attempts within attached browser page target: 0
- Cleanup removed owned run root: yes

| Phase | Plugin markers | Counters | Inventory witness |
| --- | --- | --- | --- |
| initial-enabled | present | 0 → 1 | installed |
| restart-enabled | present | 1 | installed |
| disabled | absent | none | installed-disabled |
| removed | absent | none | removed |
| readded | present | 1 → 2 | installed |
