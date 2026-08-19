const fs = require('fs');
const https = require('https');
const path = require('path');

const fontsDir = path.join(__dirname, 'public', 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

const fonts = [
  { name: 'Sarabun-Regular.ttf', url: 'https://fonts.gstatic.com/s/sarabun/v13/DtVjJx26TKEr37c9aAFynw.ttf' },
  { name: 'Sarabun-Bold.ttf', url: 'https://fonts.gstatic.com/s/sarabun/v13/DtVmJx26TKEr37c9YPxg3xQ.ttf' }
];

fonts.forEach(font => {
  const dest = path.join(fontsDir, font.name);
  const file = fs.createWriteStream(dest);
  https.get(font.url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close();  // close() is async, call cb after close completes.
      console.log(`Downloaded ${font.name}`);
    });
  }).on('error', function(err) { // Handle errors
    fs.unlink(dest); // Delete the file async. (But we don't check the result)
    console.error(`Error downloading ${font.name}: ${err.message}`);
  });
});
