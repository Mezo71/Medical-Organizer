export const extractTextFromImage = async (uri: string): Promise<string[]> => {
  try {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'image.jpg';
    const type = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

    formData.append('image', {
      uri,
      name: filename,
      type,
    } as any);

    const response = await fetch('http://192.168.68.103:5001/ocr', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const data = await response.json();
    console.log('OCR Response:', data);

    return data.texts ? data.texts : []; // ✅ يجب أن تكون texts وليس imageId
  } catch (error) {
    console.error('OCR Error:', error);
    return [];
  }
};
