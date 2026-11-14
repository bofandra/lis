# LIS Analyzer Interface — Roadmap

## Tujuan arsitektur
Komponen **instrument-gateway** dipisahkan dari modul LIS HOSNEX; adapter protokol dan adapter vendor dapat ditambahkan tanpa mengubah kontrak hasil normalisasi. Fokus awal: *unidirectional* (instrument -> LIS) dengan alur review manual.

## MVP v0.1 (implementasi repository ini)
- Node.js HTTP API + local dashboard.
- Payload sintetis ASTM dan HL7 ORU^R01.
- Parsing, normalized result, order matching, duplicate detection.
- Prototype listener HL7 MLLP dan ASTM framed TCP.
- Unit/integration tests dan dokumentasi; tidak menyentuh sistem klinis nyata.

## P0 menuju pilot alat fisik
- Identifikasi vendor/model/interface manual; definisikan profil alat, segment support dan test vectors.
- RS-232 agent memakai serialport, reconnect/queue/retry, transport isolation.
- Kontrak API stabil untuk LIS order/specimen/results, OpenAPI spec dan error catalog.
- Persistent data store, raw message archive terenkripsi, log audit, idempotency durable.
- Reconciliation dan hasil abnormal/critical/delta rules, guardrail hasil tidak otomatis terpublikasi.
- Autentikasi, otorisasi, TLS/network controls, observability.
- Instrument simulators serta conformance test di jaringan pilot terpisah.

## P1
- Bidirectional analyzer worklist (order download/query).
- Vendor-specific adapter plugins (Sysmex / Mindray / Roche / Abbott sesuai perangkat uji).
- LIS workflow: specimen receipt, QC acceptance, validation teknisi/dokter, release, amendment.
- Mapping katalog lokal -> LOINC secara tervalidasi, kode specimen dan unit UCUM.
- Adapter ke HOSNEX / simrs-api dengan pengendalian lifecycle hasil.

## P2
- FHIR resources: ServiceRequest, Specimen, Observation, DiagnosticReport sesuai playbook dan ketentuan SATUSEHAT.
- Multi-site instrument registry, routing/retry/dead-letter queue, dashboards SLA.
- Interface acceptance tests dan uji keamanan / UAT resmi.

**Tidak boleh** mengaktifkan release hasil, billing, FHIR publish, atau mutasi klinis secara otomatis tanpa SOP, QA, dan UAT.
