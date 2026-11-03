# ▲ Yükseliş — Gökdelen Simülasyonu

Tarayıcıda çalışan, modern görselli bir dikey şehir / gökdelen yönetim oyunu.
Boş bir arsadan başlayıp lobiler, ofisler, daireler, oteller, restoranlar ve
asansörlerle göğe uzanan bir kule inşa edersiniz.

## Çalıştırma

Kurulum gerekmez. `index.html` dosyasını tarayıcıda açın ya da bir statik sunucuyla servis edin:

```bash
python3 -m http.server 8000   # sonra http://localhost:8000
```

GitHub Pages ile de doğrudan yayınlanabilir.

## Oynanış

- **Lobi** ile başlayın (zemin kat, yatay sürükleyin). Her 15 katta bir gökyüzü lobisi kurulabilir.
- **Ofis / Daire / Otel** gibi yapılar altında taşıyıcı bir yapı ister; bodrum katlar üstteki yapıya asılır.
- **Asansörü** dikey sürükleyerek kurun; mevcut bir şaftın ucundan sürükleyerek uzatın, bilgi panelinden kabin ekleyin.
  Asansörler lobilerin içinden geçebilir.
- Her insan gerçek bir rota izler (yürüme → kuyruk → asansör/merdiven → aktarma). Uzun bekleyenler **stres** biriktirir;
  3 gün üst üste mutsuz kalan kiracılar taşınır.
- Nüfus arttıkça **yıldız** kazanırsınız: 2★ mağaza ve otel, 3★ süit, sinema ve ekspres asansörü açar.
- Gece-gündüz döngüsü, hafta içi/hafta sonu rutinleri, sabah ve akşam yoğunlukları vardır.

### Görselleştirme
- **Stres / Gelir / Doluluk** ısı haritası katmanları (alt çubuk)
- 📊 **Rapor**: günlük gelir-gider grafiği, bakiye eğrisi, doluluk ve stres göstergeleri
- Asansör kuyruklarında bekleyen kişi sayısı rozetleri, stresli insanların üzerinde uyarı noktaları

### Kontroller
| Eylem | Kontrol |
|---|---|
| Kaydır | Sürükle / sağ tık / WASD / ok tuşları |
| Yakınlaştır | Fare tekerleği / `+` `-` / iki parmak |
| Duraklat | `Boşluk` |
| Hız | `1`–`4` |
| Yık / İncele | `B` / `Esc` |

Oyun her gün sonunda tarayıcıya otomatik kaydedilir.

## Kod yapısı

| Dosya | İçerik |
|---|---|
| `js/sim.js` | Izgara, inşaat kuralları, Dijkstra rota bulma, asansör mantığı, insanlar, olay kuyruğu, ekonomi |
| `js/render.js` | Canvas çizimi: gökyüzü, şehir silüeti, trafik, odalar, şaftlar, insanlar, katmanlar |
| `js/ui.js` | Araç çubuğu, giriş, bilgi paneli, rapor, bildirimler, kayıt |
| `js/main.js` | Oyun döngüsü |
