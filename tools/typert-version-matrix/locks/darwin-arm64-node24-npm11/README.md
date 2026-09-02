# Reviewed locks: darwin arm64, Node 24, npm 11

These locks were generated with the runner-local npm CLI `11.9.0` during two
isolated resolve-mode runs on macOS arm64 with Node `24.14.0`. They are inputs
for a later frozen replay; committing a lock does not make its cohort compatible
or eligible for installation.

The table and embedded machine-readable manifest are one reviewed inventory. The
offline verifier closes the case/config mapping, exact directory inventory, lock
bytes, root declarations, direct package versions, public-registry origins and
integrities, and DSH cohort. `installedGraphSha256` records the original clean
`npm ls --all --json` observation; an offline lock review can bind and preserve
that observation but cannot reproduce it without installing the graph.

| Case | Matrix config | Lock SHA-256 | Installed graph SHA-256 | Resolve source run |
| --- | --- | --- | --- | --- |
| `typert-0.1.0-rc.6-control` | `matrix.official.json` | `365cefd9653d715fa5e95a8143785f3f93115daa3568916ebfaee05844a6e2d4` | `49299fcc8e73db76d5b2ff07c4566e520e33a96f8416bc185fb53001034f7934` | `2026-09-02-rc-selection-darwin-arm64-02` |
| `typert-0.1.0-rc.7` | `matrix.official.json` | `ab74ad4a74e4a66bf8f41f37717a33b2890d089ed6cce3da8b51342e2f051437` | `25309cb3692ff9d9b832256ffb276d4276987c04d0b301df004b3cdf8d16f79c` | `2026-09-02-rc-selection-darwin-arm64-02` |
| `typert-0.1.0-rc.8` | `matrix.official.json` | `1acfba6ad35752cef58934635484a2a8a40d82dde5e5c5444173b91e770a95da` | `eeeb0f8269f367f6ed758df9c75a4ba7460e6439bdfd7711b886dad8d3a4abc4` | `2026-09-02-rc-selection-darwin-arm64-02` |
| `typert-0.1.1-rc.1` | `matrix.official.json` | `390e05de621888a4d063e1a63e5f43b92160d01fe679e97ab4da95697253e987` | `61662e49e120a87504b998f8c616d5cfd9f93c8b595a7a686318082ec68579ad` | `2026-09-02-rc-selection-darwin-arm64-02` |
| `typert-0.1.1-rc.2` | `matrix.official.json` | `014b4cde2cc208a3f9b60bd429799d8627ec6695d0c4c1cd0cfee26b66e678b8` | `656ef4e34242c1fc03c190b62b33b89f48bc944fd362beadc14bcb5c6feafeb1` | `2026-09-02-rc-selection-darwin-arm64-02` |
| `typert-0.1.2-alpha.2` | `matrix.official-experimental.json` | `9124e642e8f65532d2aa883a02d375fd76132d5462bcc7d15d75ae60e94ef7a2` | `c05a05687882eabbf4302b6a3cea8ee800f4d76ca097cb15de613a86c3a1dddc` | `2026-09-02-alpha-experimental-darwin-arm64-01` |
| `typert-0.1.2-alpha.3` | `matrix.official-experimental.json` | `bfa29728fd2513c437700f7de531581335ac293967911f471feae1d3d40b1a48` | `5094cd24114e88540bdd5afcbb6485aa0597fdb9bfc01c4b0a464b21de9dc973` | `2026-09-02-alpha-experimental-darwin-arm64-01` |
| `typert-0.1.2-alpha.4` | `matrix.official-experimental.json` | `108562e2bed178276e9faa4cb36dca89d73f7670c4fe8ccb6e26d8490f017fc6` | `3ab491dff9ef65497f56cbb7985f2728d3eb50c6db44c5ca74e0b673b78afcc5` | `2026-09-02-alpha-experimental-darwin-arm64-01` |

