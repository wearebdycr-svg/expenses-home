const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../android/app/google-services.json');

if (!fs.existsSync(targetFile)) {
  console.log('ℹ️ [patch-google-services] No se encontró android/app/google-services.json, omitiendo parche.');
  process.exit(0);
}

try {
  const raw = fs.readFileSync(targetFile, 'utf8').trim();
  if (!raw) {
    console.log('ℹ️ [patch-google-services] google-services.json está vacío, omitiendo.');
    process.exit(0);
  }

  const data = JSON.parse(raw);
  if (!Array.isArray(data.client)) {
    console.log('ℹ️ [patch-google-services] google-services.json no contiene arreglo "client", omitiendo.');
    process.exit(0);
  }

  const prodClient = data.client.find(
    (c) => c?.client_info?.android_client_info?.package_name === 'co.wearebdycr.expenseshome'
  );
  const devClientExists = data.client.some(
    (c) => c?.client_info?.android_client_info?.package_name === 'co.wearebdycr.expenseshome.dev'
  );

  if (prodClient && !devClientExists) {
    const devClient = JSON.parse(JSON.stringify(prodClient));
    devClient.client_info.android_client_info.package_name = 'co.wearebdycr.expenseshome.dev';
    data.client.push(devClient);
    fs.writeFileSync(targetFile, JSON.stringify(data, null, 2), 'utf8');
    console.log('✅ [patch-google-services] Cliente DEV auto-sincronizado con éxito (co.wearebdycr.expenseshome.dev).');
  } else if (devClientExists) {
    console.log('ℹ️ [patch-google-services] Cliente DEV ya existe en google-services.json.');
  }
} catch (err) {
  console.warn('⚠️ [patch-google-services] Advertencia al procesar google-services.json:', err.message);
}
