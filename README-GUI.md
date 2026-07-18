# Bowser Profile Browser

Aplikasi desktop Windows untuk menjalankan beberapa profil browser dengan sesi yang terisolasi.

## Instalasi di PC lain

1. Ekstrak ZIP proyek.
2. Jalankan `dist/Bowser-Profile-Browser-Installer-1.6.0.exe`.
3. Aplikasi dipasang otomatis dan tersedia melalui Desktop/Start Menu.

File yang sama dapat dijalankan di atas versi lama sebagai update langsung. Tutup aplikasinya terlebih dahulu; profil dan data tetap tersimpan tanpa uninstall manual.

Installer belum ditandatangani dengan sertifikat penerbit. Windows SmartScreen dapat menampilkan peringatan **Unknown publisher** pada komputer tertentu.

## Fitur GUI

- Membuat, mengedit, menduplikasi, mencari, dan menghapus profil.
- Cookie, cache, dan local storage terpisah untuk setiap profil.
- URL awal, locale, zona waktu, resolusi, dan User-Agent kustom.
- Import daftar User-Agent dari TXT, CSV, JSON, atau JSONL lalu pilih melalui dropdown profil.
- Fingerprint persisten per profil: platform, CPU/RAM, GPU/WebGL, screen/DPR, Client Hints, dan canvas seed.
- Katalog 100 preset fingerprint yang dikelompokkan menjadi Windows, macOS, Android, dan Linux.
- User-Agent bawaan preset dikunci per profil dan tetap sama setelah aplikasi di-update.
- Tombol **Acak fingerprint** untuk membuat identitas baru yang tetap konsisten selama profil digunakan.
- Toolbar browser dengan Back, Forward, Reload/Stop, Home, dan kolom alamat.
- Shortcut `Alt+Kiri`, `Alt+Kanan`, `Ctrl+R`, `Ctrl+Shift+R`, `Ctrl+L`, `Esc`, dan `Ctrl+W`.
- Proxy HTTP/HTTPS/SOCKS dengan password yang dienkripsi memakai Windows `safeStorage`.
- Status profil yang sedang berjalan dan tombol untuk menutupnya.
- Ikon Bowser khusus untuk aplikasi, taskbar, Desktop, Start Menu, installer, dan uninstaller.

Menghapus profil juga menghapus seluruh data sesi profil tersebut.

## Build ulang

`node_modules` sengaja tidak disertakan dalam ZIP agar ukurannya kecil. Pasang ulang dependency sebelum build:

```powershell
npm.cmd install
node .\node_modules\electron\install.js
npm.cmd run test:syntax
npm.cmd run test:integration
npm.cmd run package
```