<!-- reviewed-lock-manifest:start -->
```json
{
  "schemaVersion": "1",
  "platformKey": "darwin-arm64-node24-npm11",
  "platform": "darwin",
  "arch": "arm64",
  "node": "24.14.0",
  "npmCli": "11.9.0",
  "registry": "https://registry.npmjs.org/",
  "cases": [
    {
      "id": "typert-0.1.0-rc.6-control",
      "matrixConfig": "matrix.official.json",
      "lockFile": "typert-0.1.0-rc.6-control.package-lock.json",
      "lockSha256": "365cefd9653d715fa5e95a8143785f3f93115daa3568916ebfaee05844a6e2d4",
      "installedGraphSha256": "49299fcc8e73db76d5b2ff07c4566e520e33a96f8416bc185fb53001034f7934",
      "sourceRunId": "2026-09-02-rc-selection-darwin-arm64-02",
      "directPackages": {
        "@deepseek-ai/dsh-typert-generator": {
          "version": "0.1.0-rc.6",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-generator/-/dsh-typert-generator-0.1.0-rc.6.tgz",
          "integrity": "sha512-zE9NvmTkjA1pJcyoDKnIlzF3V8IlslNZtrLWTfQBJyMi6ZLJkCtiC0kuQLeBxjUW5LpQKWIaWFilanWJpqevpQ=="
        },
        "@deepseek-ai/dsh-typert-protocol": {
          "version": "0.1.0-rc.6",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-protocol/-/dsh-typert-protocol-0.1.0-rc.6.tgz",
          "integrity": "sha512-weWzN8r01YCkoDCAM7BsKw2YhRrD4zL8N2SAZu9hovYtXSq8xHXsP4Zh8RLYIlYcuotjyff/6hic+0TJPd14YA=="
        },
        "@deepseek-ai/dsh-invariants": {
          "version": "0.1.0-rc.6",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-invariants/-/dsh-invariants-0.1.0-rc.6.tgz",
          "integrity": "sha512-WfEfOi99a4cpOugRAHTBSTnesLieu3ist1q9PXDXFBHX++K1rAl9+sB7YrdnbB8LH0UOY532gS9xJUYU6w0SLw=="
        },
        "@deepseek-ai/cordis": {
          "version": "4.0.1",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/cordis/-/cordis-4.0.1.tgz",
          "integrity": "sha512-YBdskTU2Po1kru3GgcUWUbkTsPMA9LkSQDAY8rBkFJeajdgcQad3QPJZE26JyK99Xb6HaASvoXg2DSUTeN/0Nw=="
        },
        "typescript": {
          "version": "6.0.3",
          "resolved": "https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz",
          "integrity": "sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw=="
        },
        "tsdown": {
          "version": "0.22.2",
          "resolved": "https://registry.npmjs.org/tsdown/-/tsdown-0.22.2.tgz",
          "integrity": "sha512-VX9gsyKXsTnBZjnIM4jsHl9aRv+GfgkE/k1hQslilaBfZMlaw3JuGR+6yhiU0QxWBtOCDnTjwOSoXzgB7Rr50g=="
        },
        "zod": {
          "version": "4.4.3",
          "resolved": "https://registry.npmjs.org/zod/-/zod-4.4.3.tgz",
          "integrity": "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ=="
        }
      }
    },
    {
      "id": "typert-0.1.0-rc.7",
      "matrixConfig": "matrix.official.json",
      "lockFile": "typert-0.1.0-rc.7.package-lock.json",
      "lockSha256": "ab74ad4a74e4a66bf8f41f37717a33b2890d089ed6cce3da8b51342e2f051437",
      "installedGraphSha256": "25309cb3692ff9d9b832256ffb276d4276987c04d0b301df004b3cdf8d16f79c",
      "sourceRunId": "2026-09-02-rc-selection-darwin-arm64-02",
      "directPackages": {
        "@deepseek-ai/dsh-typert-generator": {
          "version": "0.1.0-rc.7",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-generator/-/dsh-typert-generator-0.1.0-rc.7.tgz",
          "integrity": "sha512-lYqNrHiwRVcIfnNkgaSDwLyfLBhDmg0J0BTa4/ToqoC0YTV74Ju4oT6Tf6XX1WO9ykvFwhepXs/YYwwprvPu5g=="
        },
        "@deepseek-ai/dsh-typert-protocol": {
          "version": "0.1.0-rc.7",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-protocol/-/dsh-typert-protocol-0.1.0-rc.7.tgz",
          "integrity": "sha512-R7qdvaRRHbz5xijoVOxueeBB/VT0eDzuQNQN4iNEBUbI/L9xG9bZutktTQlgrIlBSn1sPH4pLqiCiM6ErQPTaQ=="
        },
        "@deepseek-ai/dsh-invariants": {
          "version": "0.1.0-rc.7",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-invariants/-/dsh-invariants-0.1.0-rc.7.tgz",
          "integrity": "sha512-PnO1F4aZGUmqZPyuPJpBUfQ4DZmjCGCNGr0yuN2iURTP/e6h0kGnTNTYgR2NqMvAtpP66WNiHhvH2LMqumk1+A=="
        },
        "@deepseek-ai/cordis": {
          "version": "4.0.1",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/cordis/-/cordis-4.0.1.tgz",
          "integrity": "sha512-YBdskTU2Po1kru3GgcUWUbkTsPMA9LkSQDAY8rBkFJeajdgcQad3QPJZE26JyK99Xb6HaASvoXg2DSUTeN/0Nw=="
        },
        "typescript": {
          "version": "6.0.3",
          "resolved": "https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz",
          "integrity": "sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw=="
        },
        "tsdown": {
          "version": "0.22.2",
          "resolved": "https://registry.npmjs.org/tsdown/-/tsdown-0.22.2.tgz",
          "integrity": "sha512-VX9gsyKXsTnBZjnIM4jsHl9aRv+GfgkE/k1hQslilaBfZMlaw3JuGR+6yhiU0QxWBtOCDnTjwOSoXzgB7Rr50g=="
        },
        "zod": {
          "version": "4.4.3",
          "resolved": "https://registry.npmjs.org/zod/-/zod-4.4.3.tgz",
          "integrity": "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ=="
        }
      }
    },
    {
      "id": "typert-0.1.0-rc.8",
      "matrixConfig": "matrix.official.json",
      "lockFile": "typert-0.1.0-rc.8.package-lock.json",
      "lockSha256": "1acfba6ad35752cef58934635484a2a8a40d82dde5e5c5444173b91e770a95da",
      "installedGraphSha256": "eeeb0f8269f367f6ed758df9c75a4ba7460e6439bdfd7711b886dad8d3a4abc4",
      "sourceRunId": "2026-09-02-rc-selection-darwin-arm64-02",
      "directPackages": {
        "@deepseek-ai/dsh-typert-generator": {
          "version": "0.1.0-rc.8",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-generator/-/dsh-typert-generator-0.1.0-rc.8.tgz",
          "integrity": "sha512-WxJs8lC/3krl/Shn4TAmXK2q7brUY1CH5mhxbsq3uEmoJl+6oXy/VvHXnKs7k3eBPjGam6IDPyR34LxseGI/gA=="
        },
        "@deepseek-ai/dsh-typert-protocol": {
          "version": "0.1.0-rc.8",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-protocol/-/dsh-typert-protocol-0.1.0-rc.8.tgz",
          "integrity": "sha512-scwEAefRBL7gRpaXiEdiHRMvlr8dLmUbiEvy0LOAX/8X3FZBd/5tHQ/8lCppAQNTDZMI/LSiSMpu5XrFId+7cQ=="
        },
        "@deepseek-ai/dsh-invariants": {
          "version": "0.1.0-rc.8",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-invariants/-/dsh-invariants-0.1.0-rc.8.tgz",
          "integrity": "sha512-u0lYqyxOYwfsVnbsfGXZos5vFvA4cqFnBEW3/ezgljNwkYwzeUP/Y5wjPnQjP+ZzBn3CnVeIF6s2N2Vk3iA5mQ=="
        },
        "@deepseek-ai/cordis": {
          "version": "4.0.1",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/cordis/-/cordis-4.0.1.tgz",
          "integrity": "sha512-YBdskTU2Po1kru3GgcUWUbkTsPMA9LkSQDAY8rBkFJeajdgcQad3QPJZE26JyK99Xb6HaASvoXg2DSUTeN/0Nw=="
        },
        "typescript": {
          "version": "6.0.3",
          "resolved": "https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz",
          "integrity": "sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw=="
        },
        "tsdown": {
          "version": "0.22.2",
          "resolved": "https://registry.npmjs.org/tsdown/-/tsdown-0.22.2.tgz",
          "integrity": "sha512-VX9gsyKXsTnBZjnIM4jsHl9aRv+GfgkE/k1hQslilaBfZMlaw3JuGR+6yhiU0QxWBtOCDnTjwOSoXzgB7Rr50g=="
        },
        "zod": {
          "version": "4.4.3",
          "resolved": "https://registry.npmjs.org/zod/-/zod-4.4.3.tgz",
          "integrity": "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ=="
        }
      }
    },
    {
      "id": "typert-0.1.1-rc.1",
      "matrixConfig": "matrix.official.json",
      "lockFile": "typert-0.1.1-rc.1.package-lock.json",
      "lockSha256": "390e05de621888a4d063e1a63e5f43b92160d01fe679e97ab4da95697253e987",
      "installedGraphSha256": "61662e49e120a87504b998f8c616d5cfd9f93c8b595a7a686318082ec68579ad",
      "sourceRunId": "2026-09-02-rc-selection-darwin-arm64-02",
      "directPackages": {
        "@deepseek-ai/dsh-typert-generator": {
          "version": "0.1.1-rc.1",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-generator/-/dsh-typert-generator-0.1.1-rc.1.tgz",
          "integrity": "sha512-fUp1MBpSi0mGFUjkoGvnt/j40NWI2bAw8DKjUfNzOriWyoLi0X4CI91vtWE/83obmdBqqJZGtFZtynjKfybr6g=="
        },
        "@deepseek-ai/dsh-typert-protocol": {
          "version": "0.1.1-rc.1",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-protocol/-/dsh-typert-protocol-0.1.1-rc.1.tgz",
          "integrity": "sha512-bdPYdYDNYgTGgEkHCIEB/QUUTXo0r5hkEyWlh+v95Qe34B0ZO3KhYTPSPaoYDwP0kEaOwtmmxNGZd8HFJ8VQnA=="
        },
        "@deepseek-ai/dsh-invariants": {
          "version": "0.1.1-rc.1",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-invariants/-/dsh-invariants-0.1.1-rc.1.tgz",
          "integrity": "sha512-tRsr9Qynl3qnFAHE460uALI9jncaD0pr4+hufWTSY73MbOswd6V3KDYy3wWQb9ttDm5XE5GTkB/a56KNnO28XA=="
        },
        "@deepseek-ai/cordis": {
          "version": "4.0.1",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/cordis/-/cordis-4.0.1.tgz",
          "integrity": "sha512-YBdskTU2Po1kru3GgcUWUbkTsPMA9LkSQDAY8rBkFJeajdgcQad3QPJZE26JyK99Xb6HaASvoXg2DSUTeN/0Nw=="
        },
        "typescript": {
          "version": "6.0.3",
          "resolved": "https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz",
          "integrity": "sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw=="
        },
        "tsdown": {
          "version": "0.22.2",
          "resolved": "https://registry.npmjs.org/tsdown/-/tsdown-0.22.2.tgz",
          "integrity": "sha512-VX9gsyKXsTnBZjnIM4jsHl9aRv+GfgkE/k1hQslilaBfZMlaw3JuGR+6yhiU0QxWBtOCDnTjwOSoXzgB7Rr50g=="
        },
        "zod": {
          "version": "4.4.3",
          "resolved": "https://registry.npmjs.org/zod/-/zod-4.4.3.tgz",
          "integrity": "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ=="
        }
      }
    },
    {
      "id": "typert-0.1.1-rc.2",
      "matrixConfig": "matrix.official.json",
      "lockFile": "typert-0.1.1-rc.2.package-lock.json",
      "lockSha256": "014b4cde2cc208a3f9b60bd429799d8627ec6695d0c4c1cd0cfee26b66e678b8",
      "installedGraphSha256": "656ef4e34242c1fc03c190b62b33b89f48bc944fd362beadc14bcb5c6feafeb1",
      "sourceRunId": "2026-09-02-rc-selection-darwin-arm64-02",
      "directPackages": {
        "@deepseek-ai/dsh-typert-generator": {
          "version": "0.1.1-rc.2",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-generator/-/dsh-typert-generator-0.1.1-rc.2.tgz",
          "integrity": "sha512-/SiOl7Wt5wpG1te7S0qXq6J6gnEP44+VoO7RrWjtflGu6hRHhcdsWQYUXmYC4deC5p8WNPcH27ztb23YkkB6Iw=="
        },
        "@deepseek-ai/dsh-typert-protocol": {
          "version": "0.1.1-rc.2",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-protocol/-/dsh-typert-protocol-0.1.1-rc.2.tgz",
          "integrity": "sha512-lxBssDc5Pz1qBE5kuIyaArA7AvIPq9rpaVclylodiSzVJe95e2xruBg73tflyjtd8y00toet+DLgQ6tSSsq6Kw=="
        },
        "@deepseek-ai/dsh-invariants": {
          "version": "0.1.1-rc.2",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-invariants/-/dsh-invariants-0.1.1-rc.2.tgz",
          "integrity": "sha512-l+1Om/EDFyMjhgSuEx2WDLLA2fia/+ga9mBTCoT/MMslsnWaK5G0/lWwbwlTBSaJ6OfmYc3DuBgox8DbgIGHRQ=="
        },
        "@deepseek-ai/cordis": {
          "version": "4.0.1",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/cordis/-/cordis-4.0.1.tgz",
          "integrity": "sha512-YBdskTU2Po1kru3GgcUWUbkTsPMA9LkSQDAY8rBkFJeajdgcQad3QPJZE26JyK99Xb6HaASvoXg2DSUTeN/0Nw=="
        },
        "typescript": {
          "version": "6.0.3",
          "resolved": "https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz",
          "integrity": "sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw=="
        },
        "tsdown": {
          "version": "0.22.2",
          "resolved": "https://registry.npmjs.org/tsdown/-/tsdown-0.22.2.tgz",
          "integrity": "sha512-VX9gsyKXsTnBZjnIM4jsHl9aRv+GfgkE/k1hQslilaBfZMlaw3JuGR+6yhiU0QxWBtOCDnTjwOSoXzgB7Rr50g=="
        },
        "zod": {
          "version": "4.4.3",
          "resolved": "https://registry.npmjs.org/zod/-/zod-4.4.3.tgz",
          "integrity": "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ=="
        }
      }
    },
    {
      "id": "typert-0.1.2-alpha.2",
      "matrixConfig": "matrix.official-experimental.json",
      "lockFile": "typert-0.1.2-alpha.2.package-lock.json",
      "lockSha256": "9124e642e8f65532d2aa883a02d375fd76132d5462bcc7d15d75ae60e94ef7a2",
      "installedGraphSha256": "c05a05687882eabbf4302b6a3cea8ee800f4d76ca097cb15de613a86c3a1dddc",
      "sourceRunId": "2026-09-02-alpha-experimental-darwin-arm64-01",
      "directPackages": {
        "@deepseek-ai/dsh-typert-generator": {
          "version": "0.1.2-alpha.2",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-generator/-/dsh-typert-generator-0.1.2-alpha.2.tgz",
          "integrity": "sha512-kLjF8locY3FsQzgA4L9B+W3LOCCUP1j1N4QIzj+UM3MOlpbuIH9O6P4lRYduH2nwvc6J3OEhINSbiHFt8bZSKA=="
        },
        "@deepseek-ai/dsh-typert-protocol": {
          "version": "0.1.2-alpha.2",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-protocol/-/dsh-typert-protocol-0.1.2-alpha.2.tgz",
          "integrity": "sha512-U3j/usWHRllaJMdTr4GuVkkUciHWyq01mvMtWeGT+RY2hb+ysTxeuLEiV0Lh5EyVScgFdDLbe/GtTZ2OkGsGwQ=="
        },
        "@deepseek-ai/dsh-invariants": {
          "version": "0.1.2-alpha.2",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-invariants/-/dsh-invariants-0.1.2-alpha.2.tgz",
          "integrity": "sha512-1ewUeCzUHbaqhtW5rG1/eujIXXzy2VhwvMa16RpcTuJp5qcU1NtAf/+COkmvI7qtkyNY61vWg1Ez5qL9hKIUpQ=="
        },
        "@deepseek-ai/cordis": {
          "version": "4.0.2",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/cordis/-/cordis-4.0.2.tgz",
          "integrity": "sha512-asOnXP1TzFSFQlHb1iegDZp0z/8WD1c7YNrwJR/Tx2bzNuMXfcekE/I67Iv6SQXeLB4csxqCngzQKANP7gdw0g=="
        },
        "typescript": {
          "version": "6.0.3",
          "resolved": "https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz",
          "integrity": "sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw=="
        },
        "tsdown": {
          "version": "0.22.2",
          "resolved": "https://registry.npmjs.org/tsdown/-/tsdown-0.22.2.tgz",
          "integrity": "sha512-VX9gsyKXsTnBZjnIM4jsHl9aRv+GfgkE/k1hQslilaBfZMlaw3JuGR+6yhiU0QxWBtOCDnTjwOSoXzgB7Rr50g=="
        },
        "zod": {
          "version": "4.4.3",
          "resolved": "https://registry.npmjs.org/zod/-/zod-4.4.3.tgz",
          "integrity": "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ=="
        }
      }
    },
    {
      "id": "typert-0.1.2-alpha.3",
      "matrixConfig": "matrix.official-experimental.json",
      "lockFile": "typert-0.1.2-alpha.3.package-lock.json",
      "lockSha256": "bfa29728fd2513c437700f7de531581335ac293967911f471feae1d3d40b1a48",
      "installedGraphSha256": "5094cd24114e88540bdd5afcbb6485aa0597fdb9bfc01c4b0a464b21de9dc973",
      "sourceRunId": "2026-09-02-alpha-experimental-darwin-arm64-01",
      "directPackages": {
        "@deepseek-ai/dsh-typert-generator": {
          "version": "0.1.2-alpha.3",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-generator/-/dsh-typert-generator-0.1.2-alpha.3.tgz",
          "integrity": "sha512-FO3woB8ae3fNIo7PXWTGu8P3nce+rNrYi7Qurx5nIlbP02xSdB7dUnu6umvEhGmPSJB0mrgoYqRis0RLh6X7jA=="
        },
        "@deepseek-ai/dsh-typert-protocol": {
          "version": "0.1.2-alpha.3",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-protocol/-/dsh-typert-protocol-0.1.2-alpha.3.tgz",
          "integrity": "sha512-yE3qjCbbOD0y4c0rv7hYq2sV/kLsoJ/m8+a6d8uNlEwV+W74HtpuWS8VjfWqRJZCcDRpv7yvu+/6Arw0vYl0Xg=="
        },
        "@deepseek-ai/dsh-invariants": {
          "version": "0.1.2-alpha.3",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-invariants/-/dsh-invariants-0.1.2-alpha.3.tgz",
          "integrity": "sha512-Y7O9XtME9u8HBtIT5b1tD32L3kTLRDnwpNw99MVmVWAcrHAZ40qbLnyH3DxiZi6nuKutbqsG1Bmypwt9hyUUng=="
        },
        "@deepseek-ai/cordis": {
          "version": "4.0.2",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/cordis/-/cordis-4.0.2.tgz",
          "integrity": "sha512-asOnXP1TzFSFQlHb1iegDZp0z/8WD1c7YNrwJR/Tx2bzNuMXfcekE/I67Iv6SQXeLB4csxqCngzQKANP7gdw0g=="
        },
        "typescript": {
          "version": "6.0.3",
          "resolved": "https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz",
          "integrity": "sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw=="
        },
        "tsdown": {
          "version": "0.22.2",
          "resolved": "https://registry.npmjs.org/tsdown/-/tsdown-0.22.2.tgz",
          "integrity": "sha512-VX9gsyKXsTnBZjnIM4jsHl9aRv+GfgkE/k1hQslilaBfZMlaw3JuGR+6yhiU0QxWBtOCDnTjwOSoXzgB7Rr50g=="
        },
        "zod": {
          "version": "4.4.3",
          "resolved": "https://registry.npmjs.org/zod/-/zod-4.4.3.tgz",
          "integrity": "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ=="
        }
      }
    },
    {
      "id": "typert-0.1.2-alpha.4",
      "matrixConfig": "matrix.official-experimental.json",
      "lockFile": "typert-0.1.2-alpha.4.package-lock.json",
      "lockSha256": "108562e2bed178276e9faa4cb36dca89d73f7670c4fe8ccb6e26d8490f017fc6",
      "installedGraphSha256": "3ab491dff9ef65497f56cbb7985f2728d3eb50c6db44c5ca74e0b673b78afcc5",
      "sourceRunId": "2026-09-02-alpha-experimental-darwin-arm64-01",
      "directPackages": {
        "@deepseek-ai/dsh-typert-generator": {
          "version": "0.1.2-alpha.4",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-generator/-/dsh-typert-generator-0.1.2-alpha.4.tgz",
          "integrity": "sha512-Euy0ddMp4UgVlSF/oghp2uqbBZci25TASk9fVRzH3TlXGCOg02m81mAlWq5ZbpD6fjZz2FmYjvBfv6Yj1mlF0A=="
        },
        "@deepseek-ai/dsh-typert-protocol": {
          "version": "0.1.2-alpha.4",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-typert-protocol/-/dsh-typert-protocol-0.1.2-alpha.4.tgz",
          "integrity": "sha512-NCkPCpZUDiYOLPQzdvxMgBQ9HTCl56leL+dbkuvsFU3IgKFdA7b0iW+P40/LuqPeg4RBOs1rL6GJTft/Mye3Tg=="
        },
        "@deepseek-ai/dsh-invariants": {
          "version": "0.1.2-alpha.4",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-invariants/-/dsh-invariants-0.1.2-alpha.4.tgz",
          "integrity": "sha512-ZbnGBEN3zmsn2jTAnsOzK9Su3lLdkTyyE+HstP7amiuzq31WSDIICtWHaXj475V6NbYTUgyGCwG1GU0mD3zlLg=="
        },
        "@deepseek-ai/cordis": {
          "version": "4.0.2",
          "resolved": "https://registry.npmjs.org/@deepseek-ai/cordis/-/cordis-4.0.2.tgz",
          "integrity": "sha512-asOnXP1TzFSFQlHb1iegDZp0z/8WD1c7YNrwJR/Tx2bzNuMXfcekE/I67Iv6SQXeLB4csxqCngzQKANP7gdw0g=="
        },
        "typescript": {
          "version": "6.0.3",
          "resolved": "https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz",
          "integrity": "sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw=="
        },
        "tsdown": {
          "version": "0.22.2",
          "resolved": "https://registry.npmjs.org/tsdown/-/tsdown-0.22.2.tgz",
          "integrity": "sha512-VX9gsyKXsTnBZjnIM4jsHl9aRv+GfgkE/k1hQslilaBfZMlaw3JuGR+6yhiU0QxWBtOCDnTjwOSoXzgB7Rr50g=="
        },
        "zod": {
          "version": "4.4.3",
          "resolved": "https://registry.npmjs.org/zod/-/zod-4.4.3.tgz",
          "integrity": "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ=="
        }
      }
    }
  ]
}
```
<!-- reviewed-lock-manifest:end -->

The selection resolve run executed at source commit `b01e2ff`. The experimental
run executed at Git HEAD `9631baa`; the runner source itself was unchanged from
`b01e2ff`. Those runs predate the hardened canonical provenance schema and are
used only as the lock-generation chain, not as final admissible matrix reports.

Every lock was copied byte-for-byte from its case's `proposed-lock` directory.
The hardened frozen run must independently revalidate every registry response,
installation, installed graph, generator outcome, and canonical report before a
result is retained.
