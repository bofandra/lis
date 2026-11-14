# HOSNEX LIS — Analyzer Integration Prototype

Prototype terbuka untuk mempelajari **pengambilan hasil pemeriksaan dari alat laboratorium** dan mengubahnya menjadi data hasil terstruktur yang dapat diproses LIS. Stack: **Node.js 20+**, tanpa dependency npm untuk MVP.

> **DEMO, BUKAN SISTEM KLINIS.** Seluruh order/pasien pada fixture adalah sintetis. Tidak memiliki autentikasi, penyimpanan permanen, validasi klinis, sertifikasi protokol vendor, maupun jaminan keselamatan untuk penggunaan nyata. Jangan masukkan data pasien sesungguhnya ke prototype ini.

## Jalankan

    git clone https://github.com/bofandra/lis.git
    cd lis
    npm start

Buka **http://127.0.0.1:4000**. Dashboard menyediakan:
- Dua instrument sintetis (chemistry ASTM dan hematology HL7).
- Tombol simulasi pesan analyzer, dan form input raw message.
- Parsing hasil, normalisasi pemeriksaan, mapping LOINC contoh, serta matching sample ID ke order.
- Tampilan daftar hasil, status PENDING_REVIEW, UNMATCHED_ORDER, atau PATIENT_MISMATCH.
- Proteksi ingest duplikat berdasarkan SHA-256 pesan + instrument + protokol.
- Data hanya dalam memori (restart menghapus semua hasil).

Jalankan tes:

    npm test

## API

| Method | Path | Deskripsi |
|---|---|---|
| GET | /health | Health check |
| GET | /api/instruments | Demo device registry |
| GET | /api/orders | Demo lab orders |
| GET | /api/fixtures | Raw ASTM/HL7 contoh |
| GET | /api/results | Hasil dan agregasi |
| GET | /api/results/:id | Detail hasil terstruktur |
| POST | /api/simulate | Buat hasil sintetis |
| POST | /api/ingest | Ingest raw analyzer payload |

Contoh:

    curl -X POST http://127.0.0.1:4000/api/simulate \
      -H 'Content-Type: application/json' \
      -d '{"protocol":"ASTM"}'

Untuk ingest manual, gunakan JSON:

    {
      "protocol": "HL7",
      "instrumentId": "hema-hl7-01",
      "raw": "MSH|...\\rPID|...\\rOBR|...\\rOBX|...\\r"
    }

## TCP listeners opsional

Off secara default. Hanya untuk **localhost/prototyping**:

    ENABLE_HL7_MLLP=1 ENABLE_ASTM_TCP=1 npm start

- HL7 v2 ORU^R01 via **MLLP TCP** pada port 2575; memberi HL7 ACK AA atau AE.
- ASTM gaya E1381/E1394 via **TCP** pada port 5001; minimal ENQ/ACK, frame checksum dan EOT. **Bukan driver yang teruji untuk perangkat komersial**.
- ANALYZER_HOST=127.0.0.1 adalah bind default. Ubah hanya di jaringan uji yang terisolasi.
- Keduanya terikat ke ID instrument demo. Konfigurasi alat riil, koneksi RS-232, TLS/VPN, serta network ACL belum diimplementasikan.
- Beberapa analyzer memakai varian ASTM/HL7 proprietary. Lakukan uji berdasarkan **interface manual** dan vendor sebelum dihubungkan.

## Alur data

    Analyzer / Simulator
        |
        +-- ASTM Records -- TCP E1381-like --+
        |                                    |
        +-- HL7 v2 ORU -- MLLP TCP ---------+--> Parser --> Standardized result
        |                                    |                    |
        +-- HTTP raw message ----------------+                    v
                                                  Match specimen ID to LIS order
                                                               |
                                                  Pending manual review (no release)

Fixture ada di src/fixtures.mjs; parser ada di src/parsers.mjs; business flow di src/store.mjs; listener di src/transports.mjs.

### Batasan penting

- ASTM hanya subset record H/P/O/R/L; HL7 hanya subset ORU^R01 dengan delimiter standar. **Tidak mendukung semua dialek vendor**.
- Mapping LOINC adalah **contoh**; verifikasi kode pemeriksaan, satuan, spesimen dan metode sebelum integrasi nyata.
- Belum ada bidirectional order download (query/worklist), rerun/amended result handling, QC, critical value alerts, calibration, multi-instrument sample routing, audit permanen, atau release hasil.
- Tidak ada integrasi FHIR/SATUSEHAT maupun koneksi langsung ke HOSNEX/simrs-api.
- UI/API hanya pada proses lokal Node.js: **GitHub Pages tidak bisa menjalankan backend** ini tanpa runtime Node.js.

Lihat [rencana kelanjutan](docs/ROADMAP.md).
