# FilmCehennemi — Samsung Orsay Widget (2014 H serisi)

## Ne bu?
Cloudstream'in açık kaynak `Hdfilmcehennemi.kt` eklentisinin (Apache-2.0,
hexated / mustafaozkan86 reposu) mantığı Orsay TV'leri için JavaScript'e
yeniden yazılmıştır. Amaç: UE60H7000 vb. 2014 Samsung TV'lerde uygulama gibi
açılan bir film arayüzü.

## Dosya yapısı
```
FilmCehennemiWidget/
├── config.xml          # Orsay widget tanımı
├── index.html
├── widgetlist.xml      # Gelistirme sunucusuna konacak liste
├── css/style.css
└── js/
    ├── base64.js       # b64 + jwplayer unpack (packer kodu cozme)
    ├── api.js          # Siteler arasi veri katmani (liste, arama, detay, stream)
    └── main.js         # Sahne/kumanda/SEF Player
```

## Kurulum (özet)
1. Klasoru ZIP yap (icerik kok seviyesinde olmali: config.xml ustte).
2. Zip + widgetlist.xml bir web sunucusuna koy (GitHub Pages uyar!).
3. TV: Smart Hub > Samsung Hesabi > `develop` / sifre bos.
4. Smart Hub > Ayarlar > Gelistirici modu Ac + PC/sunucu IP gir.
5. Application Manager > Developer Widget > yukle.

## Bilinen aciklar / uyari
- Alan adi sık degisir: `js/api.js` → `CFG.BASE` satırını güncelleyin.
- Cloudflare duvarı: Ara sayfa 403 dönerse demek ki site TV robotlarini
  algiliyor; o halde headless çözüm düşünmeye devam edilecek.
- Dis extractor kaynaklar (iframe'i baska domainden gelen) v1'de ATLANDI;
  önce "local" (base64 çözülen) kaynak denenmeli — O en stabil.
- Test etmeden net garanti verilemez; sekmeli return kaybi mumkun.
