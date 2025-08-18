const express = require('express');
const multer = require('multer');
const cors = require('cors');
const Tesseract = require('tesseract.js');
const fs = require('fs');

const app = express(); 
const upload = multer({ dest: 'uploads/' });

app.use(cors());

app.post('/ocr', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📥 File path received:', req.file.path);

    const result = await Tesseract.recognize(req.file.path, 'eng');
    const lines = result.data.text.split('\n').filter(line => line.trim() !== '');

    fs.unlinkSync(req.file.path); // حذف الصورة بعد المعالجة

    res.json({ texts: lines });
  } catch (err) {
    console.error('OCR Error:', err);
    res.status(500).json({ error: 'OCR failed' });
  }
});

app.listen(5001, () => {
  console.log('🧠 OCR Server running on http://localhost:5001');
});
