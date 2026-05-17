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
    const { geojson, layerName = 'layer' } = body;

    if (!geojson || !geojson.features) {
      return NextResponse.json({ error: 'Geçersiz GeoJSON verisi' }, { status: 400 });
    }

    // Geçici klasör oluştur
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mvt-export-'));
    const rootDir = path.join(tmpDir, 'tiles');

    // MVT Dönüşüm Seçenekleri
    const options = {
      rootDir,
      bbox: [-180, -85.0511, 180, 85.0511], // Dünya geneli
      zoom: {
        min: 0,
        max: 5 // Sunucu ve ağ performansını korumak için 0-5 arası piramit
      },
      layerName: layerName.replace(/[^a-zA-Z0-9]/g, '_') || 'mapcraft_layer'
    };

    // geojson2mvt senkron çalışır ve rootDir içerisine /z/x/y.mvt karolarını dizer
    geojson2mvt(geojson, options);

    // Klasörü ZIP arşivine çevir
    const zip = new AdmZip();
    zip.addLocalFolder(rootDir, 'tiles');
    const zipBuffer = zip.toBuffer();

    // Geçici klasörü temizle
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
