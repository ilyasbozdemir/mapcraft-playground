import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
// @ts-expect-error - geojson2mvt has no types
import geojson2mvt from 'geojson2mvt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { geojson, layerName = 'layer', isFirstBatch, isLastBatch, exportId } = body;

    if (!geojson || !geojson.features) {
      return NextResponse.json({ error: 'Geçersiz GeoJSON verisi' }, { status: 400 });
    }

    // 1. Akış (Streaming) Modu: Büyük verileri sunucu belleğini şişirmeden parça parça birleştirir
    if (exportId) {
      const baseTmpDir = path.join(os.tmpdir(), `mvt-stream-${exportId}`);
      const featuresFile = path.join(baseTmpDir, 'features.json');

      if (isFirstBatch) {
        // İlk batch: Klasörü ve JSON dosyasını oluştur
        if (fs.existsSync(baseTmpDir)) {
          fs.rmSync(baseTmpDir, { recursive: true, force: true });
        }
        fs.mkdirSync(baseTmpDir, { recursive: true });
        fs.writeFileSync(featuresFile, JSON.stringify(geojson.features), 'utf-8');

        if (!isLastBatch) {
          return NextResponse.json({ success: true, message: 'İlk batch başarıyla alındı', receivedCount: geojson.features.length });
        }
      } else {
        // Ara batch: Mevcut JSON dosyasını oku, yeni parça ile birleştir ve yaz
        if (!fs.existsSync(featuresFile)) {
          return NextResponse.json({ error: 'Akış oturumu bulunamadı veya zaman aşımına uğradı' }, { status: 404 });
        }
        const existingFeatures = JSON.parse(fs.readFileSync(featuresFile, 'utf-8'));
        existingFeatures.push(...geojson.features);
        fs.writeFileSync(featuresFile, JSON.stringify(existingFeatures), 'utf-8');

        if (!isLastBatch) {
          return NextResponse.json({ success: true, message: 'Ara batch başarıyla eklendi', receivedCount: existingFeatures.length });
        }
      }

      // Son batch (isLastBatch: true): Tüm birikmiş veriyi MVT'ye dönüştür ve ZIP olarak dön
      if (isLastBatch) {
        const allFeatures = JSON.parse(fs.readFileSync(featuresFile, 'utf-8'));
        const combinedGeoJSON = { type: 'FeatureCollection', features: allFeatures };
        const rootDir = path.join(baseTmpDir, 'tiles');

        const options = {
          rootDir,
          bbox: [-180, -85.0511, 180, 85.0511],
          zoom: { min: 0, max: 5 }, // Sunucu ve ağ performansını korumak için 0-5 arası piramit
          layerName: layerName.replace(/[^a-zA-Z0-9]/g, '_') || 'mapcraft_layer'
        };

        // geojson2mvt senkron çalışır ve rootDir içerisine /z/x/y.mvt karolarını dizer
        geojson2mvt(combinedGeoJSON, options);

        const zip = new AdmZip();
        zip.addLocalFolder(rootDir, 'tiles');
        const zipBuffer = zip.toBuffer();

        // Temizlik
        try {
          fs.rmSync(baseTmpDir, { recursive: true, force: true });
        } catch (e) {
          console.error('Stream tmp cleanup error:', e);
        }

        return new NextResponse(zipBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${options.layerName}-mvt-stream-tiles.zip"`,
          },
        });
      }
    }

    // 2. Tek Seferlik (Normal) Yükleme Modu: 10 MB altındaki veriler için doğrudan dönüşüm
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mvt-export-'));
    const rootDir = path.join(tmpDir, 'tiles');

    const options = {
      rootDir,
      bbox: [-180, -85.0511, 180, 85.0511],
      zoom: { min: 0, max: 5 },
      layerName: layerName.replace(/[^a-zA-Z0-9]/g, '_') || 'mapcraft_layer'
    };

    geojson2mvt(geojson, options);

    const zip = new AdmZip();
    zip.addLocalFolder(rootDir, 'tiles');
    const zipBuffer = zip.toBuffer();

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Tmp cleanup error:', e);
    }

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${options.layerName}-mvt-tiles.zip"`,
      },
    });
  } catch (error: any) {
    console.error('MVT Export API Error:', error);
    return NextResponse.json({ error: error.message || 'MVT dönüştürme hatası' }, { status: 500 });
  }
}
