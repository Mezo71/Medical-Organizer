import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, TextInput,
  Image, Alert, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getAuth } from 'firebase/auth';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { extractTextFromImage } from '../../utils/ocr';
import { testDictionary } from '../../testDictionary';

export default function AddManualTest() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const [selectedCategory, setSelectedCategory] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [testDate, setTestDate] = useState(new Date());
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [testName, setTestName] = useState('');
  const [ocrResult, setOcrResult] = useState<{ name: string, category: string, description: string } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [extractedValues, setExtractedValues] = useState<Record<string, string>>({});

  const categories = ['Blood', 'Urine', 'X-Ray', 'MRI', 'Other'];

  const getCategoryFromName = (name: string): string => {
    const upper = name.toUpperCase();
    if (upper.includes('A1C') || upper.includes('GLU') || upper.includes('GLUCOSE')) return 'Blood';
    if (upper.includes('TSH')) return 'Thyroid';
    if (upper.includes('LFT')) return 'Liver';
    if (upper.includes('KFT') || upper.includes('CREATININE')) return 'Kidney';
    if (upper.includes('VITAMIN')) return 'Vitamin';
    return 'Other';
  };

  const getTestDescription = (name: string): string => {
    const upper = name.toUpperCase();
    if (upper.includes('A1C')) return 'Measures average blood sugar over 3 months.';
    if (upper.includes('TSH')) return 'Checks thyroid function.';
    if (upper.includes('CBC')) return 'Complete blood count.';
    if (upper.includes('LFT')) return 'Assesses liver function.';
    if (upper.includes('KFT') || upper.includes('CREATININE')) return 'Checks kidney filtration.';
    if (upper.includes('VITAMIN D')) return 'Measures Vitamin D level.';
    if (upper.includes('GLU') || upper.includes('GLUCOSE')) return 'Measures glucose (blood sugar) level.';
    return 'No description available.';
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'You must allow gallery access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setImageUri(uri);

      const texts: string[] = await extractTextFromImage(uri);
      console.log("OCR Response:", texts);

      const cleanedSuggestions = Array.from(
        new Set(
          texts.flatMap((text) => {
            const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
            return Object.keys(testDictionary).filter((key) =>
              cleaned.includes(key)
            );
          })
        )
      );

      console.log("Cleaned Suggestions →", cleanedSuggestions);
      setSuggestions(cleanedSuggestions);

      // ✅ استخراج القيم ووضعها في الحالة
      const extracted: Record<string, string> = {};
      texts.forEach((text) => {
        const match = text.match(/([A-Z0-9]+)\s*=?\s*([0-9.]+)/);
        if (match) {
          extracted[match[1]] = match[2];
        }
      });
      setExtractedValues(extracted);

      const foundTest = cleanedSuggestions.length > 0 ? cleanedSuggestions[0] : null;

      if (foundTest) {
        const category = getCategoryFromName(foundTest);
        const description = getTestDescription(foundTest);
        setOcrResult({ name: foundTest, category, description });
      }
    }
  };

  const uploadImageToMongoDB = async (uri: string) => {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'image.jpg';
      const fileType = filename.split('.').pop();

      formData.append('image', {
        uri,
        name: filename,
        type: `image/${fileType}`,
      } as any);

      const response = await fetch('http://192.168.68.103:5000/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();
      return `http://192.168.68.103:5000/image/${data.imageId}`;
    } catch (error) {
      console.error('Image upload failed:', error);
      return null;
    }
  };

  const handleAddTest = async () => {
    if (!testName || !selectedCategory || !testDate || !user?.uid) {
      Alert.alert('Missing info', 'Please complete all required fields.');
      return;
    }

    let uploadedImageUrl = null;
    if (imageUri) {
      uploadedImageUrl = await uploadImageToMongoDB(imageUri);
      if (!uploadedImageUrl) {
        Alert.alert('Upload Error', 'Failed to upload image.');
        return;
      }
    }

    try {
      await addDoc(collection(db, 'medicalTests'), {
        userId: user.uid,
        name: testName,
        category: selectedCategory,
        date: testDate.toISOString().split('T')[0],
        imageUri: uploadedImageUrl,
        createdAt: new Date().toISOString(),
        suggestions,
        extractedValues,
      });

      Alert.alert('Saved ✅', 'Test saved successfully!');
      setTestName('');
      setSelectedCategory('');
      setTestDate(new Date());
      setImageUri(null);
    } catch (error) {
      console.error('Error saving test:', error);
      Alert.alert('Save Error', 'Failed to save the test.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
  <Text style={styles.backButtonText}>← Back</Text>
</Pressable>


      <Text style={styles.title}>Add Medical Test</Text>

      <Text style={styles.label}>Test Name</Text>
      <TextInput
        style={styles.input}
        value={testName}
        onChangeText={setTestName}
        placeholder="Enter test name"
      />

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {categories.map((category, index) => (
          <Pressable
            key={index}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.categoryButtonSelected
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextSelected
              ]}
            >
              {category}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Date</Text>
      <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
        <Text>{testDate.toISOString().split('T')[0]}</Text>
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={testDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setTestDate(selectedDate);
          }}
        />
      )}

      <Pressable style={styles.imageButton} onPress={pickImage}>
        <Text style={styles.imageButtonText}>
          {imageUri ? 'Change Image' : 'Select Image'}
        </Text>
      </Pressable>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.previewImage} />
      )}

      {Object.keys(extractedValues).length > 0 && (
        <View style={{
          backgroundColor: '#f1f8ff',
          padding: 12,
          borderRadius: 8,
          marginBottom: 20
        }}>
          <Text style={{ fontWeight: 'bold', color: '#007AFF', marginBottom: 6 }}>🧪 Extracted Test Results:</Text>
          {Object.entries(extractedValues).map(([key, value]) => (
            <View key={key} style={{ marginBottom: 12 }}>
              <Text style={{ fontWeight: '500' }}>{key} Result</Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 8,
                  padding: 10,
                  marginTop: 4,
                }}
                value={String(value)}
                onChangeText={(text) =>
                  setExtractedValues((prev) => ({
                    ...prev,
                    [key]: text,
                  }))
                }
                placeholder="Enter result"
                keyboardType="numeric"
              />
            </View>
          ))}
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Suggestions from image:</Text>
          {suggestions.map((word, index) => (
            <Pressable
              key={index}
              onPress={() => setTestName(prev => prev ? prev + ' ' + word : word)}
              style={{ backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, marginBottom: 6 }}
            >
              <Text style={{ fontWeight: '600' }}>{word}</Text>
              <Text style={{ color: '#666', fontSize: 12 }}>
                {testDictionary[word as keyof typeof testDictionary] || 'No info available'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {ocrResult && (
        <View style={styles.ocrBox}>
          <Text style={styles.ocrTitle}>🧠 OCR Suggestion:</Text>
          <Text>Test: {ocrResult.name}</Text>
          <Text style={styles.ocrDescription}>{ocrResult.description}</Text>
          <Text>Category: {ocrResult.category}</Text>
          <Pressable
            style={styles.useSuggestionButton}
            onPress={() => {
              setTestName(ocrResult.name);
              setSelectedCategory(ocrResult.category);
              setOcrResult(null);
            }}
          >
            <Text style={styles.useSuggestionText}>Use Suggestion</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.submitButton} onPress={handleAddTest}>
        <Text style={styles.submitText}>Save Test</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  
  container: { padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 20,
  },
  backButton: {
  marginBottom: 15,
  alignSelf: 'flex-start',
  backgroundColor: '#ccc',
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: 8
},
backButtonText: {
  color: '#333',
  fontWeight: 'bold',
},

 
  categoryScroll: {
    marginBottom: 20,
    flexDirection: 'row',
  },
  categoryButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 10,
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    color: '#555',
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: '#fff',
  },
  dateButton: {
    padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 20,
  },
  imageButton: {
    backgroundColor: '#eee', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10,
  },
  imageButtonText: { fontWeight: '500', color: '#007AFF' },
  previewImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 20 },
  submitButton: { backgroundColor: '#1e90ff', padding: 15, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: 'bold' },
  ocrBox: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  ocrTitle: {
    fontWeight: 'bold',
    marginBottom: 6,
  },
  ocrDescription: {
    fontStyle: 'italic',
    color: '#444',
    marginBottom: 6,
  },
  useSuggestionButton: {
    marginTop: 8,
    backgroundColor: '#1e90ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  useSuggestionText: {
    color: '#fff',
    fontWeight: '600',
  },
});
