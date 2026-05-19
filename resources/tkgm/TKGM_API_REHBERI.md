# 🗺️ TKGM & MEGSİS API Dokümantasyonu

Bu rehber, Güneyyurt Belediyesi Sulama CRM sistemi içerisinde kullanılan Tapu ve
Kadastro Genel Müdürlüğü (TKGM) API uç noktalarını listeler.

## 📌 Temel Bilgiler

- **Ana Kaynak (İl Listesi):**
  `https://parselsorgu.tkgm.gov.tr/app/modules/administrativeQuery/data/ilListe.json`
- **Base URL (MEGSIS API):** `https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api`

---

## 🏗️ İdari Yapı API'leri

### 1. İl Listesi

Türkiye'deki tüm illerin listesini ID ve isim olarak döndürür.

- **Endpoint:** `GET /idariYapi/ilListe`
- **Örnek:**
  `https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/idariYapi/ilListe`

### 2. İlçe Listesi

Seçili bir ile ait tüm ilçelerin sınırlarını **GeoJSON FeatureCollection** formatında döndürür.

- **Endpoint:** `GET /idariYapi/ilceListe/{ilId}`
- **Örnek:**
  `https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/idariYapi/ilceListe/92`
  (Karaman'daki tüm ilçeler)

### 3. Mahalle/Köy Listesi

Seçili bir ilçeye ait tüm mahallelerin/köylerin sınırlarını **GeoJSON FeatureCollection** formatında döndürür.

- **Endpoint:** `GET /idariYapi/mahalleListe/{ilceId}`
- **Örnek:**
  `https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/idariYapi/mahalleListe/956`
  (Ermenek'teki tüm mahalleler)

---

## ⚙️ Veri Yapısı ve Esneklik

Sistemimizdeki harita motoru, TKGM'den gelen verileri iki farklı formatta da kabul eder:

1. **FeatureCollection (Dizi):** Birden fazla geometrinin (örneğin bir ilçedeki tüm mahalleler) tek bir dosyada toplandığı standart formattır.
2. **Feature (Tekil Obje):** Sadece bir mahalleye veya parsele ait verinin bulunduğu formattır. Veritabanında (Örn: `MAP_Katmanlar` -> `Icerik_JSON`) saklanırken bu formatın kullanılması önerilir.

> [!IMPORTANT]
> Veritabanına tekil obje kaydederken JSON standartlarına uymak için en dıştaki süslü parantezlerin tam olduğundan ve sonda fazladan virgül kalmadığından emin olunmalıdır.

---

## 🗺️ Parsel Sorgu API'leri

### 1. Parsel Detay ve Geometri

Mahalle, ada ve parsel numarasına göre parselin detaylı bilgilerini (alan,
nitelik vb.) ve koordinatlarını (geometri) döndürür.

- **Endpoint:** `GET /parsel/{mahalleId}/{adaNo}/{parselNo}`
- **Örnek:**
  `https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/parsel/12345/101/5`

---

## 🛠️ Teknik Notlar

- **Header Gereksinimleri:** API isteklerinde genellikle `WaitMsBeforeAsync`
  veya `User-Agent` kontrolü yapılabilir. Tarayıcı referer bilgisi
  (`Parsel Sorgu`) gerekebilir.
- **Cache Mantığı:** Uygulama içerisinde bu veriler `TKGM_Ilce`, `TKGM_Mahalle`
  ve `TKGM_Parsel` tablolarında önbelleğe alınmaktadır.
- **Güncelleme:** Parsel detayları 30 günde bir otomatik olarak yenilenmektedir.

---

> [!IMPORTANT]
> Bu API'lerin çalışması internet bağlantısı ve TKGM servislerinin durumuna
> bağlıdır.
